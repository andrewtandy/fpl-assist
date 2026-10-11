import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useFplStore } from './stores/fpl.ts'
import './style.css'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')

if (import.meta.env.DEV) {
  (window as any).store = useFplStore();
}