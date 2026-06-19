import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { vMagnet } from './directives/magnet'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('magnet', vMagnet)
app.mount('#app')
