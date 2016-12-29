import {repository} from "../../src/core/decorators";
import {teacher} from '../models/teacher';
import {DynamicRepository} from '../../src/core/dynamic/dynamic-repository';

@repository({path: 'teacher', model: teacher})
export default class TeacherRepository extends DynamicRepository {
}
