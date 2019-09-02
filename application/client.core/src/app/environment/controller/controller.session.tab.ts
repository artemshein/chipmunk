import PluginsService, { IPluginData } from '../services/service.plugins';
import ServiceElectronIpc, { IPCMessages, Subscription as IPCSubscription } from '../services/service.electron.ipc';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTabStream } from './controller.session.tab.stream';
import { ControllerSessionTabSearch } from './controller.session.tab.search';
import { ControllerSessionTabStates } from './controller.session.tab.states';
import { ControllerSessionTabMap } from './controller.session.tab.map';
import { ControllerSessionTabStreamBookmarks } from './controller.session.tab.stream.bookmarks';
import { ControllerSessionScope } from './controller.session.tab.scope';
import { TabsService, ITab } from 'logviewer-client-complex';
import * as Toolkit from 'logviewer.client.toolkit';
import HotkeysService from '../services/service.hotkeys';
import LayoutStateService from '../services/standalone/service.layout.state';

export type TPluginAPIGetter = (pluginId: number) => Toolkit.IAPI;
export interface IControllerSession {
    guid: string;
    transports: string[];
    defaultsSideBarApps: Array<{ guid: string, name: string, component: any, closable: boolean }>;
    getPluginAPI: TPluginAPIGetter;
}

export interface IInjectionAddEvent {
    injection: Toolkit.IComponentInjection;
    type: Toolkit.EViewsTypes;
}

export interface IInjectionRemoveEvent {
    id: string;
    type: Toolkit.EViewsTypes;
}

export class ControllerSessionTab {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _transports: string[];
    private _stream: ControllerSessionTabStream;
    private _search: ControllerSessionTabSearch;
    private _states: ControllerSessionTabStates;
    private _scope: ControllerSessionScope;
    private _map: ControllerSessionTabMap;
    private _viewportEventsHub: Toolkit.ControllerViewportEvents;
    private _sidebarTabsService: TabsService;
    private _defaultsSideBarApps: Array<{ guid: string, name: string, component: any, closable: boolean }>;
    private _getPluginAPI: TPluginAPIGetter;
    private _subscriptions: { [key: string]: Subscription | IPCSubscription } = { };
    private _subjects: {
        onOutputInjectionAdd: Subject<IInjectionAddEvent>,
        onOutputInjectionRemove: Subject<IInjectionRemoveEvent>
    } = {
        onOutputInjectionAdd: new Subject<IInjectionAddEvent>(),
        onOutputInjectionRemove: new Subject<IInjectionRemoveEvent>()
    };

    constructor(params: IControllerSession) {
        this._sessionId = params.guid;
        this._transports = params.transports;
        this._getPluginAPI = params.getPluginAPI;
        this._scope = new ControllerSessionScope(this._sessionId);
        this._logger = new Toolkit.Logger(`ControllerSession: ${params.guid}`);
        this._stream = new ControllerSessionTabStream({
            guid: params.guid,
            transports: params.transports.slice(),
            scope: this._scope,
        });
        this._search = new ControllerSessionTabSearch({
            guid: params.guid,
            transports: params.transports.slice(),
            stream: this._stream.getOutputStream(),
            scope: this._scope,
        });
        this._map = new ControllerSessionTabMap({
            guid: params.guid,
            search: this._search,
            stream: this._stream,
        });
        this._states = new ControllerSessionTabStates(params.guid);
        this._viewportEventsHub = new Toolkit.ControllerViewportEvents();
        this._defaultsSideBarApps = params.defaultsSideBarApps;
        this.addOutputInjection = this.addOutputInjection.bind(this);
        this.removeOutputInjection = this.removeOutputInjection.bind(this);
        this._subscriptions.onOpenSearchFiltersTab = HotkeysService.getObservable().openSearchFiltersTab.subscribe(this._onOpenSearchFiltersTab.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            ServiceElectronIpc.request(
                new IPCMessages.StreamRemoveRequest({ guid: this.getGuid() }),
                IPCMessages.StreamRemoveResponse
            ).then((response: IPCMessages.StreamRemoveResponse) => {
                if (response.error) {
                    return reject(new Error(this._logger.warn(`Fail to destroy session "${this.getGuid()}" due error: ${response.error}`)));
                }
                PluginsService.fire().onSessionClose(this._sessionId);
                this._viewportEventsHub.destroy();
                this._sidebarTabsService.clear();
                this._sidebarTabsService = undefined;
                Promise.all([
                    this._stream.destroy(),
                    this._search.destroy(),
                    this._states.destroy()
                ]).then(() => {
                    resolve();
                }).catch((error: Error) => {
                    reject(error);
                });
            }).catch((sendingError: Error) => {
                reject(new Error(this._logger.warn(`Fail to destroy session "${this.getGuid()}" due IPC error: ${sendingError.message}`)));
            });

        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._stream.init().then(() => {
                PluginsService.fire().onSessionOpen(this._sessionId);
                this._sidebar_update();
                resolve();
            }).catch((error: Error) => {
                reject(new Error(this._logger.error(`Fail to init controller due error: ${error.message}`)));
            });
        });
    }

    public getObservable(): {
        onSourceChanged: Observable<number>,
        onOutputInjectionAdd: Observable<IInjectionAddEvent>,
        onOutputInjectionRemove: Observable<IInjectionRemoveEvent>
    } {
        return {
            onSourceChanged: this._stream.getObservable().onSourceChanged,
            onOutputInjectionAdd: this._subjects.onOutputInjectionAdd.asObservable(),
            onOutputInjectionRemove: this._subjects.onOutputInjectionRemove.asObservable(),
        };
    }

    public getGuid(): string {
        return this._sessionId;
    }

    public getScope(): ControllerSessionScope {
        return this._scope;
    }

    public getSessionStream(): ControllerSessionTabStream {
        return this._stream;
    }

    public getSessionBooksmarks(): ControllerSessionTabStreamBookmarks {
        return this._stream.getBookmarks();
    }

    public getSessionSearch(): ControllerSessionTabSearch {
        return this._search;
    }

    public getSessionsStates(): ControllerSessionTabStates {
        return this._states;
    }

    public getStreamMap(): ControllerSessionTabMap {
        return this._map;
    }

    public getSidebarTabsService(): TabsService {
        return this._sidebarTabsService;
    }

    public getOutputInjections(type: Toolkit.EViewsTypes): Map<string, Toolkit.IComponentInjection> {
        const injections: Map<string, Toolkit.IComponentInjection> = new Map();
        this._transports.forEach((pluginName: string) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${pluginName}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[type] === undefined) {
                return;
            }
            injections.set(plugin.name, {
                id: Toolkit.guid(),
                factory: plugin.factories[type],
                inputs: {
                    ipc: plugin.ipc,
                    session: this._sessionId
                }
            });
        });
        return injections;
    }

    public addOutputInjection(injection: Toolkit.IComponentInjection, type: Toolkit.EViewsTypes) {
        this._subjects.onOutputInjectionAdd.next({
            injection: injection,
            type: type,
        });
    }

    public removeOutputInjection(id: string, type: Toolkit.EViewsTypes) {
        this._subjects.onOutputInjectionRemove.next({
            id: id,
            type: type,
        });
    }

    public getViewportEventsHub(): Toolkit.ControllerViewportEvents {
        return this._viewportEventsHub;
    }

    public addSidebarApp(tab: ITab): string {
        if (typeof tab !== 'object' || tab === null) {
            return;
        }
        if (tab.guid === undefined) {
            tab.guid = Toolkit.guid();
        }
        // Add sidebar tab
        this._sidebarTabsService.add(tab);
        return tab.guid;
    }

    public hasSidebarTab(guid: string): boolean {
        return this._sidebarTabsService.has(guid);
    }

    public openSidebarTab(guid: string): void {
        this._sidebarTabsService.setActive(guid);
    }

    public removeSidebarApp(guid: string): void {
        this._sidebarTabsService.remove(guid);
    }

    public resetSessionContent(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPCMessages.StreamResetRequest({
                guid: this._sessionId,
            }), IPCMessages.StreamResetResponse).then((response: IPCMessages.StreamResetResponse) => {
                this.getSessionBooksmarks().reset();
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public setActive() {
        PluginsService.fire().onSessionChange(this._sessionId);
    }

    private _sidebar_update() {
        if (this._sidebarTabsService !== undefined) {
            // Drop previous if was defined
            this._sidebarTabsService.clear();
        }
        // Create new tabs service
        this._sidebarTabsService = new TabsService();
        // Add default sidebar apps
        this._defaultsSideBarApps.forEach((app, index) => {
            // Add tab to sidebar
            this._sidebarTabsService.add({
                guid: app.guid !== undefined ? app.guid : Toolkit.guid(),
                name: app.name,
                active: index === 0,
                closable: app.closable,
                content: {
                    factory: app.component,
                    resolved: false,
                    inputs: {
                        session: this._sessionId,
                    }
                }
            });
        });
        // Detect tabs related to transports (plugins)
        this._transports.forEach((pluginName: string, index: number) => {
            const plugin: IPluginData | undefined = PluginsService.getPlugin(pluginName);
            if (plugin === undefined) {
                this._logger.warn(`Plugin "${pluginName}" is defined as transport, but doesn't exist in storage.`);
                return;
            }
            if (plugin.factories[Toolkit.EViewsTypes.sidebarVertical] === undefined) {
                return;
            }
            // Add tab to sidebar
            this._sidebarTabsService.add({
                guid: Toolkit.guid(),
                name: plugin.name,
                active: false,
                content: {
                    factory: plugin.factories[Toolkit.EViewsTypes.sidebarVertical],
                    resolved: true,
                    inputs: {
                        session: this._sessionId,
                        api: this._getPluginAPI(plugin.id),
                        sessions: plugin.controllers.sessions,
                    }
                }
            });
        });
    }

    private _onOpenSearchFiltersTab() {
        LayoutStateService.sidebarMax();
        this._sidebarTabsService.setActive('search');
    }

}
