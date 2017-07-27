import Mongoose = require("mongoose");
import Q = require('q');
import {EntityChange} from '../core/enums/entity-change';
import {MetaUtils} from "../core/metadata/utils";
import * as CoreUtils from "../core/utils";
import * as Utils from "./utils";
import {Decorators} from '../core/constants/decorators';
import {DecoratorType} from '../core/enums/decorator-type';
import {MetaData} from '../core/metadata/metadata';
import {IAssociationParams} from '../core/decorators/interfaces';
import {IFieldParams, IDocumentParams} from './decorators/interfaces';
import {GetRepositoryForName, DynamicRepository} from '../core/dynamic/dynamic-repository';
import {getEntity, getModel, repoFromModel} from '../core/dynamic/model-entity';
import * as Enumerable from 'linq';
import {winstonLog} from '../logging/winstonLog';
import * as mongooseModel from './mongoose-model';
import {CrudEntity} from "../core/dynamic/crud.entity";
import {InstanceService} from '../core/services/instance-service';

/**
 * finds all the parent and update them. It is called when bulk objects are updated
 * @param model
 * @param objs
 */
export function updateParent(model: Mongoose.Model<any>, objs: Array<any>) {
    var allReferencingEntities = CoreUtils.getAllRelationsForTarget(getEntity(model.modelName));
    var asyncCalls = [];
    Enumerable.from(allReferencingEntities)
        .forEach((x: MetaData) => {
            var param = <IAssociationParams>x.params;
            if (param.embedded) {
                var meta = MetaUtils.getMetaData(x.target, Decorators.DOCUMENT);
                var targetModelMeta = meta[0];
                var repoName = (<IDocumentParams>targetModelMeta.params).name;
                var model = Utils.getCurrentDBModel(repoName);

                asyncCalls.push(updateParentDocument(model, x, objs));
            }
        });
    return Q.allSettled(asyncCalls);
}

/**
 * This removes all the transient properties.
 * @param model
 * @param obj
 */
export function removeTransientProperties(model: Mongoose.Model<any>, obj: CrudEntity): any {
    var clonedObj: CrudEntity = InstanceService.getInstance(getEntity(model.modelName), obj._id, obj);
    //var clonedObj = getEntity(model.modelName);
  //  Object.assign(clonedObj, obj);
    let transientProps = Enumerable.from(MetaUtils.getMetaData(getEntity(model.modelName))).where((ele: MetaData, idx) => {
        if (ele.decorator === Decorators.TRANSIENT) {
            return true;
        }
        return false;
    });

    if (transientProps) {
        transientProps.forEach(element => {
            delete clonedObj[element.propertyKey];
        });
    }
    
    return clonedObj;
}

/**
 * For eagerLoading, finds all the children and add this to the parent object.
 * This function is then recursively called to update all the embedded children.
 * @param model
 * @param val
 * @param force
 */
export function embeddedChildren(model: Mongoose.Model<any>, val: any, force: boolean, donotLoadChilds?: boolean) {
    if (!model)
        return;

    if (donotLoadChilds) {
        return Q.when(val);
    }

    var asyncCalls = [];
    var metas = CoreUtils.getAllRelationsForTargetInternal(getEntity(model.modelName));

    Enumerable.from(metas).forEach(x => {
        var m: MetaData = x;
        var param: IAssociationParams = <IAssociationParams>m.params;
        //if (param.embedded)
        //    return;

        if (force || param.eagerLoading || param.embedded) {
            var relModel = Utils.getCurrentDBModel(param.rel);
            // find model repo and findMany from repo instead of calling mongoose model directly
            let repo: DynamicRepository = repoFromModel[relModel.modelName];
            if (m.propertyType.isArray) {
                if (val[m.propertyKey] && val[m.propertyKey].length > 0) {
                    asyncCalls.push(repo.findMany(val[m.propertyKey], checkIfCascadingAllow(m,"loadChild") )
                        .then(result => {
                            //var childCalls = [];
                            //var updatedChild = [];
                            //Enumerable.from(result).forEach(res => {
                            //    childCalls.push(embeddedChildren(relModel, res, false).then(r => {
                            //        updatedChild.push(r);
                            //    }));
                            //});
                            //return Q.all(childCalls).then(r => {
                            //    val[m.propertyKey] = updatedChild;
                            //});
                            val[m.propertyKey] = result;
                            return Q.when(val[m.propertyKey]);
                        }));
                }
            }
            else {
                if (val[m.propertyKey]) {
                    asyncCalls.push(repo.findOne(val[m.propertyKey], checkIfCascadingAllow(m, "loadChild"))
                        .then(result => {
                            //return Q.resolve(embeddedChildren(relModel, result, false).then(r => {
                            //    val[m.propertyKey] = r;
                            //}));
                            val[m.propertyKey] = result;
                            return Q.when(val[m.propertyKey]);
                        }).catch(error => {
                            winstonLog.logError(`Error in embeddedChildren ${error}`);
                            return Q.reject(error);
                        }));
                }
            }
        }
    });

    if (asyncCalls.length == 0)
        return Q.when(val);

    return Q.allSettled(asyncCalls).then(res => {
        return val;
    });
}

/**
 * It find all children with deleteCascade = true, and delete those children.
 * Recursively, it finds all the relation with deleteCascade = true and delete them.
 * On deleting these objects, it will not update other parent doc because it is expected that these objects should not have any other parent.
 * @param model
 * @param updateObj
 */
export function deleteCascade(model: Mongoose.Model<any>, updateObj: any) {
    var relations = CoreUtils.getAllRelationsForTargetInternal(getEntity(model.modelName));
    var relationToDelete = Enumerable.from(relations).where(x => x.params.deleteCascade).toArray();
    var ids = {};
    var models = {};

    relationToDelete.forEach(res => {
        var x = <IAssociationParams>res.params;
        var prop = updateObj[res.propertyKey];
        if (!prop)
            return;
        ids[x.rel] = ids[x.rel] || [];
        if (x.embedded) {
            if (res.propertyType.isArray) {
                var id = Enumerable.from(prop).select(x => x['_id']).toArray();
                ids[x.rel] = ids[x.rel].concat(id);
            }
            else {
                ids[x.rel] = ids[x.rel].concat([prop['_id']]);
            }
        }
        else {
            ids[x.rel] = ids[x.rel].concat(res.propertyType.isArray ? prop : [prop]);
        }
        ids[x.rel] = Enumerable.from(ids[x.rel]).select(x => x.toString()).toArray();
    });

    var asyncCalls = [];
    for (var i in ids) {
        if (ids[i].length > 0) {
            models[i] = Utils.getCurrentDBModel(i);
            asyncCalls.push(bulkDelete(models[i], ids[i]));
        }
    }

    return Q.allSettled(asyncCalls);
}

/**
 * Autogenerate mongodb guid (ObjectId) for the autogenerated fields in the object
 * @param obj
 * throws TypeError if field type is not String, ObjectId or Object
 */
export function autogenerateIdsForAutoFields(model: Mongoose.Model<any>, obj: any): void {
    var fieldMetaArr = MetaUtils.getMetaData(getEntity(model.modelName), Decorators.FIELD);
    if (!fieldMetaArr) {
        return;
    }
    Enumerable.from(fieldMetaArr)
        .where((keyVal) => keyVal && keyVal.params && (<IFieldParams>keyVal.params).autogenerated)
        .forEach((keyVal) => {
            var metaData = <MetaData>keyVal;
            var objectId = new Mongoose.Types.ObjectId();
            if (metaData.getType() === String || metaData.getType() === "String") {
                obj[metaData.propertyKey] = objectId.toString();

            } else if (metaData.getType() === Mongoose.Types.ObjectId || metaData.getType() === Object) {
                obj[metaData.propertyKey] = objectId;
            } else {
                winstonLog.logError(model.modelName + ': ' + metaData.propertyKey + ' - ' + 'Invalid autogenerated type');
                throw TypeError(model.modelName + ': ' + metaData.propertyKey + ' - ' + 'Invalid autogenerated type');
            }
        });
}

/**
 * It find all the parent document and then update them. This updation will only happen if that property have chaged
 * @param model
 * @param entityChange
 * @param obj
 * @param changedProps
 */
export function updateEmbeddedOnEntityChange(model: Mongoose.Model<any>, entityChange: EntityChange, obj: any, changedProps: Array<string>) {
    var allReferencingEntities = CoreUtils.getAllRelationsForTarget(getEntity(model.modelName));
    var asyncCalls = [];
    Enumerable.from(allReferencingEntities)
        .forEach((x: MetaData) => {
            var param = <IAssociationParams>x.params;
            if (entityChange == EntityChange.delete || Utils.isPropertyUpdateRequired(changedProps, param.properties)) {
                var newObj = getFilteredValue(obj, param.properties);
                asyncCalls.push(updateEntity(x.target, x.propertyKey, x.propertyType.isArray, newObj, param.embedded, entityChange));
            }
        });
    return Q.allSettled(asyncCalls);
}

/**
 * Add child model only if relational property have set embedded to true
 * @param model
 * @param obj
 */
export function addChildModelToParent(model: Mongoose.Model<any>, obj: any, id: any,parentAction?:string) {
    var asyncCalls = [];
    var metaArr = CoreUtils.getAllRelationsForTargetInternal(getEntity(model.modelName));
    for (var m in metaArr) {
        var meta: MetaData = <any>metaArr[m];
        if (obj[meta.propertyKey]  ) {
            asyncCalls.push(embedChild(obj, meta.propertyKey, meta, parentAction));
        }
    }

    return Q.allSettled(asyncCalls).then(x => {
        return obj;
        //return isDataValid(model, obj, id).then(x => {
        //    return obj;
        //});
    });
}

/**
 * current implemnetation only update embeded for one level parent-child relationship
 * e.g- only supports teacher and student relation ship not principle->teacher->student embeded object  
 * @param model
 * @param meta
 * @param objs
 */
function updateParentDocument(model: Mongoose.Model<any>, meta: MetaData, objs: Array<CrudEntity>) {
    var queryCond = {};

    //exclude already update objects from stack

    objs = objs.filter((obj) => {
        return !obj.__callStack || (obj.__callStack &&
            obj.__callStack.callStack.filter((callstack) => {
                return (callstack.objType === model.modelName) &&
                    (obj._id.toString() === callstack._id)
            }).length > 0)
    })

    var ids = Enumerable.from(objs).select(x => x['_id']).toArray();

    model.modelName

    model = mongooseModel.getChangedModelForDynamicSchema(model, ids[0]);

    queryCond[meta.propertyKey + '._id'] = { $in: ids };
    return Q.nbind(model.find, model)(queryCond, { '_id': 1 }).then((result: Array<any>) => {
        if (!result) {
            return Q.resolve([]);
        }
        if (result && !result.length) {
            return Q.resolve(result);
        }
        var parents: Array<any> = Utils.toObject(result);
        var parentIds = parents.map(x => x._id);
        var bulk = model.collection.initializeUnorderedBulkOp();
        // classic for loop used gives high performanance
        for (var i = 0; i < objs.length; i++) {
            var queryFindCond = {};
            var updateSet = {};
            var objectId;
            if (typeof (objs[i]._id) === "string") {
                objectId = objs[i]._id;
            }
            else {
                objectId = Utils.castToMongooseType(objs[i]._id, Mongoose.Types.ObjectId);
            }
            queryFindCond['_id'] = { $in: parentIds };
            queryFindCond[meta.propertyKey + '._id'] = objectId;
            let updateMongoOperator = Utils.getMongoUpdatOperatorForRelation(meta);
            updateSet[meta.propertyKey + updateMongoOperator] = embedSelectedPropertiesOnly(meta.params, [objs[i]])[0];
            bulk.find(queryFindCond).update({ $set: updateSet });
        }

        return Q.nbind(bulk.execute, bulk)().then(result => {
            return mongooseModel.findMany(model, parentIds).then(objects => {
                return updateParent(model, objects).then(res => {
                    return objects;
                });
            });
        })
    })
        .catch(error => {
            winstonLog.logError(`Error in updateParentDocument ${error}`);
            return Q.reject(error);
        });
}

function updateParentDocumentOld(model: Mongoose.Model<any>, meta: MetaData, objs: Array<any>) {
    var queryCond = {};
    var ids = Enumerable.from(objs).select(x => x['_id']).toArray();
    var strIds = ids.map(x => x.toString());
    queryCond[meta.propertyKey + '._id'] = { $in: ids };
    return Q.nbind(model.find, model)(queryCond)
        .then(result => {
            {
                var asyncCall = [];
                Enumerable.from(result).forEach(doc => {
                    var newUpdate = {};
                    var values = doc[meta.propertyKey];
                    if (meta.propertyType.isArray) {
                        var res = [];
                        values.forEach(x => {
                            var index = strIds.indexOf(x['_id'].toString());
                            if (index >= 0) {
                                res.push(objs[index]);
                            }
                            else {
                                res.push(x);
                            }
                        });
                        newUpdate[meta.propertyKey] = res;
                    }
                    else {
                        var index = strIds.indexOf(values['_id'].toString());
                        newUpdate[meta.propertyKey] = objs[index];
                    }
                    asyncCall.push(mongooseModel.put(model, doc['_id'], newUpdate));
                });
                return Q.allSettled(asyncCall);
            }
        });
}

function bulkDelete(model: Mongoose.Model<any>, ids: any) {
    return mongooseModel.findMany(model, ids).then(data => {
        return Q.nbind(model.remove, model)({
            '_id': {

                $in: ids
            }
        }).then(x => {
            var asyncCalls = [];
            // will not call update embedded parent because these children should not exist without parent
            Enumerable.from(data).forEach(res => {
                asyncCalls.push(deleteCascade(model, res));
            });

            return Q.allSettled(asyncCalls);
        });
    });
}

function patchAllEmbedded(model: Mongoose.Model<any>, prop: string, updateObj: CrudEntity, entityChange: EntityChange, isEmbedded: boolean, isArray?: boolean): Q.Promise<any> {
    if (isEmbedded) {

        var queryCond = {};
        queryCond[prop + '._id'] = updateObj['_id'];
        if (updateObj.__callStack && updateObj.__callStack.callStack && updateObj.__callStack.callStack.length) {
            queryCond['_id'] = { $ne: updateObj.__callStack.callStack.map((x) => x._id) };
        }

        if (entityChange === EntityChange.put
            || entityChange === EntityChange.patch
            || (entityChange === EntityChange.delete && !isArray)) {

            var newUpdateObj = {};
            isArray
                ? newUpdateObj[prop + '.$'] = updateObj
                : newUpdateObj[prop] = entityChange === EntityChange.delete ? null : updateObj;

            return Q.nbind(model.update, model)(queryCond, { $set: newUpdateObj }, { multi: true })
                .then(result => {
                    return updateEmbeddedParent(model, queryCond, result, prop);
                }).catch(error => {
                    winstonLog.logError(`Error in patchAllEmbedded ${error}`);
                    return Q.reject(error);
                });

        }
        else {
            var pullObj = {};
            pullObj[prop] = {};
            pullObj[prop]['_id'] = updateObj['_id'];

            return Q.nbind(model.update, model)({}, { $pull: pullObj }, { multi: true })
                .then(result => {
                    return updateEmbeddedParent(model, queryCond, result, prop);
                }).catch(error => {
                    winstonLog.logError(`Error in patchAllEmbedded ${error}`);
                    return Q.reject(error);
                });
        }
    }
    else {
        // this to handle foreign key deletion only
        if (entityChange == EntityChange.delete) {
            var queryCond = {};
            if (isArray) {
                queryCond[prop] = { $in: [updateObj['_id']] };
            }
            else {
                queryCond[prop] = updateObj['_id'];
            }

            var pullObj = {};
            pullObj[prop] = {};

            if (isArray) {
                pullObj[prop] = updateObj['_id'];
                return Q.nbind(model.update, model)({}, { $pull: pullObj }, { multi: true })
                    .then(result => {
                        return updateEmbeddedParent(model, queryCond, result, prop);
                    }).catch(error => {
                        winstonLog.logError(`Error in patchAllEmbedded ${error}`);
                        return Q.reject(error);
                    });
            }
            else {
                pullObj[prop] = null;
                var cond = {};
                cond[prop] = updateObj['_id'];

                return Q.nbind(model.update, model)(cond, { $set: pullObj }, { multi: true })
                    .then(result => {
                        //console.log(result);
                        return updateEmbeddedParent(model, queryCond, result, prop);
                    }).catch(error => {
                        winstonLog.logError(`Error in patchAllEmbedded ${error}`);
                        return Q.reject(error);
                    });
            }
        }
    }
}

function updateEmbeddedParent(model: Mongoose.Model<any>, queryCond, result, property: string) {
    if (result['nModified'] == 0)
        return;

    var allReferencingEntities = CoreUtils.getAllRelationsForTarget(getEntity(model.modelName));

    var first = Enumerable.from(allReferencingEntities).where(x => (<IAssociationParams>x.params).embedded).firstOrDefault();
    if (!first)
        return;

    winstonLog.logInfo(`updateEmbeddedParent query is ${queryCond}`);
    // find the objects and then update these objects
    return Q.nbind(model.find, model)(queryCond)
        .then(updated => {

            // Now update affected documents in embedded records
            var asyncCalls = [];
            Enumerable.from(updated).forEach(x => {
                asyncCalls.push(updateEmbeddedOnEntityChange(model, EntityChange.patch, x, [property]));
            });
            return Q.all(asyncCalls);

        }).catch(error => {
            winstonLog.logError(`Error in updateEmbeddedParent ${error}`);
            return Q.reject(error);
        });
}

function isDataValid(model: Mongoose.Model<any>, val: any, id: any) {
    var asyncCalls = [];
    var ret: boolean = true;
    var metas = CoreUtils.getAllRelationsForTargetInternal(getEntity(model.modelName));
    Enumerable.from(metas).forEach(x => {
        var m: MetaData = x;
        if (val[m.propertyKey]) {
            asyncCalls.push(isRelationPropertyValid(model, m, val[m.propertyKey], id).then(res => {
                if (res != undefined && !res) {
                    let error: any = new Error();
                    error.propertyKey = m.propertyKey;
                    throw error;
                }
            }));
        }
    });
    return Q.all(asyncCalls).catch(f => {
        let errorMessage = 'Invalid value. Adding to property ' + "'" + f.propertyKey + "'" + ' will break the relation in model: ' + model.modelName;
        winstonLog.logError(errorMessage);
        throw errorMessage;
    });
}

function isRelationPropertyValid(model: Mongoose.Model<any>, metadata: MetaData, val: any, id: any) {
    switch (metadata.decorator) {
        case Decorators.ONETOMANY: // for array of objects
            if (metadata.propertyType.isArray) {
                if (Array.isArray(val) && val.length > 0) {
                    var queryCond = [];
                    var params = <IAssociationParams>metadata.params;
                    Enumerable.from(val).forEach(x => {
                        var con = {};
                        if (params.embedded) {
                            con[metadata.propertyKey + '._id'] = x['_id'];
                        }
                        else {
                            con[metadata.propertyKey] = { $in: [x] };
                        }
                        queryCond.push(con);
                    });
                    return Q.nbind(model.find, model)(getQueryCondition(id, queryCond))
                        .then(result => {
                            if (Array.isArray(result) && result.length > 0)
                                return false;
                            else
                                return true;
                        }).catch(error => {
                            winstonLog.logError(`Error in isRelationPropertyValid ${error}`);
                            return Q.reject(error);
                        });
                }
            }
            break;
        case Decorators.ONETOONE: // for single object
            if (!metadata.propertyType.isArray) {
                if (!Array.isArray(val)) {
                    var queryCond = [];
                    var con = {};
                    var params = <IAssociationParams>metadata.params;
                    if (params.embedded) {
                        con[metadata.propertyKey + '._id'] = val['_id'];
                    }
                    else {
                        con[metadata.propertyKey] = { $in: [val] };
                    }
                    queryCond.push(con);

                    return Q.nbind(model.find, model)(getQueryCondition(id, queryCond))
                        .then(result => {
                            if (Array.isArray(result) && result.length > 0) {
                                return false;
                            }
                        }).catch(error => {
                            winstonLog.logError(`Error in isRelationPropertyValid ${error}`);
                            return Q.reject(error);
                        });
                }
            }
            break;
        case Decorators.MANYTOONE: // for single object
            // do nothing
            return Q.when(true);
        case Decorators.MANYTOMANY: // for array of objects
            // do nothing
            return Q.when(true);
    }
    return Q.when(true);
}

function getQueryCondition(id: any, cond: any): any {
    if (id) {
        return {
            $and: [
                { $or: cond },
                { '_id': { $ne: id } }
            ]
        };
    }
    else {
        return { $or: cond }
    }
}

function updateEntity(targetModel: Object, propKey: string, targetPropArray: boolean, updatedObject: any, embedded: boolean, entityChange: EntityChange): Q.Promise<any> {
    var meta = MetaUtils.getMetaData(targetModel, Decorators.DOCUMENT);

    if (!meta) {
        throw 'Could not fetch metadata for target object';
    }

    var targetModelMeta = meta[0];
    var repoName = (<IDocumentParams>targetModelMeta.params).name;
    var model = Utils.getCurrentDBModel(repoName);
    if (!model) {
        winstonLog.logError('no repository found for relation');
        throw 'no repository found for relation';
    }
    return patchAllEmbedded(model, propKey, updatedObject, entityChange, embedded, targetPropArray);
}

export function fetchEagerLoadingProperties(model: Mongoose.Model<any>, val: any): Q.Promise<any> {
    var asyncCalls = [];
    var metas = CoreUtils.getAllRelationsForTargetInternal(getEntity(model.modelName));

    Enumerable.from(metas).forEach(x => {
        var m: MetaData = x;
        var param: IAssociationParams = <IAssociationParams>m.params;
        if (param && !param.embedded && param.eagerLoading && val[m.propertyKey]) {
            var relModel = Utils.getCurrentDBModel(param.rel);
            if (m.propertyType.isArray) {
                if (val[m.propertyKey].length > 0) {
                    asyncCalls.push(mongooseModel.findMany(relModel, val[m.propertyKey]).then(res => {
                        val[m.propertyKey] = res;
                    }));
                }
            }
            else {
                asyncCalls.push(mongooseModel.findMany(relModel, [val[m.propertyKey]]).then(res => {
                    val[m.propertyKey] = res[0];
                }));
            }
        }
    });

    return Q.allSettled(asyncCalls).then(result => {
        return val;
    });
}

/**
 * Rules to decide if cascading at current level allowed.
 * @param relMetadata  meta data of relation (decorator)
 * @param parentAction action performed over parent (post,put,patch,delete,loadchild)
 */
function checkIfCascadingAllow(relMetadata: MetaData, parentAction?: string): boolean {
    let allowCascade = true;
    if (parentAction == "post") {
        if (relMetadata.decorator === Decorators.ONETOONE ||
            relMetadata.decorator === Decorators.ONETOMANY) {
            allowCascade = true; //set as default value
        }
        if (relMetadata.decorator === Decorators.MANYTOONE) {
            allowCascade = false; //set as default value
        }

        //check if developer has overridde default vaule
        if (relMetadata.params && relMetadata.params.cascadeType
            && relMetadata.params.cascadeType.cascadePost
        ) {
            allowCascade = relMetadata.params.cascadeType.cascadePost;
        }
    }
    if (parentAction == "put") {
        allowCascade = false;
        if (relMetadata.params && relMetadata.params.cascadeType
            && relMetadata.params.cascadeType.cascadePut) {
            allowCascade = relMetadata.params.cascadeType.cascadePut;
        }
    }
    if (parentAction == "patch") {
        allowCascade = false;
        if (relMetadata.params && relMetadata.params.cascadeType
            && relMetadata.params.cascadeType.cascadePatch) {
            allowCascade = relMetadata.params.cascadeType.cascadePatch;
        }
    }

    if (parentAction == "delete") {
        if (relMetadata.decorator === Decorators.MANYTOONE ||
            relMetadata.decorator === Decorators.ONETOMANY) {
            allowCascade = false; //set as default value
        }
        if (relMetadata.decorator === Decorators.ONETOONE) {
            allowCascade = true; //set as default value
        }

        //check if developer has overridde default vaule
        if (relMetadata.params && relMetadata.params.cascadeType
            && relMetadata.params.cascadeType.cascadePost
        ) {
            allowCascade = relMetadata.params.cascadeType.cascadePost;
        }
    }

    if (parentAction == "loadChild") {
        if (relMetadata.params.embedded) {
            allowCascade = false;
        }
        else {
            allowCascade = true;
            if (relMetadata.params && relMetadata.params.cascadeType
                && relMetadata.params.cascadeType.cascadeChildLoad
            ) {
                allowCascade = relMetadata.params.cascadeType.cascadeChildLoad;
            }
        }
    }


    return allowCascade;
}


//
//obj - parent object
//prop - property key in obj
//relMetadata - decoration information of reltion
//parentAction -action on parent(post,put,patch,delete)
//object1 cadcasding
//object1 if someone set id action , id to object replace (if embedded)
function embedChild(obj, prop, relMetadata: MetaData, parentAction?: string): Q.Promise<any> {
    if (!obj[prop])
        return;
    if (relMetadata.propertyType.isArray && !(obj[prop] instanceof Array)) {
        winstonLog.logError('Expected array, found non-array');
        throw 'Expected array, found non-array';
    }
    if (!relMetadata.propertyType.isArray && (obj[prop] instanceof Array)) {
        winstonLog.logError('Expected single item, found array');
        throw 'Expected single item, found array';
    }
    let isCascade = checkIfCascadingAllow(relMetadata, parentAction);

    let params: IAssociationParams = <any>relMetadata.params;
    let relModel = Utils.getCurrentDBModel(params.rel);
    let val = obj[prop];

    let newVal: Array<any> | any = {}; // updated value after cascading complete

    let asyncTask = [];
    let exsitingsValObjects = []; // updated value after cascading complete
    let newObjs = [];//obejcts to be created
    let searchObj = []; // if child is mentioned with id not as actual object (for embedded it need to pull from DB and set it back)

    if (relMetadata.propertyType.isArray) {
        newVal = [];
        exsitingsValObjects = val.filter((elementArr) => { return CoreUtils.isJSON(elementArr) && elementArr['_id'] })
        newObjs = val.filter((elementArr) => { return CoreUtils.isJSON(elementArr) && !elementArr['_id'] })
        searchObj = val.filter((elementArr) => {
            return !CoreUtils.isJSON(elementArr)
                && params.embedded  //need to check for bson as well
        })
    }
    else {
        let applicableObj = !CoreUtils.isJSON(val) ? searchObj : (val['_id'] ? exsitingsValObjects : newObjs)  //need to check for bson as well
        applicableObj.push(val);
    }


    exsitingsValObjects.forEach((elementArr) => {
        elementArr['_id'] = Utils.castToMongooseType(elementArr['_id'], Mongoose.Types.ObjectId);
    })
    searchObj = searchObj.map((xval) => Utils.castToMongooseType(xval, Mongoose.Types.ObjectId)) //igonre for bson


    

    let applicableAction = parentAction;
    if (relMetadata.propertyType.isArray) {
        applicableAction = parentAction == "post" ? "bulkPost" : (parentAction == "put" ? "bulkPut" : "bulkPatch");
    }

    if ((parentAction == "post" && checkIfCascadingAllow(relMetadata, parentAction)) ||
        (parentAction == "put" && checkIfCascadingAllow(relMetadata, "post"))) {
        asyncTask = [...asyncTask,entitiesResolvers(newObjs, "bulkPost", params)]
    }

    if (checkIfCascadingAllow(relMetadata, parentAction)) {
        exsitingsValObjects.forEach((objToBeStackAdded: CrudEntity) => {
            let modelName = obj.getRepo().modelName();
            if (!objToBeStackAdded.__callStack) {
                objToBeStackAdded.__callStack = { key: "callStack", callStack: [] };
            }
            if (!objToBeStackAdded.__callStack.callStack) {
                objToBeStackAdded.__callStack.callStack = [];
            }
            objToBeStackAdded.__callStack.callStack.push({ objType: modelName, _id: obj._id.toString() });
        })
        asyncTask = [...asyncTask,
            entitiesResolvers(exsitingsValObjects, applicableAction, params)]
    }
    else {
        newVal = exsitingsValObjects;
    }
    if (searchObj && searchObj.length) {
        asyncTask = [...asyncTask, mongooseModel.findMany(relModel, searchObj).then(res => {
            newVal = relMetadata.propertyType.isArray ? newVal.concat(res) : (res[0] ? res[0] : newVal);
        })]
    }

    return Q.allSettled(asyncTask).then((res:Array<any>) => {
        if (res && res.length) {
            res = res.map((result) => { return result && result.value });
            res.forEach((result: Array<any>) => {
                if (result) {
                    newVal = newVal.concat(result);
                }
            })
            if (!relMetadata.propertyType.isArray) {
                newVal = newVal[0];
            }
            obj[prop] = embedSelectedPropertiesOnly(params, newVal);
        }
    });
}


function entitiesResolvers(entities, action, params) {
    return new Promise((resolved, reject) => {
        if (!entities || (entities && entities instanceof Array && entities.length <= 0)) {
            resolved(undefined);
        }
        else {
            entities[action]().then(result => {
                if (result instanceof Array) {
                    if (!params.embedded) {
                        result = Enumerable.from(result).select(x => x['_id']).toArray()
                    }                   
                }
                else {
                    result = !params.embedded ? [result['_id']] : [result];
                }
                resolved(result);
            })
        }
    });
}



//
//obj - parent object
//prop - property key in obj
//relMetadata - decoration information of reltion
//parentAction -action on parent(post,put,patch,delete)
//
function embedChild_old(obj, prop, relMetadata: MetaData, parentAction?: string): Q.Promise<any> {
    if (!obj[prop])
        return;
    if (relMetadata.propertyType.isArray && !(obj[prop] instanceof Array)) {
        winstonLog.logError('Expected array, found non-array');
        throw 'Expected array, found non-array';
    }
    if (!relMetadata.propertyType.isArray && (obj[prop] instanceof Array)) {
        winstonLog.logError('Expected single item, found array');
        throw 'Expected single item, found array';
    }
    let isCascade = checkIfCascadingAllow(relMetadata, parentAction);

    var createNewObj = [];
    var params: IAssociationParams = <any>relMetadata.params;
    var relModel = Utils.getCurrentDBModel(params.rel);
    var val = obj[prop];
    var newVal = val; // updated value after cascading complete
    
    var asyncTask = [];
    if (relMetadata.propertyType.isArray) {
        newVal = [];
        var exsitingsVals = []; // updated value after cascading complete
        var objs = [];//obejcts to be created
        var searchObj = []; // if child is mentioned with id not as actual object (for embedded it need to pull from DB)
        // val is child
        
        for (var i in val) {
            //val[i] each element in array
            if (CoreUtils.isJSON(val[i])) {
                if (val[i]['_id']) {
                    val[i]['_id'] = Utils.castToMongooseType(val[i]['_id'], Mongoose.Types.ObjectId);
                    if (params.embedded) {
                        exsitingsVals.push(val[i]);
                        //newVal.push(val[i]);
                    }
                    else {
                        exsitingsVals.push(val[i]['_id']);
                    }
                }
                else {
                    objs.push(val[i]);
                }
            }
            else {
                if (!params.embedded) {
                    exsitingsVals.push(Utils.castToMongooseType(val[i], Mongoose.Types.ObjectId));
                }
                else {
                    searchObj.push(val[i]);
                }
            }
        }
        //till now newVal will have existing items with Ids
        if (exsitingsVals.length ) {
            //action post do nothing
            if (isCascade && parentAction && (parentAction == "put" || parentAction == "patch" || parentAction == "post")) {
                let bulkAction = parentAction == "put" ? "bulkPut" : ("post" ? "bulkPost": " bulkPatch");
                asyncTask.push(exsitingsVals[bulkAction]().then(result => {
                    if (params.embedded) {
                        newVal = newVal.concat(result);
                    }
                    else {
                        newVal = newVal.concat(Enumerable.from(result).select(x => x['_id']).toArray());
                    }
                }));
            }
            else {
                newVal = [...newVal, ...exsitingsVals];
            }
            //on put or patch newVal.BulkUpate and tell method not to update obj
        }

        if (objs.length > 0) {
            //TODO :- cascade replace with actual repo call
            //new items will be alwasys get created
            asyncTask.push(objs.bulkPost().then(result => {
                if (params.embedded) {
                    newVal = newVal.concat(result);
                }
                else {
                    newVal = newVal.concat(Enumerable.from(result).select(x => x['_id']).toArray());
                }
            }));
        }

        if (searchObj.length > 0) {
            asyncTask.push(mongooseModel.findMany(relModel, searchObj).then(res => {
                newVal = newVal.concat(res);
            }));
        }
    }
    else {
        if (CoreUtils.isJSON(val)) {
            if (val['_id']) {
                if (params.embedded) {
                    val['_id'] = Utils.castToMongooseType(val['_id'], Mongoose.Types.ObjectId);
                    asyncTask.push(mongooseModel.findMany(relModel, [val['_id']]).then(res => {
                        newVal = res[0];
                    }));
                    //newVal = val;
                }
                else {
                    newVal = Utils.castToMongooseType(val['_id'], Mongoose.Types.ObjectId);
                }
            }
            else {
                //TODO:- cascade , replac with repo's post
                // check if cascade defined other check for embed (set cascade post true)
                //if cascade is false then 
                asyncTask.push(val.post().then(res => {
                    if (params.embedded) {
                        newVal = res;
                    }
                    else {
                        newVal = res['_id'];
                    }
                }));
            }
        }
        else {
            if (!params.embedded) {
                newVal = Utils.castToMongooseType(val, Mongoose.Types.ObjectId);
            }
            else {
                asyncTask.push(mongooseModel.findMany(relModel, [val]).then(res => {
                    newVal = res[0];
                }));
            }
        }
    }

    return Q.allSettled(asyncTask).then(res => {
        obj[prop] = embedSelectedPropertiesOnly(params, newVal);
    });
}

function embedSelectedPropertiesOnly(params: IAssociationParams, result: any) {
    if (result && params.properties && params.properties.length > 0 && params.embedded) {
        if (result instanceof Array) {
            var newResult = [];
            result.forEach(x => {
                newResult.push(trimProperties(x, params.properties));
            });
            return newResult;
        }
        else {
            return trimProperties(result, params.properties);
        }
    }
    return result;
}

function trimProperties(data, props: Array<string>) {
    var updated = {};
    updated['_id'] = data['_id'];
    props.forEach(p => {
        if (data[p]) {
            updated[p] = data[p];
        }
    });
    return updated;
}

function getFilteredValues(values: [any], properties: [string]) {
    var result = [];
    values.forEach(x => {
        var val = getFilteredValue(x, properties);
        if (val) {
            result.push(val);
        }
    });
    return result;
}

function getFilteredValue(value, properties: [string]) {
    if (properties && properties.length > 0) {
        var json = {};
        if (value['_id']) {
            json['_id'] = value['_id'];
        }
        properties.forEach(x => {
            if (value[x])
                json[x] = value[x];
        });
        if (JSON.stringify(json) == '{}') {
            return null;
        }
        return json;
    }
    else {
        return value;
    }
}

function castAndGetPrimaryKeys(obj, prop, relMetaData: MetaData): Array<any> {
    var primaryMetaDataForRelation = CoreUtils.getPrimaryKeyMetadata(relMetaData.target);

    if (!primaryMetaDataForRelation) {
        winstonLog.logError('primary key not found for relation');
        throw 'primary key not found for relation';
    }

    var primaryType = primaryMetaDataForRelation.getType();
    return obj[prop] instanceof Array
        ? Enumerable.from(obj[prop]).select(x => Utils.castToMongooseType(x, primaryType)).toArray()
        : [Utils.castToMongooseType(obj[prop], primaryType)];
}

