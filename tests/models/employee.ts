import Mongoose = require("mongoose");
import {Types} from 'mongoose';
import {field, document} from '../../mongoose/decorators';
import {Strict} from '../../mongoose/enums/';
import {baseModel} from './baseModel';
import {school} from './school';
import {onetomany, manytoone, manytomany, onetoone} from '../../core/decorators';

@document({ name: 'employee', strict: Strict.false })
export class employee extends baseModel {
    @field()
    age: string;

    @field({ searchIndex: true })
    name: string;

    @field()
    createdDate: string;

    @field()
    updatedDate: string;
}

export default employee;