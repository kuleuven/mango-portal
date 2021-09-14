//import * as bootstrap from 'bootstrap';
import Vue from "vue";
import Welcome from "./components/Welcome";
import hello from "./components/hello";

var app = new Vue({
    el: '#app',
    components : {
        Welcome,
        hello
    }

})
