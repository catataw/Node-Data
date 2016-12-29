import {repository} from "../../src/core/decorators";
import {city} from '../models/city';
import {DynamicRepository} from '../../src/core/dynamic/dynamic-repository';

@repository({path: 'city', model: city})
export default class CityRepository extends DynamicRepository {
}
