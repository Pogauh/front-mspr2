import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: { get: vi.fn() },
}))

import { api } from './api'
import { historyService } from './history.service'

const mockGet = vi.mocked(api.get)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('historyService.getLotHistory', () => {
  it('calls /history/{id}, maps fields and sorts newest first', async () => {
    // Arrange
    mockGet.mockResolvedValue([
      { idHistorique: 'h-1', type: 'TRANSFERT', dateEmission: '2026-10-01T10:00:00Z', zonePrecedente: 'z-1', zoneActuelle: 'z-2', detail: 'moved' },
      { idHistorique: 'h-2', type: 'ALERTE', dateEmission: '2026-10-03T10:00:00Z', zonePrecedente: null, zoneActuelle: 'z-2', detail: null },
    ])

    // Act
    const result = await historyService.getLotHistory('lot-1')

    // Assert
    expect(mockGet).toHaveBeenCalledWith('/history/lot-1')
    expect(result.map((h) => h.id)).toEqual(['h-2', 'h-1'])
    expect(result[1]).toEqual({
      id: 'h-1', type: 'TRANSFERT', date: '2026-10-01T10:00:00Z',
      previous_zone_id: 'z-1', current_zone_id: 'z-2', detail: 'moved',
    })
    expect(result[0]?.previous_zone_id).toBeUndefined()
  })

  it('passes the type filter as a query param', async () => {
    // Arrange
    mockGet.mockResolvedValue([])

    // Act
    await historyService.getLotHistory('lot-1', 'ALERTE')

    // Assert
    expect(mockGet).toHaveBeenCalledWith('/history/lot-1?type=ALERTE')
  })
})
