import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import SelectionParsersService, { IUpdateEvent } from '../../../services/standalone/service.selection.parsers';

@Component({
    selector: 'app-sidebar-app-parsing',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppParsingComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() public selection: string | undefined;
    @Input() public caption: string | undefined;
    @Input() public parsed: string | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppParsingComponent');

    public _ng_selection: SafeHtml | undefined;
    public _ng_caption: string | undefined;
    public _ng_parsed: SafeHtml | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _sanitizer: DomSanitizer) {
        this._subscriptions.onFilesToBeMerged = SelectionParsersService.getObservable().onUpdate.subscribe(this._onUpdate.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._ng_caption = this.caption;
        this._ng_parsed = this._sanitizer.bypassSecurityTrustHtml(this.parsed);
        this._ng_selection = this._sanitizer.bypassSecurityTrustHtml(this.selection);
        this._cdRef.detectChanges();
    }

    public ngAfterViewInit() {

    }

    private _onUpdate(event: IUpdateEvent) {
        this._ng_caption = event.caption;
        this._ng_parsed = this._sanitizer.bypassSecurityTrustHtml(event.parsed);
        this._ng_selection = this._sanitizer.bypassSecurityTrustHtml(event.selection);
        this._cdRef.detectChanges();
    }


}
