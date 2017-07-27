import {repository} from "../../core/decorators";
import {city} from '../models/city';
import {school} from '../models/school';
import {DynamicRepository} from '../../core/dynamic/dynamic-repository';

@repository({ path: 'city', model: city })
export default class CityRepository extends DynamicRepository {

    doCreateCity(name: string) {
        return new Promise((resolved, reject) => {
            let newCity = new city();
            newCity.name = name;
            newCity.schools = new Array<school>();
            newCity.schools.push(new school());
            newCity.schools[0].name = name;

           // return [newCity].bulkPost();

            //newCity.save();

            newCity.post().then((sucess) => {
                resolved(sucess);
            }).catch((error) => {
                reject(error);
            })
            
        });
    }
}
