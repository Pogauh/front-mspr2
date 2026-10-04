import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MonitoringView from './MonitoringView.vue'

vi.mock('@/services/readings.service', () => ({
  readingsService: {
    getWarehouseSummary: vi.fn(),
  },
}))

vi.mock('@/services/geo.service', () => ({
  geoService: {
    getWarehouses: vi.fn(),
  },
}))

import { readingsService } from '@/services/readings.service'
import { geoService } from '@/services/geo.service'

const mockGetWarehouseSummary = vi.mocked(readingsService.getWarehouseSummary)
const mockGetWarehouses = vi.mocked(geoService.getWarehouses)

const makeSummary = (warehouseId: string) => ({
  warehouse_id: warehouseId,
  zones: [
    {
      zone_id: 'z-1',
      zone_name: 'Zone A',
      temperature: 21.5,
      humidity: 63,
      recorded_at: '2024-01-15T10:00:00',
      threshold_status: 'ok' as const,
    },
  ],
})

function mountMonitoring(countryId?: string) {
  return mount(MonitoringView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            filters: { warehouseId: undefined },
            auth: { user: { id: 'u-1', name: 'Bob', role: 'warehouse_manager', country_id: countryId }, token: 'tok' },
          },
          stubActions: false,
        }),
      ],
      stubs: { ReadingChart: true },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetWarehouses.mockResolvedValue([
    { id: 'wh-1', name: 'Main Warehouse', country_id: 'COLOMBIE' },
    { id: 'wh-2', name: 'Secondary Warehouse', country_id: 'BRESIL' },
  ])
  mockGetWarehouseSummary.mockResolvedValue(makeSummary('wh-1'))
})

describe('MonitoringView', () => {
  it('only loads the warehouses of the user country', async () => {
    // Arrange + Act
    mountMonitoring('COLOMBIE')
    await flushPromises()

    // Assert
    expect(mockGetWarehouses).toHaveBeenCalledWith({ country_id: 'COLOMBIE' })
  })

  it('renders warehouse tabs after loading', async () => {
    // Arrange + Act
    const wrapper = mountMonitoring()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Main Warehouse')
    expect(wrapper.text()).toContain('Secondary Warehouse')
  })

  it('shows zone cards after the warehouse summary loads', async () => {
    // Arrange + Act
    const wrapper = mountMonitoring()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Zone A')
    expect(wrapper.text()).toContain('21.5')
  })

  it('calls getWarehouseSummary for the first warehouse automatically', async () => {
    // Arrange + Act
    mountMonitoring()
    await flushPromises()

    // Assert
    expect(mockGetWarehouseSummary).toHaveBeenCalledWith('wh-1', 'COLOMBIE')
  })

  it('shows the page heading', () => {
    // Arrange + Act
    const wrapper = mountMonitoring()

    // Assert
    expect(wrapper.text()).toContain('Real-time monitoring')
  })
})
