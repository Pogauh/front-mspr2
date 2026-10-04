<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { lotsService } from '@/services/lots.service'
import { useAuthStore } from '@/stores/auth.store'
import { storeToRefs } from 'pinia'
import type { Lot } from '@/types/lot.types'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ThresholdDot from '@/components/common/ThresholdDot.vue'
import ReadingChart from '@/components/charts/ReadingChart.vue'
import LotHistory from '@/components/common/LotHistory.vue'

const props = defineProps<{ id: string }>()

const { autoFilters } = storeToRefs(useAuthStore())

const lot = ref<Lot | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    lot.value = await lotsService.getLot(props.id, autoFilters.value.country_id)
  } catch {
    error.value = 'Lot not found'
  } finally {
    loading.value = false
  }
})

function formatDate(d: string | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US')
}
</script>

<template>
  <div class="page">
    <RouterLink to="/lots" class="back-link">← Back to lots</RouterLink>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="lot">
      <div class="lot-header">
        <div>
          <h2>Lot {{ lot.batch_number }}</h2>
          <p class="sub">{{ lot.farm_name }} · {{ lot.country_name }}</p>
        </div>
        <StatusBadge :status="lot.status" />
      </div>

      <!-- Infos -->
      <div class="info-grid">
        <div class="info-block">
          <h3>Information</h3>
          <table class="info-table">
            <tr><td>Lot ID</td><td class="mono">{{ lot.id }}</td></tr>
            <tr><td>Quantity</td><td>{{ lot.quantity ?? '-' }}</td></tr>
            <tr><td>Characteristic</td><td>{{ lot.characteristic ?? '-' }}</td></tr>
            <tr><td>Farm</td><td>{{ lot.farm_name ?? '-' }}</td></tr>
            <tr><td>Farm ID</td><td class="mono">{{ lot.farm_id || '-' }}</td></tr>
            <tr><td>Country</td><td>{{ lot.country_name ?? '-' }}</td></tr>
            <tr><td>Warehouse</td><td>{{ lot.warehouse_name ?? '-' }}</td></tr>
            <tr><td>Warehouse ID</td><td class="mono">{{ lot.warehouse_id ?? '-' }}</td></tr>
            <tr><td>Zone</td><td>{{ lot.zone_name ?? '-' }}</td></tr>
            <tr><td>Zone ID</td><td class="mono">{{ lot.zone_id ?? '-' }}</td></tr>
            <tr><td>Production date</td><td>{{ formatDate(lot.production_date) }}</td></tr>
            <tr><td>Storage date</td><td>{{ formatDate(lot.storage_date) }}</td></tr>
          </table>
        </div>

        <div class="info-block" v-if="lot.latest_reading">
          <h3>Latest IoT reading</h3>
          <div class="reading-card">
            <ThresholdDot :status="lot.latest_reading.threshold_status" :label="lot.latest_reading.threshold_status" />
            <div class="reading-values">
              <div><span class="measure-label">Temperature</span> <strong>{{ lot.latest_reading.temperature.toFixed(1) }}°C</strong></div>
              <div><span class="measure-label">Humidity</span> <strong>{{ lot.latest_reading.humidity.toFixed(0) }}%</strong></div>
              <div class="measure-date">{{ new Date(lot.latest_reading.recorded_at).toLocaleString('en-US') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Courbes -->
      <div class="chart-section">
        <h3>Temperature & humidity history</h3>
        <ReadingChart :lot-id="lot.id" />
      </div>

      <!-- Historique -->
      <div class="chart-section">
        <LotHistory :lot-id="lot.id" :warehouse-id="lot.warehouse_id" :country-id="lot.country_id" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 2rem; max-width: 1100px; margin: 0 auto; }
.back-link { color: #15803d; text-decoration: none; font-size: 0.875rem; }
.lot-header { display: flex; align-items: flex-start; justify-content: space-between; margin: 1rem 0 1.5rem; }
h2 { margin: 0 0 0.25rem; font-size: 1.5rem; }
.sub { margin: 0; color: #6b7280; font-size: 0.9rem; }
.loading, .error { padding: 2rem; text-align: center; color: #6b7280; }
.error { color: #dc2626; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
@media (max-width: 768px) { .info-grid { grid-template-columns: 1fr; } }
.info-block { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; }
h3 { margin: 0 0 0.75rem; font-size: 0.95rem; font-weight: 600; color: #374151; }
.info-table { width: 100%; font-size: 0.875rem; border-collapse: collapse; }
.info-table td { padding: 5px 0; }
.info-table td:first-child { color: #6b7280; width: 140px; }
.info-table .mono { font-family: monospace; font-size: 0.8rem; word-break: break-all; }
.reading-card { display: flex; align-items: flex-start; gap: 1rem; }
.reading-values { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.9rem; }
.measure-label { color: #6b7280; font-size: 0.8rem; }
.measure-date { font-size: 0.78rem; color: #9ca3af; margin-top: 4px; }
.chart-section { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; }
</style>
