import Mongoose = require("mongoose");
import {Types} from 'mongoose';
import {field, document} from '../../src/mongoose/decorators';
import {Strict} from '../../src/mongoose/enums/';
import {baseModel} from './baseModel';

@document({name: 'subject', strict: Strict.throw})
export class subject extends baseModel {
  constructor(object?: any) {
    super(object);
    if (!object || !object._id) {
      this.createdDate = Date.now().toString();
    }
    // set default properties
    this.updatedDate = Date.now().toString();
  }

  @field()
  createdDate: string;

  @field()
  updatedDate: string;
}

export default subject;
