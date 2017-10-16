import {repository} from "../../core/decorators";
import {city} from '../models/city';
import {DynamicRepository} from '../../core/dynamic/dynamic-repository';
import {AuthorizationRepository} from '../../repositories/authorizationRepository';
import { entityAction, EntityActionParam } from "../../core/decorators/entityAction";
import Q = require("q");

@repository({ path: 'city', model: city })
export default class CityRepository extends AuthorizationRepository {

    dotest() {
        return [new city()].bulkPost();
    }

    post(obj: any): Q.Promise<any> {
       return super.post(obj);
    }

    put(id: any, obj: any) {
        return super.put(id, obj);
    }

    preUpdate(params: EntityActionParam): Q.Promise<EntityActionParam> {
        let entity: city = params.newPersistentEntity;
        let age = entity.age;
        entity.age = age + 10;
        entity["ocean"] = "rew";
        entity.cityName["name1"] = "Ramgarh";
        entity.cityName["name3"]["v1"] = 1;
        return Q.resolve(params);
    }

}
