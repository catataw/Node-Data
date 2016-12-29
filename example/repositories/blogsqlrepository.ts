//import * as Express from "express";
import * as decorator from "../src/core/decorators/repository";
import {BlogSqlModel} from '../example/models/blogSqlModel';

@decorator.repository({path: 'story', model: BlogSqlModel})
//@decorator.repository('blog', BlogModel)
export default class BlogSqlRepository {

  constructor() {
    //super(RoleRepository.path, role.IRole);
    //new BaseRepository1(this.path, User1);
  }
}
