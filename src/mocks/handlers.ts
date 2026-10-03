// Intercepteur fetch mock - mappe chaque endpoint vers les données mock
// Activé uniquement quand VITE_MOCK=true

import {
  USERS, COUNTRIES, FARMS, WAREHOUSES, ZONES,
  LOTS, READINGS, ALERTS, MOVEMENTS,
  REPORTING_GLOBAL, REPORTING_STOCK, REPORTING_QUALITY,
  WAREHOUSE_SUMMARIES,
} from './data'

// Token fictif stocké en mémoire pour simuler l'auth
let currentUserId: string | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function paginate<T>(items: T[], page = 1, limit = 20): object {
  const start = (page - 1) * limit
  return { data: items.slice(start, start + limit), total: items.length, page, limit }
}

function parseQs(url: string): Record<string, string> {
  const qs = url.includes('?') ? url.split('?')[1] : ''
  return Object.fromEntries(new URLSearchParams(qs))
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  return Number(v)
}

// ── Router mock ───────────────────────────────────────────────────────────────

export async function mockFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body as string) : null

  // Extraire le path sans la base URL (gère /api-siege/... et http://localhost/api/...)
  const stripped = url.replace(/^https?:\/\/[^/]+/, '')
  const path = stripped.replace(/^\/api-siege/, '').replace(/^\/api(?=\/auth\/)/, '') || '/'

  // ── Auth ──────────────────────────────────────────────────────────────────

  if (method === 'POST' && path === '/auth/login') {
    const user = USERS.find((u) => u.email === body?.email && u.password === body?.password)
    if (!user) {
      return new Response(JSON.stringify({ message: 'Email ou mot de passe incorrect' }), { status: 401 })
    }
    currentUserId = user.id
    const { password: _, ...safeUser } = user
    return ok({ token: `mock-token-${user.id}`, user: safeUser })
  }

  if (method === 'POST' && path === '/auth/logout') {
    currentUserId = null
    return new Response(null, { status: 204 })
  }

  if (method === 'GET' && path === '/auth/me') {
    if (!currentUserId) return new Response(null, { status: 401 })
    const user = USERS.find((u) => u.id === currentUserId)
    if (!user) return new Response(null, { status: 401 })
    const { password: _, ...safeUser } = user
    return ok(safeUser)
  }

  // ── Géographie ────────────────────────────────────────────────────────────

  // geo.service expects Record<string, BackendCountrySettings> keyed by uppercase country name
  if (method === 'GET' && path.startsWith('/countries')) {
    return ok({ COLOMBIE: {}, BRESIL: {}, EQUATEUR: {} })
  }

  // geo.service calls GET /farms/{pays} (path param, not query param)
  if (method === 'GET' && path.startsWith('/farms')) {
    const pathParam = path.split('/')[2]?.split('?')[0]
    let farms = [...FARMS]
    if (pathParam) {
      farms = farms.filter((f) => {
        const c = COUNTRIES.find((c) => c.id === f.country_id)
        return c?.name.toLowerCase() === pathParam.toLowerCase()
      })
    }
    // Return BackendFarm format: { idExploitation, nom }
    return ok(farms.map((f) => ({ idExploitation: String(f.id), nom: f.name })))
  }

  if (method === 'GET' && path.startsWith('/warehouses') && path.includes('/zones')) {
    const warehouseId = Number(path.split('/')[2])
    const zones = ZONES[warehouseId] ?? []
    // Return BackendZone format: { idZone, nomZone, idEntrepot }
    return ok(zones.map((z) => ({ idZone: String(z.id), nomZone: z.name, idEntrepot: String(z.warehouse_id) })))
  }

  if (method === 'GET' && path.startsWith('/warehouses') && path.includes('/readings/summary')) {
    const warehouseId = Number(path.split('/')[2])
    return ok(WAREHOUSE_SUMMARIES[warehouseId] ?? { warehouse_id: warehouseId, zones: [] })
  }

  // geo.service calls GET /warehouses/{pays} (path param) or GET /warehouses?country_id=&farm_id=
  if (method === 'GET' && path.startsWith('/warehouses')) {
    const qs = parseQs(path)
    const pathParam = path.split('/')[2]?.split('?')[0]
    const countryFromPath = pathParam && isNaN(Number(pathParam)) ? pathParam : undefined
    const countryIdFromQs = num(qs.country_id)
    const farmIdFromQs = num(qs.farm_id)

    let warehouses = [...WAREHOUSES]
    if (countryFromPath) {
      warehouses = warehouses.filter((w) => {
        const c = COUNTRIES.find((c) => c.id === w.country_id)
        return c?.name.toLowerCase() === countryFromPath.toLowerCase()
      })
    } else if (countryIdFromQs) {
      warehouses = warehouses.filter((w) => w.country_id === countryIdFromQs)
    }
    if (farmIdFromQs) warehouses = warehouses.filter((w) => w.farm_id === farmIdFromQs)
    // Return BackendWarehouse format: { idEntrepot, nom }
    return ok(warehouses.map((w) => ({ idEntrepot: String(w.id), nom: w.name })))
  }

  // ── Zones readings latest ─────────────────────────────────────────────────

  if (method === 'GET' && path.includes('/readings/latest')) {
    const zoneId = Number(path.split('/')[2])
    for (const summary of Object.values(WAREHOUSE_SUMMARIES)) {
      const s = summary as { zones: { zone_id: number }[] }
      const zone = s.zones.find((z) => z.zone_id === zoneId)
      if (zone) return ok(zone)
    }
    return new Response(JSON.stringify({ message: 'Zone not found' }), { status: 404 })
  }

  // ── Lots ──────────────────────────────────────────────────────────────────

  // readingsService.getLatestReading calls GET /lot/{id}/mesures
  if (method === 'GET' && path.match(/^\/lot\/[^/]+\/mesures$/)) {
    const rawId = path.split('/')[2]
    const id = parseInt(rawId)
    const readings = isNaN(id) ? [] : (READINGS[id] ?? [])
    return ok(readings.map((r) => ({
      temperature: r.temperature,
      humidite: (r as Record<string, unknown>).humidity as number,
      dateMesure: (r as Record<string, unknown>).recorded_at as string,
    })))
  }

  // lotsService.getLot calls GET /lot/{id} (singular path)
  if (method === 'GET' && path.match(/^\/lot\/[^/?]+$/)) {
    const rawId = path.split('/')[2]
    const id = parseInt(rawId)
    const lot = isNaN(id) ? undefined : LOTS.find((l) => l.id === id)
    if (!lot) return new Response(JSON.stringify({ message: 'Lot introuvable' }), { status: 404 })
    return ok({
      idLot: String(lot.id),
      status: lot.status,
      idExploitation: lot.farm_id != null ? String(lot.farm_id) : undefined,
      idEntrepot: lot.warehouse_id != null ? String(lot.warehouse_id) : undefined,
      emplacement: lot.zone_id != null ? String(lot.zone_id) : undefined,
      dateProduction: lot.production_date,
      dateStockage: lot.storage_date,
    })
  }

  if (method === 'GET' && path.match(/^\/lots\/\d+$/)) {
    const id = Number(path.split('/')[2])
    const lot = LOTS.find((l) => l.id === id)
    if (!lot) return new Response(JSON.stringify({ message: 'Lot introuvable' }), { status: 404 })
    return ok(lot)
  }

  if (method === 'GET' && path.startsWith('/lots')) {
    const qs = parseQs(path)
    let lots = [...LOTS]
    if (qs.country_id) lots = lots.filter((l) => l.country_id === num(qs.country_id))
    if (qs.farm_id) lots = lots.filter((l) => l.farm_id === num(qs.farm_id))
    if (qs.warehouse_id) lots = lots.filter((l) => l.warehouse_id === num(qs.warehouse_id))
    if (qs.zone_id) lots = lots.filter((l) => l.zone_id === num(qs.zone_id))
    if (qs.status) lots = lots.filter((l) => l.status === qs.status)
    // Tri FIFO par défaut
    if (!qs.sort || qs.sort === 'storage_date_asc') {
      lots.sort((a, b) => new Date(a.storage_date ?? '').getTime() - new Date(b.storage_date ?? '').getTime())
    }
    // lotsService.getLots expects a flat BackendLot[] - it does its own in-memory pagination
    return ok(lots.map((l) => ({
      idLot: String(l.id),
      status: l.status,
      idExploitation: l.farm_id != null ? String(l.farm_id) : undefined,
      idEntrepot: l.warehouse_id != null ? String(l.warehouse_id) : undefined,
      emplacement: l.zone_id != null ? String(l.zone_id) : undefined,
      dateProduction: l.production_date,
      dateStockage: l.storage_date,
    })))
  }

  if (method === 'POST' && path === '/lots') {
    const newId = Math.max(...LOTS.map((l) => l.id)) + 1
    const farm = FARMS.find((f) => f.id === body.farm_id)
    const zone = Object.values(ZONES).flat().find((z) => z.id === body.zone_id)
    const warehouse = zone ? WAREHOUSES.find((w) => w.id === zone.warehouse_id) : undefined
    const newLot = {
      id: newId,
      batch_number: `CO-${new Date().getFullYear()}-${String(newId).padStart(4, '0')}`,
      farm_id: body.farm_id, farm_name: farm?.name,
      country_id: farm?.country_id, country_name: farm?.country_name,
      warehouse_id: warehouse?.id, warehouse_name: warehouse?.name,
      zone_id: body.zone_id, zone_name: zone?.name,
      production_date: body.production_date, storage_date: new Date().toISOString(),
      status: 'pending',
      latest_reading: null,
    }
    LOTS.push(newLot as typeof LOTS[number])
    return ok(newLot, 201)
  }

  if (method === 'PUT' && path.match(/^\/lot\/[^/]+\/status$/)) {
    const rawId = path.split('/')[2]
    const lot = LOTS.find((l) => String(l.id) === rawId)
    if (!lot) return new Response(JSON.stringify({ message: 'Lot introuvable' }), { status: 404 })
    lot.status = body.status as typeof lot.status
    return ok({ idLot: String(lot.id), status: lot.status })
  }

  if (method === 'PUT' && path.match(/^\/lot\/[^/]+\/zones$/)) {
    const rawId = path.split('/')[2]
    const lot = LOTS.find((l) => String(l.id) === rawId)
    if (!lot) return new Response(JSON.stringify({ message: 'Lot introuvable' }), { status: 404 })
    const zone = Object.values(ZONES).flat().find((z) => String(z.id) === String(body.idZone))
    lot.zone_id = body.idZone
    lot.zone_name = zone?.name
    return ok({ idLot: String(lot.id), status: lot.status })
  }

  // ── Readings ──────────────────────────────────────────────────────────────

  if (method === 'GET' && path.startsWith('/readings')) {
    const qs = parseQs(path)
    const lotId = num(qs.lot_id)
    const zoneId = num(qs.zone_id)
    let readings = lotId
      ? (READINGS[lotId] ?? [])
      : zoneId
        ? Object.values(READINGS).flat().filter((r) => (r as { zone_id?: number }).zone_id === zoneId)
        : Object.values(READINGS).flat()
    // Granularité basique : pas de vrai agrégat, on renvoie moins de points
    if (qs.granularity === '1d') readings = readings.filter((_, i) => i % 4 === 0)
    return ok(readings)
  }

  // ── Alertes ───────────────────────────────────────────────────────────────

  if (method === 'PATCH' && path.match(/^\/alerts\/\d+\/read$/)) {
    const id = Number(path.split('/')[2])
    const alert = ALERTS.find((a) => a.id === id)
    if (alert) alert.is_read = true
    return ok(alert)
  }

  if (method === 'GET' && path.startsWith('/alertes')) {
    const qs = parseQs(path)
    let filtered = [...ALERTS]
    // Filtre par pays (insensible à la casse, compare au country_name du mock)
    if (qs.pays) filtered = filtered.filter((a) =>
      (a as Record<string, unknown>).country_name?.toString().toLowerCase() === qs.pays.toLowerCase()
    )
    // Filtre par idEntrepot (UUID réel en prod, ID numérique en mock)
    if (qs.idEntrepot) filtered = filtered.filter((a) =>
      String((a as Record<string, unknown>).warehouse_id) === qs.idEntrepot
    )
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    // Retourne le format BackendAlert - mapAlert() dans le service se charge de la conversion
    return ok(filtered.map((a) => ({
      idAlerte: String(a.id),
      typeAlerte: a.type,
      description: a.message,
      dateEmission: a.created_at,
      idZone: String((a as Record<string, unknown>).zone_id ?? ''),
    })))
  }

  // ── Mouvements ────────────────────────────────────────────────────────────

  if (method === 'POST' && path.startsWith('/mouvements/stockout')) {
    const qs = parseQs(path)
    const lot = LOTS.find((l) => String(l.id) === qs.idLot)
    if (!lot) return new Response(JSON.stringify({ message: 'Lot introuvable' }), { status: 404 })
    lot.status = 'shipped'
    return ok({ idHistorique: `mock-hist-${Date.now()}`, status: 'shipped' })
  }

  if (method === 'POST' && path === '/movements/stock-in') {
    const newId = Math.max(...MOVEMENTS.map((m) => m.id)) + 1
    const lot = LOTS.find((l) => l.id === body.lot_id)
    const zone = Object.values(ZONES).flat().find((z) => z.id === body.zone_id)
    const warehouse = WAREHOUSES.find((w) => w.id === body.warehouse_id)
    if (lot) { lot.status = 'stored'; lot.warehouse_id = body.warehouse_id; lot.zone_id = body.zone_id; lot.zone_name = zone?.name; lot.storage_date = new Date().toISOString() }
    const mv = {
      id: newId, lot_id: body.lot_id, lot_batch_number: lot?.batch_number,
      type: 'stock_in', from_zone_id: null, from_zone_name: null,
      to_zone_id: body.zone_id, to_zone_name: zone?.name,
      warehouse_id: body.warehouse_id, warehouse_name: warehouse?.name,
      reason: null, performed_by: 'Utilisateur courant', performed_at: new Date().toISOString(),
    }
    MOVEMENTS.unshift(mv as typeof MOVEMENTS[number])
    return ok(mv, 201)
  }

  if (method === 'POST' && path === '/movements/stock-out') {
    const newId = Math.max(...MOVEMENTS.map((m) => m.id)) + 1
    const lot = LOTS.find((l) => l.id === body.lot_id)
    if (lot) lot.status = 'shipped'
    const mv = {
      id: newId, lot_id: body.lot_id, lot_batch_number: lot?.batch_number,
      type: 'stock_out', from_zone_id: lot?.zone_id, from_zone_name: lot?.zone_name,
      to_zone_id: null, to_zone_name: null,
      warehouse_id: lot?.warehouse_id, warehouse_name: lot?.warehouse_name,
      reason: body.reason ?? null, performed_by: 'Utilisateur courant', performed_at: new Date().toISOString(),
    }
    MOVEMENTS.unshift(mv as typeof MOVEMENTS[number])
    return ok(mv, 201)
  }

  if (method === 'GET' && path.startsWith('/movements')) {
    const qs = parseQs(path)
    let movements = [...MOVEMENTS]
    if (qs.lot_id) movements = movements.filter((m) => m.lot_id === num(qs.lot_id))
    if (qs.warehouse_id) movements = movements.filter((m) => m.warehouse_id === num(qs.warehouse_id))
    return ok(paginate(movements, num(qs.page) ?? 1, num(qs.limit) ?? 20))
  }

  // ── Reporting ─────────────────────────────────────────────────────────────

  if (method === 'GET' && path.startsWith('/reporting/global')) {
    return ok(REPORTING_GLOBAL)
  }

  if (method === 'GET' && path.startsWith('/reporting/stock')) {
    return ok(REPORTING_STOCK)
  }

  if (method === 'GET' && path.startsWith('/reporting/quality')) {
    return ok(REPORTING_QUALITY)
  }

  // ── Fallback ──────────────────────────────────────────────────────────────

  console.warn(`[MOCK] Endpoint non géré : ${method} ${path}`)
  return new Response(JSON.stringify({ message: `Mock: ${method} ${path} not implemented` }), { status: 501 })
}
