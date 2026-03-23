import { createApp } from "vue";
import { pinia } from "./stores";
import router from "./router";
import App from "./App.vue";

// Naive UI 字体
import "vfonts/Lato.css";
import "vfonts/FiraCode.css";

import "./assets/main.css";

const app = createApp(App);

app.use(pinia);
app.use(router);

app.mount("#app");
