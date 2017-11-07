var mongoosastic = require("mongoosastic");
var elasticsearch = require("elasticsearch");
import * as CoreUtils from '../core/utils';

/**
 * ElastticSearchUtils
 */
class ElastticSearchUtils {
    private esClient: any;
    constructor() {
    }

    getESConnection() {
        if (!this.esClient) {
            this.esClient = new elasticsearch.Client({ host: CoreUtils.config().Config.ElasticSearchConnection });
        }
        return this.esClient;
    }

    insertMongoosasticToSchema(schema: any) {
        if (CoreUtils.config().Config.ApplyElasticSearch) {
            schema.plugin(mongoosastic, {
                esClient: this.getESConnection()
            });
        }
    }

    registerToMongoosastic(mongooseModel: any) {
        // This will be called only in the case if the mongoosastic plugin was attached to the mongoose model.
        if (CoreUtils.config().Config.ApplyElasticSearch && mongooseModel.createMapping) {
            mongooseModel.createMapping((err: any, mapping: any) => {
                if (err) {
                    console.error(err);
                }
                else {
                    console.log(mapping);
                }
            });
        }
    }
}

export var searchUtils = new ElastticSearchUtils();