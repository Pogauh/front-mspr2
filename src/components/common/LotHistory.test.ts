import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LotHistory from './LotHistory.vue'

vi.mock('@/services/history.service', () => ({
  historyService: { getLotHistory: vi.fn() },
}))

vi.mock('@/services/geo.service', () => ({
  geoService: {
    getZones: vi.fn().mockResolvedValue([{ id: 'z-1', name: 'Zone A', warehouse_id: 'wh-1' }]),
  },
}))

import { historyService } from '@/services/history.service'

const mockGetHistory = vi.mocked(historyService.getLotHistory)

const mountHistory = () =>
  mount(LotHistory, { props: { lotId: 'lot-1', warehouseId: 'wh-1', countryId: 'COLOMBIE' } })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetHistory.mockResolvedValue([
    { id: 'h-1', type: 'TRANSFERT', date: '2026-10-01T10:00:00Z', previous_zone_id: 'z-1', current_zone_id: 'z-unknown', detail: 'moved' },
  ])
})

describe('LotHistory', () => {
  it('lists history entries with zone names resolved and raw ids as fallback', async () => {
    // Arrange + Act
    const wrapper = mountHistory()
    await flushPromises()

    // Assert
    expect(mockGetHistory).toHaveBeenCalledWith('lot-1', undefined)
    expect(wrapper.text()).toContain('Transfer')
    expect(wrapper.text()).toContain('Zone A')
    expect(wrapper.text()).toContain('z-unknown')
    expect(wrapper.text()).toContain('moved')
  })

  it('reloads with the selected type', async () => {
    // Arrange
    const wrapper = mountHistory()
    await flushPromises()

    // Act
    await wrapper.find('select').setValue('ALERTE')
    await flushPromises()

    // Assert
    expect(mockGetHistory).toHaveBeenLastCalledWith('lot-1', 'ALERTE')
  })

  it('shows an empty message when there is no history', async () => {
    // Arrange
    mockGetHistory.mockResolvedValue([])

    // Act
    const wrapper = mountHistory()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('No history for this lot')
  })

  it('shows an error when loading fails', async () => {
    // Arrange
    mockGetHistory.mockRejectedValue(new Error('boom'))

    // Act
    const wrapper = mountHistory()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Unable to load history')
  })
})
