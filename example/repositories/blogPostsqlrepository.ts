//import * as Express from "express";
import * as decorator from "../src/core/decorators/repository";
import {BlogPostSqlModel} from '../example/models/blogPostSqlModel';

@decorator.repository({path: 'blogPosts', model: BlogPostSqlModel})
//@decorator.repository('blog', BlogModel)
export default class BlogPostSqlRepository {

  constructor() {
    //super(RoleRepository.path, role.IRole);
    //new BaseRepository1(this.path, User1);
  }
}
