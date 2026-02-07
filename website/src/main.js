import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

import HomeView from './views/HomeView.vue'
import LeaderboardView from './views/LeaderboardView.vue'
import ModelView from './views/ModelView.vue'
import AmbiguousView from './views/AmbiguousView.vue'
import MethodologyView from './views/MethodologyView.vue'

const routes = [
  { path: '/', component: HomeView, name: 'home' },
  { path: '/leaderboard', component: LeaderboardView, name: 'leaderboard' },
  { path: '/model/:id', component: ModelView, name: 'model', props: true },
  { path: '/ambiguous', component: AmbiguousView, name: 'ambiguous' },
  { path: '/methodology', component: MethodologyView, name: 'methodology' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.mount('#app')
