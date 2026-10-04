import { api } from './api'
import { geoService, formatCountryName } from './geo.service'
import { readingsService } from './readings.service'
import { applyStatusOverrides, applyStatusOverride } from './status-overrides'
import type { Lot, LotFilters, LotStatus, PaginatedResponse } from '@/types/lot.types'

interface BackendLot {
  idLot: string
  status?: string
  quantite?: number
  caracteristique?: number
  dateSortie?: string
  dateStockage?: string
  dateProduction?: string
  emplacement?: string
  idExploitation?: string
  idEntrepot?: string
}

function mapLot(b: BackendLot): Lot {
  return {
    id: b.idLot,
    batch_number: b.idLot.substring(0, 8).toUpperCase(),
    farm_id: b.idExploitation ?? '',
    warehouse_id: b.idEntrepot,
    // emplacement peut contenir un UUID de zone ou un nom texte - résolu dans enrichWithNames
    zone_id: b.emplacement,
    quantity: b.quantite,
    characteristic: b.caracteristique,
    production_date: b.dateProduction ?? '',
    storage_date: b.dateStockage,
    status: b.status ?? 'pending',
  }
}

// country_id est un fallback quand le lot n'a pas d'entrepôt connu
async function enrichWithNames(lots: Lot[], country_id?: string): Promise<Lot[]> {
  const warehouses = await geoService.getWarehouses()
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]))

  const neededCountries = new Set<string>()
  for (const l of lots) {
    const wh = l.warehouse_id ? warehouseMap.get(l.warehouse_id) : undefined
    const lotCountry = wh?.country_id ?? country_id ?? l.country_id
    if (lotCountry) neededCountries.add(lotCountry)
  }

  // Exploitations par pays
  const farmMapByCountry = new Map<string, Map<string, string>>()
  await Promise.all(
    [...neededCountries].map(async (cId) => {
      const farms = await geoService.getFarms(cId)
      farmMapByCountry.set(cId, new Map(farms.map((f) => [f.id, f.name])))
    }),
  )

  // Zones de tous les entrepôts concernés
  const zoneLists = await Promise.all(
    warehouses.map((w) => geoService.getZones(w.id, w.country_id)),
  )
  const allZones = zoneLists.flat()
  // Double index : UUID→nom ET nom→UUID (emplacement peut contenir l'un ou l'autre)
  const zoneNameById = new Map(allZones.map((z) => [z.id, z.name]))
  const zoneIdByName = new Map(allZones.map((z) => [z.name.toLowerCase(), z.id]))

  return lots.map((l) => {
    const warehouse = l.warehouse_id ? warehouseMap.get(l.warehouse_id) : undefined
    const lotCountry = warehouse?.country_id ?? country_id ?? l.country_id ?? ''
    const countryName = lotCountry ? formatCountryName(lotCountry) : l.country_name

    const farmMap = lotCountry ? farmMapByCountry.get(lotCountry) : undefined

    const raw = l.zone_id
    const nameFromId = raw ? zoneNameById.get(raw) : undefined
    const idFromName = raw ? zoneIdByName.get(raw.toLowerCase()) : undefined

    return {
      ...l,
      country_id: lotCountry || l.country_id,
      country_name: countryName,
      warehouse_name: warehouse?.name ?? l.warehouse_name,
      farm_name: l.farm_id && farmMap ? (farmMap.get(l.farm_id) ?? l.farm_name) : l.farm_name,
      zone_id: nameFromId ? raw : (idFromName ?? undefined),
      zone_name: nameFromId ?? (idFromName ? raw : raw),
    }
  })
}

export const lotsService = {
  getLots: async (filters: LotFilters = {}): Promise<PaginatedResponse<Lot>> => {
    const raw = await api.get<BackendLot[]>('/lots')
    let mapped = raw.map(mapLot)
    mapped = await enrichWithNames(mapped, filters.country_id)

    // Appliquer les overrides locaux avant le filtrage par statut
    mapped = applyStatusOverrides(mapped)

    // Filtrage client (le backend ne supporte pas les filtres)
    if (filters.country_id) mapped = mapped.filter((l) => l.country_id?.toLowerCase() === filters.country_id!.toLowerCase())
    if (filters.status) mapped = mapped.filter((l) => l.status === filters.status)
    if (filters.warehouse_id) mapped = mapped.filter((l) => l.warehouse_id === filters.warehouse_id)
    if (filters.zone_id) mapped = mapped.filter((l) => l.zone_id === filters.zone_id)
    if (filters.farm_id) mapped = mapped.filter((l) => l.farm_id === filters.farm_id)
    const search = filters.search?.trim().toLowerCase()
    if (search) mapped = mapped.filter((l) => l.batch_number.toLowerCase().includes(search))

    if (filters.sort === 'storage_date_asc') {
      mapped.sort((a, b) => (a.storage_date ?? '').localeCompare(b.storage_date ?? ''))
    }

    const page = filters.page ?? 1
    const limit = filters.limit ?? mapped.length
    const start = (page - 1) * limit
    const pageData = mapped.slice(start, start + limit)

    if (filters.withReadings) {
      const latestReadings = await Promise.all(pageData.map((l) => readingsService.getLatestReading(l.id)))
      return {
        data: pageData.map((l, i) => {
          const r = latestReadings[i]
          return r
            ? {
              ...l,
              latest_reading: {
                temperature: r.temperature,
                humidity: r.humidite,
                recorded_at: r.dateMesure,
                threshold_status: 'ok' as const,
              },
            }
            : l
        }),
        total: mapped.length,
        page,
        limit,
      }
    }

    return { data: pageData, total: mapped.length, page, limit }
  },

  getLot: async (id: string, country_id?: string): Promise<Lot> => {
    const lot = await api.get<BackendLot>(`/lot/${id}`).then(mapLot)
    const [enrichedLots, reading] = await Promise.all([
      enrichWithNames([lot], country_id),
      readingsService.getLatestReading(id),
    ])
    const withOverride = applyStatusOverride(enrichedLots[0] ?? lot)
    if (!reading) return withOverride
    return {
      ...withOverride,
      latest_reading: {
        temperature: reading.temperature,
        humidity: reading.humidite,
        recorded_at: reading.dateMesure,
        threshold_status: 'ok' as const,
      },
    }
  },

  createLot: (payload: {
    farm_id: string
    zone_id: string
    pays: string
    status: string
    quantite: number
    caracteristique: number
    date_production: string
  }): Promise<void> => {
    const qs = new URLSearchParams({ pays: payload.pays }).toString()
    return api.post<void>(`/lot?${qs}`, {
      status: payload.status,
      quantite: payload.quantite,
      caracteristique: payload.caracteristique,
      dateProduction: payload.date_production,
      idExploitation: payload.farm_id,
      idZone: payload.zone_id,
    })
  },

  // PUT /lot/{id}/status?pays=...  body: { status }
  updateStatus: (id: string, status: LotStatus, pays: string): Promise<void> =>
    api.put<void>(`/lot/${id}/status?pays=${encodeURIComponent(pays)}`, { status }),

  // PUT /lot/{id}/zones?pays=...  body: { idZone }
  updateZone: (id: string, zone_id: string, pays: string): Promise<void> =>
    api.put<void>(`/lot/${id}/zones?pays=${encodeURIComponent(pays)}`, { idZone: zone_id }),

  stockIn: async (lot_id: string, zone_id: string, warehouse_id: string, pays: string): Promise<void> => {
    await api.put<void>(`/lot/${lot_id}/status?pays=${encodeURIComponent(pays)}`, { status: 'stored' })
    await api.put<void>(`/lot/${lot_id}/zones?pays=${encodeURIComponent(pays)}`, { idZone: zone_id })
  },
}
