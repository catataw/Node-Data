//import * as Express from "express";
import * as decorator from "../src/core/decorators/repository";
import {StoryModel} from '../example/models/storyModel';

@decorator.repository({path: 'story', model: StoryModel})
//@decorator.repository('blog', BlogModel)
export default class StorySqlRepository {

  constructor() {
    //super(RoleRepository.path, role.IRole);
    //new BaseRepository1(this.path, User1);
  }
}
