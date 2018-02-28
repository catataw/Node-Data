﻿import {repository} from "../../core/decorators";
import {employee} from '../models/employee';
import {DynamicRepository} from '../../core/dynamic/dynamic-repository';

@repository({ path: 'employee', model: employee, sharded: true })
export default class EmployeeRepository extends DynamicRepository {

    getShardCondition() {
        return { category: 'A' };
    }
}
