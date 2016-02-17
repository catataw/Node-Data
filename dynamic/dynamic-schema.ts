﻿/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/mongoose/mongoose.d.ts" />
/// <reference path="../typings/linq/linq.3.0.3-Beta4.d.ts" />

import Mongoose = require('mongoose');
var MongooseSchema = Mongoose.Schema;
import aa = require('mongoose');
var Enumerable: linqjs.EnumerableStatic = require('linq');
import * as Types from '../datatypes/mongoose';
    
import * as Utils from "../decorators/metadata/utils";

export class DynamicSchema {
    
    parsedSchema: any;
    schemaName: string;
    private target: Object;

    constructor(target: Object, name: string) {
        this.target = target;
        this.schemaName = name;
        this.parsedSchema = this.parse(target);
    }
    
    public getSchema(): Mongoose.SchemaType {
        return new MongooseSchema(this.parsedSchema, this.getMongooseOptions(this.target));
    }

    private parse(target: Object) {
        if (!target || !(target instanceof Object)) {
            throw TypeError;
        }
        var schema = {};
        var primaryKeyProp;
        var metaDataMap = this.getAllMetadataForSchema(target);
        for (var field in metaDataMap) {
            // Skip autogenerated primary column
            //if (prop === primaryKeyProp) {
            //    continue;
            //}
            var fieldMetadata = metaDataMap[field];
            if (fieldMetadata.params && (<any>fieldMetadata.params).isAutogenerated) {
                continue;
            }
            var paramType = fieldMetadata.propertyType;
            if (fieldMetadata.decoratorType !== Utils.DecoratorType.PROPERTY) {
                continue;
            }
            schema[field] = this.getSchemaTypeForParam(paramType);
        }
        return schema;
    }

    private getSchemaTypeForParam(paramType) {
        var schemaType = this.getSchemaTypeForType(paramType.itemType);
        if (paramType.rel) {
            //var metaData = Utils.getPrimaryKeyMetadata(paramType.itemType);
            //var relSchema;
            //if ((<any>fieldMetadata.params).embedded) {
            //    schema[field] = paramType.isArray ? [Types.Mixed] : Mongoose.Schema.Types.Mixed;
            //} else {
            //    relSchema = { ref: paramType.rel, type: Mongoose.Schema.Types.ObjectId };
            //    schema[field] = paramType.isArray ? [relSchema] : relSchema;
            //}

            // need to handle embedding vs foreign key refs
            return paramType.isArray ? [schemaType] : schemaType;
        }
        return paramType.isArray ? [schemaType] : schemaType;
    }

    private getSchemaTypeForType(type?) {
        switch (type) {
            case Mongoose.Types.ObjectId: return Mongoose.Schema.Types.ObjectId;
            case String: return String;
            case Number: return Number;
            case Buffer: return Buffer;
            case Date: return Date;
            case Boolean: return Boolean;
            case Array: return Array;
            // any or no types
            case Object:
            default: return Mongoose.Schema.Types.Mixed;
        }
        return type;
    }

    private getMongooseOptions(target: Object): any {
        var documentMeta = Utils.getMetaData(<any>target, "document", null);
        return (<any>documentMeta.params).isStrict === false ? { strict: false } : { strict: true };
    }

    private isSchemaDecorator(decorator: string) {
        return decorator === "field" || decorator === "onetomany" || decorator === "manytoone" || decorator === "manytomany";
    }

    private getAllMetadataForSchema(target: Object): { [key: string]: Utils.MetaData } {
        var metaDataMap = Utils.getAllMetaDataForAllDecorator(<any>target);
        var metaDataMapFiltered: {[key: string]: Utils.MetaData} = <any>{};
        for (var field in metaDataMap) {
            var schemaDecorators = Enumerable.from(metaDataMap[field])
                .where((x: Utils.MetaData) => this.isSchemaDecorator(x.decorator))
                .toArray();
            if (!schemaDecorators || !schemaDecorators.length) {
                continue;
            }
            if (schemaDecorators.length > 1) {
                throw "A property cannot have more than one schema decorator";
            }
            metaDataMapFiltered[field] = schemaDecorators[0];
        } 
        return metaDataMapFiltered;
    }
}