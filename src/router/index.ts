import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types/user.types'

// Routes accessibles par rôle (null = tout le monde authentifié)
const ROLE_ACCESS: Record<string, UserRole[] | null> = {
  '/dashboard': null,
  '/lots': null,
  '/lots/:id': null,
  '/alerts': null,
  '/monitoring': ['warehouse_manager', 'quality', 'hq'],
  '/farm': ['farm_manager'],
  '/farm/create-lot': ['farm_manager'],
  '/warehouse': ['warehouse_manager'],
  '/warehouse/movements': ['warehouse_manager'],
  '/quality': ['quality', 'hq'],
  '/supply-chain': ['supply_chain', 'hq'],
  '/hq': ['hq'],
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Public
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },

    // Commun à tous les rôles
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
    { path: '/lots', name: 'lots', component: () => import('@/views/lots/LotListView.vue') },
    { path: '/lots/:id', name: 'lot-detail', component: () => import('@/views/lots/LotDetailView.vue'), props: true },
    { path: '/alerts', name: 'alerts', component: () => import('@/views/alerts/AlertsView.vue') },

    // Monitoring (warehouse_manager, quality, hq)
    { path: '/monitoring', name: 'monitoring', component: () => import('@/views/monitoring/MonitoringView.vue') },

    // Farm Manager
    { path: '/farm', name: 'farm', component: () => import('@/views/roles/farm/FarmView.vue') },
    { path: '/farm/create-lot', name: 'farm-create-lot', component: () => import('@/views/roles/farm/CreateLotView.vue') },

    // Warehouse Manager
    { path: '/warehouse', name: 'warehouse', component: () => import('@/views/roles/warehouse/WarehouseView.vue') },
    { path: '/warehouse/movements', name: 'warehouse-movements', component: () => import('@/views/roles/warehouse/MovementsView.vue') },

    // Équipe Qualité
    { path: '/quality', name: 'quality', component: () => import('@/views/roles/quality/QualityView.vue') },

    // Supply Chain
    { path: '/supply-chain', name: 'supply-chain', component: () => import('@/views/roles/supply-chain/SupplyChainView.vue') },

    // Siège / HQ
    { path: '/hq', name: 'hq', component: () => import('@/views/roles/hq/HQView.vue') },

    // Fallback
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

// Navigation guard RBAC
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    if (auth.isAuthenticated) return '/dashboard'
    return true
  }

  if (!auth.isAuthenticated) {
    return '/login'
  }

  const role = auth.role
  if (role === 'admin') return true // admin can access every page
  for (const [pattern, allowedRoles] of Object.entries(ROLE_ACCESS)) {
    if (pathMatchesPattern(to.path, pattern)) {
      if (allowedRoles === null) return true
      if (role && allowedRoles.includes(role)) return true
      return '/dashboard'
    }
  }

  return true
})

function pathMatchesPattern(path: string, pattern: string): boolean {
  const regexStr = pattern.replace(/:[^/]+/g, '[^/]+')
  return new RegExp(`^${regexStr}$`).test(path)
}

export default router
