<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { reportingService } from '@/services/reporting.service'
import { geoService } from '@/services/geo.service'
import type { GlobalReport } from '@/types/reporting.types'

interface CountryRow {
  country_id: string
  country_name: string
  total_lots: number
  compliance_rate: number
  active_alerts: number
}

const globalReport = ref<GlobalReport | null>(null)
const activeAlertsCount = ref(0)
const byCountry = ref<CountryRow[]>([])
const loading = ref(false)

const fromDate = ref(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
const toDate = ref(new Date().toISOString().slice(0, 10))

async function fetchReports() {
  loading.value = true
  try {
    const [gr, qr, countries] = await Promise.all([
      reportingService.getGlobal(),
      reportingService.getQuality({ from: fromDate.value, to: toDate.value }),
      geoService.getCountries(),
    ])
    globalReport.value = gr
    activeAlertsCount.value = qr.total_alerts

    // Par pays : stock + qualité en parallèle
    const perCountry = await Promise.all(
      countries.map(async (c) => {
        const [stock, quality] = await Promise.all([
          reportingService
            .getStock({ country_id: c.id })
            .catch(() => ({ total_lots: 0, fifo_at_risk: 0, by_status: {}, by_country: [] })),
          reportingService
            .getQuality({ country_id: c.id, from: fromDate.value, to: toDate.value })
            .catch(() => ({ compliance_rate: 0, total_alerts: 0, incidents: 0, by_zone: [] })),
        ])
        return { c, stock, quality }
      }),
    )

    byCountry.value = perCountry.map(({ c, stock, quality }) => ({
      country_id: c.id,
      country_name: c.name.charAt(0).toUpperCase() + c.name.slice(1).toLowerCase(),
      total_lots: stock.total_lots,
      compliance_rate: quality.compliance_rate,
      active_alerts: quality.total_alerts,
    }))
  } finally {
    loading.value = false
  }
}

onMounted(fetchReports)

function pct(n: number) {
  return `${(Math.min(Math.max(n, 0), 1) * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="page">
    <h2>Global Reporting - Headquarters</h2>

    <!-- Date range -->
    <div class="date-range">
      <label>From <input type="date" v-model="fromDate" /></label>
      <label>To <input type="date" v-model="toDate" /></label>
      <button @click="fetchReports">Refresh</button>
    </div>

    <div v-if="loading && !globalReport" class="loading">Loading…</div>

    <template v-else-if="globalReport">
      <!-- Global KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-val">{{ globalReport.kpis.total_lots }}</div>
          <div class="kpi-label">Total lots</div>
        </div>
        <div class="kpi-card" :class="globalReport.kpis.compliance_rate >= 0.9 ? 'kpi--green' : 'kpi--orange'">
          <div class="kpi-val">{{ pct(globalReport.kpis.compliance_rate) }}</div>
          <div class="kpi-label">Compliance rate</div>
        </div>
        <div class="kpi-card" :class="activeAlertsCount > 10 ? 'kpi--red' : ''">
          <div class="kpi-val">{{ loading ? '…' : activeAlertsCount }}</div>
          <div class="kpi-label">Active alerts</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">{{ Math.round(globalReport.kpis.avg_age_days) }}d</div>
          <div class="kpi-label">Avg. lot age</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">{{ globalReport.kpis.movements_last_30d }}</div>
          <div class="kpi-label">Movements (30d)</div>
        </div>
      </div>

      <!-- Country breakdown -->
      <div class="section">
        <h3>Country breakdown</h3>
        <div v-if="byCountry.length === 0" class="empty-msg">No data available by country.</div>
        <table v-else class="country-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>Lots</th>
              <th>Compliance</th>
              <th>Alerts</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in byCountry" :key="c.country_id">
              <td>{{ c.country_name }}</td>
              <td>{{ c.total_lots }}</td>
              <td :class="c.compliance_rate >= 0.9 ? 'good' : 'warn'">{{ pct(c.compliance_rate) }}</td>
              <td :class="c.active_alerts > 5 ? 'bad' : ''">{{ c.active_alerts }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 2rem;
  max-width: 1100px;
  margin: 0 auto;
}

h2 {
  margin: 0 0 1.5rem;
}

h3 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.empty-msg {
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 0.5rem 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.kpi-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}

.kpi-val {
  font-size: 1.8rem;
  font-weight: 700;
}

.kpi-label {
  font-size: 0.78rem;
  color: #6b7280;
  margin-top: 4px;
}

.kpi--green {
  border-color: #86efac;
}

.kpi--green .kpi-val {
  color: #15803d;
}

.kpi--orange .kpi-val {
  color: #d97706;
}

.kpi--red .kpi-val {
  color: #dc2626;
}

.section {
  margin-bottom: 2.5rem;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 1.75rem;
}

.date-range input {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.date-range button {
  padding: 5px 12px;
  background: #1a2e1a;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.country-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.country-table th {
  background: #f9fafb;
  padding: 9px 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #e5e7eb;
}

.country-table td {
  padding: 9px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.country-table tr:hover td {
  background: #f9fafb;
}

.good {
  color: #15803d;
  font-weight: 600;
}

.warn {
  color: #d97706;
  font-weight: 600;
}

.bad {
  color: #dc2626;
  font-weight: 600;
}
</style>
