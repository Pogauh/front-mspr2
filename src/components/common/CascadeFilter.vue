<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useFiltersStore } from '@/stores/filters.store'
import { useAuthStore } from '@/stores/auth.store'
import { geoService } from '@/services/geo.service'
import type { Country, Farm, Warehouse, Zone } from '@/types/geo.types'
import { storeToRefs } from 'pinia'

const props = withDefaults(defineProps<{ showFarm?: boolean; showZone?: boolean }>(), {
  showFarm: true,
  showZone: true,
})

const filtersStore = useFiltersStore()
const authStore = useAuthStore()
const { countryId, farmId, warehouseId, zoneId } = storeToRefs(filtersStore)
const { autoFilters } = storeToRefs(authStore)

const countries = ref<Country[]>([])
const farms = ref<Farm[]>([])
const warehouses = ref<Warehouse[]>([])
const zones = ref<Zone[]>([])

async function loadFarmsAndWarehouses(id: string | undefined) {
  if (id) {
    const [f, w] = await Promise.all([
      geoService.getFarms(id),
      geoService.getWarehouses({ country_id: id }),
    ])
    farms.value = f
    warehouses.value = w
  } else {
    // Aucun pays : charger toutes les exploitations et entrepôts
    const [allWarehouses, ...farmLists] = await Promise.all([
      geoService.getWarehouses(),
      ...countries.value.map((c) => geoService.getFarms(c.id).catch(() => [] as Farm[])),
    ])
    warehouses.value = allWarehouses as Warehouse[]
    farms.value = (farmLists as Farm[][]).flat()
  }
  zones.value = []
}

onMounted(async () => {
  countries.value = await geoService.getCountries()
  if (autoFilters.value.country_id && !countryId.value) {
    filtersStore.setCountry(autoFilters.value.country_id)
  }
  await loadFarmsAndWarehouses(countryId.value)
  if (warehouseId.value) {
    zones.value = await geoService.getZones(warehouseId.value, countryId.value)
  }
})

watch(countryId, (id) => {
  loadFarmsAndWarehouses(id)
})

watch(warehouseId, async (id) => {
  zones.value = id ? await geoService.getZones(id, countryId.value) : []
})

function resetFilters() {
  if (autoFilters.value.country_id) {
    filtersStore.setCountry(autoFilters.value.country_id)
  } else {
    filtersStore.reset()
  }
}
</script>

<template>
  <div class="cascade-filter">
    <select
      :value="countryId"
      @change="filtersStore.setCountry(($event.target as HTMLSelectElement).value || undefined)"
      :disabled="!!autoFilters.country_id"
    >
      <option value="">- All countries -</option>
      <option v-for="c in countries" :key="c.id" :value="c.id">{{ c.name }}</option>
    </select>

    <select
      v-if="props.showFarm"
      :value="farmId"
      @change="filtersStore.setFarm(($event.target as HTMLSelectElement).value || undefined)"
    >
      <option value="">- All farms -</option>
      <option v-for="f in farms" :key="f.id" :value="f.id">{{ f.name }}</option>
    </select>

    <select
      :value="warehouseId"
      @change="filtersStore.setWarehouse(($event.target as HTMLSelectElement).value || undefined)"
    >
      <option value="">- All warehouses -</option>
      <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
    </select>

    <select
      v-if="props.showZone"
      :value="zoneId"
      @change="filtersStore.setZone(($event.target as HTMLSelectElement).value || undefined)"
      :disabled="!warehouseId"
    >
      <option value="">- All zones -</option>
      <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
    </select>

    <button class="btn-reset" @click="resetFilters()">Reset</button>
  </div>
</template>

<style scoped>
.cascade-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  min-width: 150px;
}
select:disabled { background: #f3f4f6; color: #9ca3af; }
.btn-reset {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn-reset:hover { background: #f9fafb; }
</style>
