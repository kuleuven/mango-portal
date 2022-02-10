//import * as bootstrap from 'bootstrap';
import Vue from "vue/dist/vue.min";
import Welcome from "./components/Welcome";
import hello from "./components/hello";
import TreeBrowser from "./components/TreeBrowser";


var app = new Vue({
    el: '#app',
    components : {
        Welcome,
        hello,
        TreeBrowser,
    }
})
