<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'
import AlertBadge from './AlertBadge.vue'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const router = useRouter()
const { user, role } = storeToRefs(authStore)

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="nav">
    <div class="nav-brand">
      <RouterLink to="/dashboard" class="brand-link">🌿 FutureKawa</RouterLink>
    </div>

    <ul class="nav-links">
      <!-- Warehouse Manager -->
      <template v-if="role === 'warehouse_manager'">
        <li>
          <RouterLink to="/warehouse">Warehouse</RouterLink>
        </li>
        <li>
          <RouterLink to="/monitoring">Monitoring</RouterLink>
        </li>
      </template>

      <!-- HQ / Siège -->
      <template v-if="role === 'hq' || role === 'admin'">
        <li>
          <RouterLink to="/quality">Quality</RouterLink>
        </li>
        <li>
          <RouterLink to="/supply-chain">Supply Chain</RouterLink>
        </li>
      </template>

      <!-- Admin: every other page -->
      <template v-if="role === 'admin'">
        <li><RouterLink to="/hq">HQ</RouterLink></li>
        <li><RouterLink to="/farm">Farm</RouterLink></li>
        <li><RouterLink to="/warehouse">Warehouse</RouterLink></li>
        <li><RouterLink to="/monitoring">Monitoring</RouterLink></li>
      </template>
      <li>
        <RouterLink to="/lots" v-if="role === 'quality' || role === 'warehouse_manager' || role === 'supply_chain' || role === 'admin'">
          Lots
        </RouterLink>
      </li>
    </ul>

    <div class="nav-right">
      <AlertBadge v-if="role === 'warehouse_manager'" />
      <a href="/user-guide.pdf" target="_blank" rel="noopener" class="btn-help" title="User guide">
        ? Help
      </a>
      <span class="user-info">{{ user?.name }} · <em>{{ user?.role }}</em></span>
      <button class="btn-logout" @click="handleLogout">Log out</button>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.5rem;
  height: 56px;
  background: #1a2e1a;
  color: white;
  position: sticky;
  top: 0;
  z-index: 100;
}

.brand-link {
  color: white;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.1rem;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 1rem;
  margin: 0;
  padding: 0;
  flex: 1;
}

.nav-links a {
  color: #c1d1c1;
  text-decoration: none;
  font-size: 0.9rem;
}

.nav-links a.router-link-active {
  color: white;
  font-weight: 600;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.user-info {
  font-size: 0.82rem;
  color: #9cb09c;
}

.user-info em {
  color: #6ee7b7;
  font-style: normal;
}

.btn-logout {
  background: transparent;
  border: 1px solid #4a7a4a;
  color: #c1d1c1;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.82rem;
}

.btn-logout:hover {
  background: #2d4a2d;
}

.btn-help {
  background: transparent;
  border: 1px solid #4a7a4a;
  color: #c1d1c1;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.82rem;
  text-decoration: none;
}

.btn-help:hover {
  background: #2d4a2d;
  color: white;
}
</style>
