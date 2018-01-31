import Mongoose = require("mongoose");
import {Types} from 'mongoose';
import {field, document} from '../../mongoose/decorators';
import {Strict} from '../../mongoose/enums/';
import {baseModel} from './baseModel';
import {employee} from './employee';
import {StorageType} from '../../core/enums/storage-type-enum';
import {onetomany, manytoone, manytomany, onetoone} from '../../core/decorators';

@document({ name: 'company', strict: Strict.false })
export class company extends baseModel {
    @field()
    age: string;

    @field({ searchIndex: true })
    name: string;

    @field()
    createdDate: string;

    @field()
    updatedDate: string;

    @onetoone({ rel: 'employee', itemType: employee, embedded: true, persist: true, eagerLoading: false, deleteCascade: true })
    employeeOTO: employee;

    @onetoone({ rel: 'employee', itemType: employee, embedded: true, persist: true, eagerLoading: false, deleteCascade: true, properties: ['name'] })
    employeeOTOP: employee;

    @onetomany({ rel: 'employee', itemType: employee, embedded: true, persist: true, eagerLoading: false, deleteCascade: true })
    employeeOTM: Array<employee>;

    @onetomany({ rel: 'employee', itemType: employee, embedded: true, persist: true, eagerLoading: false, deleteCascade: true, properties: ['name'] })
    employeeOTMP: Array<employee>;

    @onetomany({ rel: 'employee', itemType: employee, embedded: true, persist: true, eagerLoading: false, deleteCascade: true, storageType: StorageType.JSONMAP })
    employeeOTMJ: Array<employee>;

    @onetomany({ rel: 'employee', itemType: employee, embedded: true, persist: true, eagerLoading: false, deleteCascade: true, storageType: StorageType.JSONMAP, properties: ['name']  })
    employeeOTMPJ: Array<employee>;
}

export default company;