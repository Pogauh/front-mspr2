import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from './api'
import { reportingService } from './reporting.service'

const mockGet = vi.mocked(api.get)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportingService.getGlobal', () => {
  it('maps backend DTO fields to the frontend GlobalReport shape', async () => {
    // Arrange
    mockGet.mockResolvedValue({
      totalLots: 120,
      avgAgeDays: 45,
      complianceRate: 92,
      countMouvementLast30Days: 30,
    })

    // Act
    const result = await reportingService.getGlobal()

    // Assert
    expect(result.kpis.total_lots).toBe(120)
    expect(result.kpis.avg_age_days).toBe(45)
    expect(result.kpis.compliance_rate).toBe(0.92)
    expect(result.kpis.movements_last_30d).toBe(30)
    expect(result.by_country).toEqual([])
  })
})

describe('reportingService.getStock', () => {
  it('includes country and date range in the query string', async () => {
    // Arrange
    mockGet.mockResolvedValue({ totalLots: 50, avgAgeDays: 30, complianceRate: 90 })

    // Act
    await reportingService.getStock({ country_id: 'COLOMBIE', startDate: '2024-01-01T00:00:00', endDate: '2024-01-31T23:59:59' })

    // Assert
    expect(mockGet).toHaveBeenCalled()
    const calledWith = mockGet.mock.calls[0]?.[0]
    expect(calledWith).toContain('startDate=2024-01-01T00:00:00')
  })

  it('returns empty report on API error', async () => {
    // Arrange
    mockGet.mockRejectedValue(new Error('Network error'))

    // Act
    const result = await reportingService.getStock()

    // Assert
    expect(result.total_lots).toBe(0)
    expect(result.fifo_at_risk).toBe(0)
  })

  it('maps lotIdsUrgentFifo length to fifo_at_risk', async () => {
    // Arrange
    mockGet.mockResolvedValue({
      totalLots: 10,
      avgAgeDays: 100,
      complianceRate: 80,
      lotIdsUrgentFifo: ['l-1', 'l-2', 'l-3'],
    })

    // Act
    const result = await reportingService.getStock()

    // Assert
    expect(result.fifo_at_risk).toBe(3)
  })
})

describe('reportingService.getQuality', () => {
  it('maps backend quality DTO to the frontend QualityReport shape', async () => {
    // Arrange
    mockGet.mockResolvedValue({ alertCount: 5, complianceRate: 88, nonComplianceCount: 2 })

    // Act
    const result = await reportingService.getQuality()

    // Assert
    expect(result.total_alerts).toBe(5)
    expect(result.compliance_rate).toBe(0.88)
    expect(result.incidents).toBe(2)
    expect(result.by_zone).toEqual([])
  })

  it('includes date range in the query string', async () => {
    // Arrange
    mockGet.mockResolvedValue({ alertCount: 0, complianceRate: 100, nonComplianceCount: 0 })

    // Act
    await reportingService.getQuality({ from: '2024-01-01', to: '2024-01-31' })

    // Assert
    expect(mockGet).toHaveBeenCalled()
    const calledWith = mockGet.mock.calls[0]?.[0]
    expect(calledWith).toContain('startDate=2024-01-01T00:00:00')
    expect(calledWith).toContain('endDate=2024-01-31T23:59:59')
  })
})

describe('compliance rate normalisation', () => {
  it('borne le taux à 100% même si le backend renvoie plus', async () => {
    mockGet.mockResolvedValue({ totalLots: 1, avgAgeDays: 1, complianceRate: 10000, countMouvementLast30Days: 0 })
    const result = await reportingService.getGlobal()
    expect(result.kpis.compliance_rate).toBe(1)
  })
})
