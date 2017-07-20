export interface IAssociationParams {
    rel: string,
    itemType: Object,
    embedded: boolean,
    eagerLoading: boolean,
    deleteCascade?: boolean,
    properties?: [string],
    persist?: boolean,
    cascadeType?: ICascadeTypeParams
}



export interface ICascadeTypeParams {
    cascadeAll: boolean,
    //-----default {for embedded true , else it will be false and developer need to set it }-------
    cascadeDelete: boolean, 
    cascadePut: boolean,
    cascadePatch: boolean,
    cascadePost: boolean,
    //---------------------------------------------------------------------------------------------
}