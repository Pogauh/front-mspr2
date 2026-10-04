
import { api } from './api'
import { geoService } from './geo.service'
import type { Alert, AlertFilters, AlertType } from '@/types/alert.types'
import type { PaginatedResponse } from '@/types/lot.types'

// Actual shape returned by GET /alertes
interface BackendAlert {
  idAlerte: string
  typeAlerte: string
  description: string
  dateEmission: string
  idZone: string
}

function mapAlertType(typeAlerte: string): AlertType {
  const t = (typeAlerte ?? '').toLowerCase()
  if (t.includes('fifo')) return 'fifo'
  if (t.includes('expir') || t.includes('date')) return 'expiry'
  return 'threshold'
}

function mapAlert(b: BackendAlert): Alert {
  return {
    id: b.idAlerte,
    type: mapAlertType(b.typeAlerte),
    zone_id: b.idZone,
    message: b.description ?? '',
    is_read: false,
    is_active: true,
    created_at: b.dateEmission ?? new Date().toISOString(),
  }
}

// GET /alertes exige `pays` ET `idEntrepot` : on résout donc la liste des couples
// (pays, entrepôt) à interroger selon les filtres fournis.
interface AlertTarget {
  country: string
  warehouseId: string
  warehouseName?: string
}

async function resolveTargets(filters: AlertFilters): Promise<AlertTarget[]> {
  const { country_id, warehouse_id } = filters
  if (country_id && warehouse_id) return [{ country: country_id, warehouseId: warehouse_id }]

  // Pas de pays => tous les pays ; pas d'entrepôt => tous les entrepôts du/des pays
  const warehouses = await geoService.getWarehouses(country_id ? { country_id } : undefined)
  const selected = warehouse_id ? warehouses.filter((w) => w.id === warehouse_id) : warehouses
  return selected.map((w) => ({ country: w.country_id, warehouseId: w.id, warehouseName: w.name }))
}

async function fetchForTarget(t: AlertTarget): Promise<Alert[]> {
  const qs = new URLSearchParams({ pays: t.country, idEntrepot: t.warehouseId })
  const [raw, zones] = await Promise.all([
    api.get<BackendAlert[]>(`/alertes?${qs.toString()}`),
    // enrichissement best-effort (nom des zones)
    geoService.getZones(t.warehouseId, t.country).catch(() => []),
  ])
  const zoneMap = Object.fromEntries(zones.map((z) => [z.id, z.name]))
  return raw.map((b) => ({
    ...mapAlert(b),
    zone_name: b.idZone ? zoneMap[b.idZone] : undefined,
    warehouse_id: t.warehouseId,
    warehouse_name: t.warehouseName,
    country_id: t.country,
  }))
}

export const alertsService = {
  // GET /alertes?pays=...&idEntrepot=... (les deux sont obligatoires côté backend)
  // Sans filtre, on agrège tous les entrepôts de tous les pays.
  getAlerts: async (filters: AlertFilters = {}): Promise<PaginatedResponse<Alert>> => {
    const targets = await resolveTargets(filters)
    const results = await Promise.allSettled(targets.map(fetchForTarget))

    // Si tout échoue, on remonte l'erreur ; sinon on affiche ce qui a pu être chargé
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (targets.length > 0 && failed.length === targets.length) throw failed[0]!.reason

    const byId = new Map<string, Alert>()
    for (const r of results) {
      if (r.status === 'fulfilled') r.value.forEach((a) => byId.set(a.id, a))
    }
    let mapped = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))

    if (filters.active !== undefined) mapped = mapped.filter((a) => a.is_active === filters.active)
    if (filters.type) mapped = mapped.filter((a) => a.type === filters.type)

    const page = filters.page ?? 1
    const limit = filters.limit ?? mapped.length
    const start = (page - 1) * limit
    return { data: mapped.slice(start, start + limit), total: mapped.length, page, limit }
  },

  // PATCH not covered by the GET-only swagger - kept for compatibility
  markAsRead: (id: string) =>
    api.patch<Alert>(`/alerts/${id}/read`, {}),
}
