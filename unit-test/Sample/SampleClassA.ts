﻿import * as global from './GlobalObject';
import {B} from './SampleClassB';
import {service, inject} from '../../decorators';
import {AuthService} from '../../services/auth-service';

export class A {
    @inject()
    private authService: AuthService;

    constructor(B: B) {
        console.log(B.getName());
    }

    nestedGlobalFunctionCall() {
        var b_obj = new B();
        console.log(global.GetCounterValue());
    }

    nestedGlobalFunctionWithParam(val: number) {
        console.log(global.GetSquare(val));
    }

    authenticate(): boolean {
        this.authService.authenticate();
        return true;
    }
}