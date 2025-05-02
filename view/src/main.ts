import App from './App.vue';
import { createApp } from 'vue';
const app = createApp(App);

// import "@/assets/test.vscode.css";
import "@/assets/style.css";

import { createPinia } from 'pinia';
app.use(createPinia());

app.mount('#app');
