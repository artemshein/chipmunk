import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { NotificationsComponent                 } from './component';
import { NotificationComponent                  } from './notification/component';

import { PrimitiveModule                        } from 'chipmunk-client-primitive';
import { ContainersModule                       } from 'chipmunk-client-containers';

const entryComponents = [ NotificationComponent ];
const components = [ NotificationsComponent, ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ CommonModule, PrimitiveModule, ContainersModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class NotificationsModule {
    constructor() {
    }
}
