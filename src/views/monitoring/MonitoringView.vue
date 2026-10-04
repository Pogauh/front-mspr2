<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFiltersStore } from '@/stores/filters.store'
import { useAuthStore } from '@/stores/auth.store'
import { readingsService } from '@/services/readings.service'
import { geoService } from '@/services/geo.service'
import type { WarehouseReadingSummary } from '@/types/reading.types'
import type { Warehouse } from '@/types/geo.types'
import ThresholdDot from '@/components/common/ThresholdDot.vue'
import ReadingChart from '@/components/charts/ReadingChart.vue'
import { storeToRefs } from 'pinia'

const filtersStore = useFiltersStore()
const { warehouseId } = storeToRefs(filtersStore)
const { autoFilters } = storeToRefs(useAuthStore())

const warehouses = ref<Warehouse[]>([])
const selectedWarehouseId = ref<string | undefined>(undefined)
const summary = ref<WarehouseReadingSummary | null>(null)
const selectedZoneId = ref<string | undefined>(undefined)
const loading = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const selectedCountryId = computed(
  () => warehouses.value.find((w) => w.id === selectedWarehouseId.value)?.country_id,
)

async function loadWarehouses() {
  // A user bound to a country only sees the warehouses of that country
  warehouses.value = await geoService.getWarehouses({ country_id: autoFilters.value.country_id })
  const stored = warehouses.value.find((w) => w.id === warehouseId.value)
  selectedWarehouseId.value = stored?.id ?? warehouses.value[0]?.id
  if (selectedWarehouseId.value) loadSummary()
}

async function loadSummary() {
  if (!selectedWarehouseId.value) return
  const warehouse = warehouses.value.find((w) => w.id === selectedWarehouseId.value)
  loading.value = true
  try {
    summary.value = await readingsService.getWarehouseSummary(selectedWarehouseId.value, warehouse?.country_id)
  } catch {
    summary.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadWarehouses()
  pollTimer = setInterval(loadSummary, 30_000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

function selectWarehouse(id: string) {
  selectedWarehouseId.value = id
  selectedZoneId.value = undefined
  summary.value = null
  loadSummary()
}

function selectZone(id: string) {
  selectedZoneId.value = selectedZoneId.value === id ? undefined : id
}
</script>

<template>
  <div class="page">
    <h2>Real-time monitoring</h2>
    <p class="subtitle">Auto-refresh every 30 seconds</p>

    <div class="warehouse-tabs">
      <button v-for="w in warehouses" :key="w.id" class="tab" :class="{ 'tab--active': selectedWarehouseId === w.id }"
        @click="selectWarehouse(w.id)">
        {{ w.name }}
      </button>
    </div>

    <div v-if="loading && !summary" class="loading">Loading…</div>

    <template v-else-if="summary">
      <div class="zones-grid">
        <div v-for="zone in summary.zones" :key="zone.zone_id" class="zone-card" :class="{
          'zone-card--ok': zone.threshold_status === 'ok',
          'zone-card--warn': zone.threshold_status === 'warn',
          'zone-card--alert': zone.threshold_status === 'alert',
          'zone-card--selected': selectedZoneId === zone.zone_id,
        }" @click="selectZone(zone.zone_id)">
          <div class="zone-name">{{ zone.zone_name }}</div>
          <ThresholdDot :status="zone.threshold_status" />
          <div class="zone-values">
            <span>🌡 {{ zone.temperature.toFixed(1) }}°C</span>
            <span>💧 {{ zone.humidity.toFixed(0) }}%</span>
          </div>
          <div class="zone-date">{{ new Date(zone.recorded_at).toLocaleTimeString('en-US') }}</div>
        </div>
      </div>

      <div v-if="selectedZoneId" class="chart-section">
        <h3>History - Selected zone</h3>
        <ReadingChart :zone-id="selectedZoneId" :country-id="selectedCountryId" />
      </div>
      <p v-else class="chart-hint">Click on a zone to display its history</p>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  margin: 0 0 0.25rem;
}

.subtitle {
  color: #6b7280;
  font-size: 0.85rem;
  margin: 0 0 1.5rem;
}

.warehouse-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.tab {
  padding: 8px 18px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}

.tab--active {
  background: #1a2e1a;
  color: white;
  border-color: #1a2e1a;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.zone-card {
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  background: white;
}

.zone-card:hover {
  transform: translateY(-2px);
}

.zone-card--ok {
  border-color: #86efac;
  background: #f0fdf4;
}

.zone-card--warn {
  border-color: #fcd34d;
  background: #fffbeb;
}

.zone-card--alert {
  border-color: #fca5a5;
  background: #fef2f2;
}

.zone-card--selected {
  outline: 3px solid #15803d;
}

.zone-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.zone-values {
  display: flex;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.zone-date {
  font-size: 0.75rem;
  color: #9ca3af;
}

.chart-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
}

h3 {
  margin: 0 0 1rem;
  font-size: 0.95rem;
}

.chart-hint {
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  margin-top: 1rem;
}
</style>
