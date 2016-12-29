import {repository} from "../../src/core/decorators";
import {RoleModel} from '../models/rolemodel';
import {DynamicRepository} from '../../src/core/dynamic/dynamic-repository';
import {authorize} from '../../src/core/decorators/authorize';
import {preauthorize} from '../../src/core/decorators/preauthorize';
var Q = require('q');

@repository({path: 'roles', model: RoleModel})
export default class RoleRepository extends DynamicRepository {

}
