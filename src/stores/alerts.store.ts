import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { alertsService } from '@/services/alerts.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Alert } from '@/types/alert.types'

const POLL_INTERVAL_MS = 30_000

export const useAlertsStore = defineStore('alerts', () => {
  const alerts = ref<Alert[]>([])
  const loading = ref(false)
  let _pollingTimer: ReturnType<typeof setInterval> | null = null

  const unreadCount = computed(() => alerts.value.filter((a) => !a.is_read && a.is_active).length)

  async function fetchAlerts() {
    loading.value = true
    try {
      const authStore = useAuthStore()
      const res = await alertsService.getAlerts({
        active: true,
        limit: 100,
        // pas de pays => tous les pays ; le service interroge chaque entrepôt
        country_id: authStore.autoFilters.country_id,
      })
      alerts.value = res.data
    } catch {
      // silent - don't interrupt the UX during polling
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(id: string) {
    try {
      await alertsService.markAsRead(id)
    } catch {
      // endpoint absent du backend - mise à jour locale uniquement
    }
    const alert = alerts.value.find((a) => a.id === id)
    if (alert) alert.is_read = true
  }

  function startPolling() {
    fetchAlerts()
    _pollingTimer = setInterval(fetchAlerts, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (_pollingTimer) {
      clearInterval(_pollingTimer)
      _pollingTimer = null
    }
  }

  return { alerts, loading, unreadCount, fetchAlerts, markAsRead, startPolling, stopPolling }
})
