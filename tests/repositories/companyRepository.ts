import {repository} from "../../core/decorators";
import {company} from '../models/company';
import {DynamicRepository} from '../../core/dynamic/dynamic-repository';

@repository({ path: 'company', model: company, sharded: true })
export default class CompanyRepository extends DynamicRepository {
    getShardCondition() {
        return { category: 'A' };
    }
}
