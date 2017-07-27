import Mongoose = require("mongoose");
import {Types} from 'mongoose';
import {field, document} from '../../mongoose/decorators'; 
import {Strict} from '../../mongoose/enums/';
import {baseModel} from './baseModel';
import {school} from './school';
import {onetomany, manytoone, manytomany, onetoone} from '../../core/decorators';

@document({ name: 'city', strict: Strict.throw })
export class city extends baseModel {
    @field()
    age: string;

    @field()
    createdDate: string;

    @field()
    updatedDate: string;

    @onetomany({ rel: 'school', itemType: school, embedded: true, persist: true, eagerLoading: false, deleteCascade: true, cascadeType: { cascadePut: true } })
    //@onetomany({ rel: 'school', itemType: school, embedded: true, persist: true, eagerLoading: false})
    schools: Array<school>;
    
    save()
    {
        //return new Promise((resolved, reject) => {
        //    return new Promise((resolved, reject) => {
        //        this.post().then((sucess) => resolved(sucess));
        //    });
        //});

        return (new school()).post();
    }
    
}

export default city;