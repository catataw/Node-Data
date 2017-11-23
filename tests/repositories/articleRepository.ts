import {repository} from "../../core/decorators";
import {article} from '../models/article';
import {DynamicRepository} from '../../core/dynamic/dynamic-repository';

@repository({ path: 'article', model: article })
export default class ArticleRepository extends DynamicRepository {
}
