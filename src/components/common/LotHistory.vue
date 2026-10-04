<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { historyService } from '@/services/history.service'
import { geoService } from '@/services/geo.service'
import type { HistoryEntry, HistoryType } from '@/types/history.types'

const props = defineProps<{ lotId: string; warehouseId?: string; countryId?: string }>()

const entries = ref<HistoryEntry[]>([])
const zoneNames = ref<Record<string, string>>({})
const typeFilter = ref<HistoryType | ''>('')
const loading = ref(false)
const error = ref('')

const TYPE_LABELS: Record<string, string> = {
  TRANSFERT: 'Transfer',
  ALERTE: 'Alert',
  SHIPPED: 'Shipped',
}

function typeLabel(t: string) {
  return TYPE_LABELS[t.toUpperCase()] ?? t
}

// Falls back to the raw id when the zone is not in the lot's warehouse
function zoneLabel(id?: string) {
  if (!id) return '-'
  return zoneNames.value[id] ?? id
}

async function loadZoneNames() {
  if (!props.warehouseId) return
  try {
    const zones = await geoService.getZones(props.warehouseId, props.countryId)
    zoneNames.value = Object.fromEntries(zones.map((z) => [z.id, z.name]))
  } catch {
    zoneNames.value = {}
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    entries.value = await historyService.getLotHistory(props.lotId, typeFilter.value || undefined)
  } catch {
    entries.value = []
    error.value = 'Unable to load history'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadZoneNames()
  load()
})
watch(typeFilter, load)
</script>

<template>
  <div class="history">
    <div class="history-header">
      <h3>History</h3>
      <select v-model="typeFilter" aria-label="Filter history by type">
        <option value="">- All types -</option>
        <option value="TRANSFERT">Transfer</option>
        <option value="ALERTE">Alert</option>
        <option value="SHIPPED">Shipped</option>
      </select>
    </div>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!entries.length" class="muted">No history for this lot</p>

    <table v-else class="history-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Previous zone</th>
          <th>Current zone</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in entries" :key="e.id">
          <td>{{ new Date(e.date).toLocaleString('en-US') }}</td>
          <td><span class="type" :class="`type--${e.type.toLowerCase()}`">{{ typeLabel(e.type) }}</span></td>
          <td>{{ zoneLabel(e.previous_zone_id) }}</td>
          <td>{{ zoneLabel(e.current_zone_id) }}</td>
          <td>{{ e.detail ?? '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.history { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; }
.history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }
select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; }
.history-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.history-table th { text-align: left; color: #6b7280; font-weight: 500; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
.history-table td { padding: 8px; border-bottom: 1px solid #f3f4f6; word-break: break-word; }
.type { padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: #e5e7eb; color: #374151; }
.type--alerte { background: #fee2e2; color: #b91c1c; }
.type--transfert { background: #dbeafe; color: #1d4ed8; }
.type--shipped { background: #dcfce7; color: #15803d; }
.muted { color: #6b7280; margin: 0; font-size: 0.875rem; }
.error { color: #dc2626; margin: 0; font-size: 0.875rem; }
</style>
