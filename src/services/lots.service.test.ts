import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('./geo.service', () => ({
  geoService: {
    getWarehouses: vi.fn().mockResolvedValue([]),
    getFarms: vi.fn().mockResolvedValue([]),
    getZones: vi.fn().mockResolvedValue([]),
    getCountries: vi.fn().mockResolvedValue([]),
  },
  formatCountryName: vi.fn((id: string) => {
    const map: Record<string, string> = { COLOMBIE: 'Colombia', BRESIL: 'Brazil', EQUATEUR: 'Ecuador' }
    return map[id] ?? id
  }),
}))

vi.mock('./readings.service', () => ({
  readingsService: {
    getLatestReading: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('./status-overrides', () => ({
  applyStatusOverrides: vi.fn((lots: unknown[]) => lots),
  applyStatusOverride: vi.fn((lot: unknown) => lot),
}))

import { api } from './api'
import { geoService } from './geo.service'
import { lotsService } from './lots.service'

const mockGet = vi.mocked(api.get)
const mockPut = vi.mocked(api.put)
const mockPost = vi.mocked(api.post)
const mockGetWarehouses = vi.mocked(geoService.getWarehouses)
const mockGetFarms = vi.mocked(geoService.getFarms)
const mockGetZones = vi.mocked(geoService.getZones)

const backendLot = {
  idLot: 'abcdef12-0000-0000-0000-000000000000',
  status: 'pending',
  idExploitation: 'farm-1',
  idEntrepot: 'wh-1',
  dateProduction: '2023-06-01',
  dateStockage: '2023-06-05',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue([backendLot])
  mockGetWarehouses.mockResolvedValue([{ id: 'wh-1', name: 'Main Warehouse', country_id: 'COLOMBIE' }])
  mockGetFarms.mockResolvedValue([{ id: 'farm-1', name: 'Pepper Farm', country_id: 'COLOMBIE' }])
  mockGetZones.mockResolvedValue([])
})

describe('lotsService.getLots', () => {
  it('maps backend lots to the Lot shape with batch_number from idLot prefix', async () => {
    // Act
    const { data } = await lotsService.getLots()

    // Assert
    expect(data[0]?.id).toBe('abcdef12-0000-0000-0000-000000000000')
    expect(data[0]?.batch_number).toBe('ABCDEF12')
    expect(data[0]?.status).toBe('pending')
  })

  it('enriches lots with country name mapped to English', async () => {
    // Act
    const { data } = await lotsService.getLots()

    // Assert
    expect(data[0]?.country_name).toBe('Colombia')
  })

  it('enriches lots with warehouse display name', async () => {
    // Act
    const { data } = await lotsService.getLots()

    // Assert
    expect(data[0]?.warehouse_name).toBe('Main Warehouse')
  })

  it('enriches lots with farm display name', async () => {
    // Act
    const { data } = await lotsService.getLots()

    // Assert
    expect(data[0]?.farm_name).toBe('Pepper Farm')
  })

  it('filters by status when status filter is provided', async () => {
    // Arrange
    mockGet.mockResolvedValue([
      { ...backendLot, idLot: 'lot-1', status: 'pending' },
      { ...backendLot, idLot: 'lot-2', status: 'compliant' },
    ])

    // Act
    const { data } = await lotsService.getLots({ status: 'compliant' })

    // Assert
    expect(data).toHaveLength(1)
    expect(data[0]?.status).toBe('compliant')
  })

  it('filters by country_id when country filter is provided', async () => {
    // Arrange
    mockGetWarehouses
      .mockResolvedValue([
        { id: 'wh-1', name: 'Main Warehouse', country_id: 'COLOMBIE' },
        { id: 'wh-2', name: 'Brasil Warehouse', country_id: 'BRESIL' },
      ])
    mockGet.mockResolvedValue([
      { ...backendLot, idLot: 'lot-1', idEntrepot: 'wh-1' },
      { ...backendLot, idLot: 'lot-2', idEntrepot: 'wh-2' },
    ])

    // Act
    const { data } = await lotsService.getLots({ country_id: 'COLOMBIE' })

    // Assert
    expect(data).toHaveLength(1)
    expect(data[0]?.country_id).toBe('COLOMBIE')
  })

  it('sorts lots by storage date ascending when sort option is provided', async () => {
    // Arrange
    mockGet.mockResolvedValue([
      { ...backendLot, idLot: 'lot-new', dateStockage: '2024-01-10' },
      { ...backendLot, idLot: 'lot-old', dateStockage: '2023-01-05' },
    ])

    // Act
    const { data } = await lotsService.getLots({ sort: 'storage_date_asc' })

    // Assert
    expect(data[0]?.id).toBe('lot-old')
    expect(data[1]?.id).toBe('lot-new')
  })

  it('paginates results when page and limit are provided', async () => {
    // Arrange
    mockGet.mockResolvedValue([
      { ...backendLot, idLot: 'lot-1' },
      { ...backendLot, idLot: 'lot-2' },
      { ...backendLot, idLot: 'lot-3' },
    ])

    // Act
    const result = await lotsService.getLots({ page: 2, limit: 2 })

    // Assert
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(3)
    expect(result.data[0]?.id).toBe('lot-3')
  })
})

describe('lotsService.createLot', () => {
  it('posts to /lot with pays as query param and maps field names', async () => {
    // Arrange
    mockPost.mockResolvedValue(undefined)

    // Act
    await lotsService.createLot({
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      pays: 'COLOMBIE',
      status: 'pending',
      quantite: 100,
      caracteristique: 85,
      date_production: '2026-10-04',
    })

    // Assert
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('pays=COLOMBIE'), {
      status: 'pending',
      quantite: 100,
      caracteristique: 85,
      dateProduction: '2026-10-04',
      idExploitation: 'farm-1',
      idZone: 'zone-1',
    })
  })
})

describe('lotsService.updateStatus', () => {
  it('calls PUT /lot/:id/status with pays and status body', async () => {
    // Arrange
    mockPut.mockResolvedValue(undefined)

    // Act
    await lotsService.updateStatus('lot-1', 'compliant', 'COLOMBIE')

    // Assert
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining('/lot/lot-1/status'),
      { status: 'compliant' },
    )
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining('pays=COLOMBIE'),
      expect.anything(),
    )
  })
})
