import App from './App.vue';
import { createApp } from 'vue';
const app = createApp(App);


import MyTable from './components/general/MyTable.vue';
import MyEmptyContainer from './components/general/MyEmptyContainer.vue';
import MyDoughnutChart from './components/general/MyDoughnutChart.vue';
app.component('MyTable', MyTable);
app.component('MyEmptyContainer', MyEmptyContainer);
app.component('MyDoughnutChart', MyDoughnutChart);


// import "@/assets/test.vscode.css";
import "@/assets/style.css";

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEye } from '@fortawesome/free-regular-svg-icons';
library.add(faEye);
app.component('font-awesome-icon', FontAwesomeIcon);


import { createPinia } from 'pinia';
app.use(createPinia());

app.mount('#app');
