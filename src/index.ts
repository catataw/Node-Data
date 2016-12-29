/**
 * Created by bharatm on 27/12/16.
 */

export const Main = require("./core/index");
export const {addComponent, register, initialize} = Main;


import * as coreExports from  './core/exports/index';
export const {repositoryMap, router} = coreExports;


export {service, inject} from './di/decorators';


export {winstonLog} from './logging/index';
export {searchUtils} from './search/elasticSearchUtils';
export {entityServiceInst, generateSchema, connect} from './mongoose/index';

import  * as coreDecorators  from './core/decorators/index' ;
import * as ormDecorators from './mongoose/decorators/index';
export {coreDecorators, ormDecorators};


import * as enums  from './mongoose/enums/index' ;
export {enums};



