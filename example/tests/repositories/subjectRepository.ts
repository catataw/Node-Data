import {repository, allowanonymous} from "../../src/core/decorators";
import {subject} from '../models/subject';
import {DynamicRepository} from '../../src/core/dynamic/dynamic-repository';
import {authorize} from '../../src/core/decorators/authorize';
import {preauthorize} from '../../src/core/decorators/preauthorize';
import {postfilter} from '../../src/core/decorators/postfilter';

@repository({path: 'subject', model: subject})
export default class CourseRepository extends DynamicRepository {

  //@authorize({ roles: ['ROLE_A'] })
  //@postfilter({ serviceName: "preauthservice", methodName: "PostFilter" })
  @preauthorize({serviceName: "preauthservice", methodName: "CanEdit"})//, params: { id: '#id', entity: '#entity', other: [false] } })
  @allowanonymous()
  findAll(): Q.Promise<any> {
    return super.findAll();
  }

  @preauthorize({serviceName: "preauthservice", methodName: "CanEdit1"})
  doProcess(id: any, val: any) {
    return 'success';
  }

  @preauthorize({serviceName: "preauthservice", methodName: "CanEdit1"})
  @postfilter({serviceName: "preauthservice", methodName: "PostFilter"})
  public findByField(fieldName, value): Q.Promise<any> {
    return super.findByField(fieldName, value);
  }
}
