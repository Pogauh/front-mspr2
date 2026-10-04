<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useAlertsStore } from '@/stores/alerts.store'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const alertsStore = useAlertsStore()
const { user, role } = storeToRefs(authStore)
const { unreadCount, alerts } = storeToRefs(alertsStore)

const activeAlerts = computed(() => alerts.value.filter((a) => a.is_active && !a.is_read).slice(0, 5))

const roleLabel: Record<string, string> = {
  farm_manager: 'Farm Manager',
  warehouse_manager: 'Warehouse Manager',
  quality: 'Quality Team',
  supply_chain: 'Supply Chain',
  hq: 'HQ / Management',
  admin: 'Administrator',
}

const quickLinks = computed(() => {
  const base = [{ to: '/lots', label: 'View lots' }, { to: '/alerts', label: 'View alerts' }]
  const roleLinks: Record<string, { to: string; label: string }[]> = {
    farm_manager: [{ to: '/farm/create-lot', label: 'Create a lot' }, { to: '/farm', label: 'My Farm' }],
    warehouse_manager: [{ to: '/warehouse', label: 'Warehouse' }, { to: '/monitoring', label: 'Monitoring' }],
    quality: [{ to: '/quality', label: 'Quality' }, { to: '/monitoring', label: 'Monitoring' }],
    supply_chain: [{ to: '/supply-chain', label: 'Supply Chain' }],
    hq: [{ to: '/hq', label: 'Global reporting' }],
    admin: [
      { to: '/hq', label: 'Global reporting' },
      { to: '/farm', label: 'Farm' },
      { to: '/warehouse', label: 'Warehouse' },
      { to: '/quality', label: 'Quality' },
      { to: '/supply-chain', label: 'Supply Chain' },
      { to: '/monitoring', label: 'Monitoring' },
    ],
  }
  return [...base, ...(role.value ? (roleLinks[role.value] ?? []) : [])]
})
</script>

<template>
  <div class="dashboard">
    <div class="hero">
      <h2>Hello, {{ user?.name }}</h2>
      <p class="role-label">{{ roleLabel[role ?? ''] ?? role }}</p>
    </div>

    <!-- KPI cards -->
    <div class="cards">
      <div class="card card--alert">
        <div class="card-value">{{ unreadCount }}</div>
        <div class="card-label">Unread alerts</div>
      </div>
      <RouterLink to="/lots" class="card card--link">
        <div class="card-value">→</div>
        <div class="card-label">View lots</div>
      </RouterLink>
    </div>

    <!-- Raccourcis -->
    <section class="quick-links">
      <h3>Quick access</h3>
      <div class="links-grid">
        <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="quick-link">
          {{ link.label }}
        </RouterLink>
      </div>
    </section>

    <!-- Dernières alertes actives -->
    <section v-if="activeAlerts.length" class="recent-alerts">
      <h3>Recent alerts</h3>
      <ul>
        <li v-for="alert in activeAlerts" :key="alert.id" class="alert-item">
          <span class="alert-type" :class="`alert-type--${alert.type}`">{{ alert.type }}</span>
          {{ alert.message }}
          <span class="alert-date">{{ new Date(alert.created_at).toLocaleDateString('en-US') }}</span>
        </li>
      </ul>
      <RouterLink to="/alerts" class="see-all">View all alerts →</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 2rem;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero h2 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.role-label {
  color: #6b7280;
  margin: 0;
  font-size: 0.9rem;
}

.cards {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.card {
  flex: 1;
  min-width: 160px;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.card--alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.card-value {
  font-size: 2rem;
  font-weight: 700;
  color: #b91c1c;
}

.card-label {
  font-size: 0.875rem;
  color: #374151;
}

.card--link {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  text-decoration: none;
  color: inherit;
}

.card--link .card-value {
  color: #15803d;
}

h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.links-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.quick-link {
  padding: 10px 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-decoration: none;
  color: #374151;
  font-size: 0.9rem;
  transition: border-color 0.15s, background 0.15s;
}

.quick-link:hover {
  border-color: #15803d;
  background: #f0fdf4;
  color: #15803d;
}

.recent-alerts ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #fff7ed;
  border-radius: 8px;
  font-size: 0.875rem;
}

.alert-type {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fed7aa;
  color: #92400e;
}

.alert-type--threshold {
  background: #fecaca;
  color: #991b1b;
}

.alert-type--expiry {
  background: #fde68a;
  color: #92400e;
}

.alert-type--fifo {
  background: #c7d2fe;
  color: #3730a3;
}

.alert-date {
  margin-left: auto;
  color: #9ca3af;
  font-size: 0.8rem;
}

.see-all {
  display: inline-block;
  margin-top: 0.75rem;
  color: #15803d;
  text-decoration: none;
  font-size: 0.875rem;
}
</style>
