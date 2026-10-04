<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { lotsService } from '@/services/lots.service'
import { geoService } from '@/services/geo.service'
import type { Farm, Warehouse, Zone } from '@/types/geo.types'
import { storeToRefs } from 'pinia'

const router = useRouter()
const authStore = useAuthStore()
const { autoFilters } = storeToRefs(authStore)

const farms = ref<Farm[]>([])
const warehouses = ref<Warehouse[]>([])
const zones = ref<Zone[]>([])
const selectedFarmId = ref('')
const selectedWarehouseId = ref('')
const selectedZoneId = ref('')
const status = ref('pending')
const quantite = ref(0)
const caracteristique = ref(0)
const dateProduction = ref(new Date().toISOString().split('T')[0] as string)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  const country = autoFilters.value.country_id
  if (country) {
    farms.value = await geoService.getFarms(country)
    warehouses.value = await geoService.getWarehouses({ country_id: country })
  }
  selectedFarmId.value = autoFilters.value.farm_id ?? ''
})

watch(selectedWarehouseId, async (id) => {
  selectedZoneId.value = ''
  zones.value = id ? await geoService.getZones(id, autoFilters.value.country_id) : []
})

async function handleSubmit() {
  if (!selectedFarmId.value || !autoFilters.value.country_id) {
    error.value = 'Please select a farm'
    return
  }
  if (!selectedZoneId.value) {
    error.value = 'Please select a zone'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await lotsService.createLot({
      farm_id: selectedFarmId.value,
      zone_id: selectedZoneId.value,
      pays: autoFilters.value.country_id,
      status: status.value,
      quantite: quantite.value,
      caracteristique: caracteristique.value,
      date_production: dateProduction.value,
    })
    router.push('/farm')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error during creation'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <RouterLink to="/farm" class="back-link">← Back to farm</RouterLink>
    <h2>Create a lot</h2>

    <form class="form" @submit.prevent="handleSubmit">
      <div class="field">
        <label>Farm *</label>
        <select v-model="selectedFarmId" required>
          <option value="">- Select a farm -</option>
          <option v-for="f in farms" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </div>

      <div class="field">
        <label>Warehouse *</label>
        <select v-model="selectedWarehouseId" required>
          <option value="">- Select a warehouse -</option>
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>

      <div class="field">
        <label>Zone *</label>
        <select v-model="selectedZoneId" required :disabled="!selectedWarehouseId">
          <option value="">- Select a zone -</option>
          <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
        </select>
      </div>

      <div class="field">
        <label>Production date *</label>
        <input type="date" v-model="dateProduction" required />
      </div>

      <div class="field">
        <label>Status *</label>
        <select v-model="status" required>
          <option value="PENDING">Pending</option>
          <option value="STORED">Stored</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="ALERT">Alert</option>
          <option value="BLOCKED">Blocked</option>
          <option value="SHIPPED">Shipped</option>
        </select>
      </div>

      <div class="field">
        <label>Quantity *</label>
        <input type="number" v-model.number="quantite" min="0" required />
      </div>

      <div class="field">
        <label>Characteristic</label>
        <input type="number" v-model.number="caracteristique" min="0" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="form-actions">
        <RouterLink to="/farm" class="btn-cancel">Cancel</RouterLink>
        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? 'Creating…' : 'Create lot' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page { padding: 2rem; max-width: 520px; margin: 0 auto; }
.back-link { color: #15803d; text-decoration: none; font-size: 0.875rem; }
h2 { margin: 1rem 0 1.5rem; }
.form { display: flex; flex-direction: column; gap: 1.25rem; background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; }
.field { display: flex; flex-direction: column; gap: 4px; }
label { font-size: 0.875rem; font-weight: 500; color: #374151; }
input, select { padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; }
.error { color: #dc2626; font-size: 0.85rem; margin: 0; }
.form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
.btn-cancel { padding: 9px 18px; border: 1px solid #d1d5db; border-radius: 8px; background: white; text-decoration: none; font-size: 0.875rem; color: #374151; }
.btn-submit { padding: 9px 18px; background: #15803d; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.btn-submit:disabled { opacity: 0.6; }
</style>
