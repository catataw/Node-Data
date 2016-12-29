import {repository} from "../../src/core/decorators";
import {school} from '../models/school';
import {DynamicRepository} from '../../src/core/dynamic/dynamic-repository';

@repository({path: 'school', model: school})
export default class SchoolRepository extends DynamicRepository {
}
