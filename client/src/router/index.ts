import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('../views/TestView.vue'),
    },
    {
      path: '/result/:type',
      name: 'result',
      component: () => import('../views/ResultView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('../views/LegalView.vue'),
      meta: { doc: 'privacy' },
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('../views/LegalView.vue'),
      meta: { doc: 'terms' },
    },
    {
      path: '/refund',
      name: 'refund',
      component: () => import('../views/LegalView.vue'),
      meta: { doc: 'refund' },
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('../views/LegalView.vue'),
      meta: { doc: 'contact' },
    },
  ],
})

export default router
