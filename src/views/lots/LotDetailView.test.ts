import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import LotDetailView from './LotDetailView.vue'

vi.mock('@/services/lots.service', () => ({
  lotsService: {
    getLot: vi.fn(),
  },
}))

import { lotsService } from '@/services/lots.service'

const mockGetLot = vi.mocked(lotsService.getLot)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/lots', component: { template: '<div />' } },
    { path: '/lots/:id', component: { template: '<div />' } },
  ],
})

const makeLot = (overrides = {}) => ({
  id: 'lot-1',
  batch_number: 'ABC123DE',
  farm_id: 'farm-1',
  farm_name: 'Pepper Farm',
  country_id: 'COLOMBIE',
  country_name: 'Colombia',
  warehouse_id: 'wh-1',
  warehouse_name: 'Main Warehouse',
  zone_name: 'Zone A',
  production_date: '2024-01-01',
  storage_date: '2024-01-10',
  status: 'stored',
  ...overrides,
})

function mountDetail(id = 'lot-1') {
  return mount(LotDetailView, {
    props: { id },
    global: {
      plugins: [
        router,
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { user: null, token: null } },
        }),
      ],
      stubs: {
        StatusBadge: { template: '<span class="status-badge"><slot /></span>' },
        ThresholdDot: { template: '<span />' },
        ReadingChart: true,
        LotHistory: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetLot.mockResolvedValue(makeLot())
})

describe('LotDetailView', () => {
  it('shows the loading indicator initially', () => {
    // Arrange + Act
    const wrapper = mountDetail()

    // Assert
    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('displays the lot batch number after loading', async () => {
    // Arrange + Act
    const wrapper = mountDetail()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('ABC123DE')
  })

  it('displays farm and country information', async () => {
    // Arrange + Act
    const wrapper = mountDetail()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Pepper Farm')
    expect(wrapper.text()).toContain('Colombia')
  })

  it('shows "Lot not found" when the service throws', async () => {
    // Arrange
    mockGetLot.mockRejectedValue(new Error('Not found'))

    // Act
    const wrapper = mountDetail('missing-id')
    await flushPromises()

    // Assert
    expect(wrapper.find('.error').text()).toBe('Lot not found')
  })

  it('shows the latest IoT reading section when a reading is present', async () => {
    // Arrange
    mockGetLot.mockResolvedValue(makeLot({
      latest_reading: {
        temperature: 22.3,
        humidity: 65,
        recorded_at: '2024-01-10T10:00:00',
        threshold_status: 'ok',
      },
    }))

    // Act
    const wrapper = mountDetail()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Latest IoT reading')
    expect(wrapper.text()).toContain('22.3°C')
  })

  it('hides the IoT reading section when no reading exists', async () => {
    // Arrange
    mockGetLot.mockResolvedValue(makeLot({ latest_reading: undefined }))

    // Act
    const wrapper = mountDetail()
    await flushPromises()

    // Assert
    expect(wrapper.text()).not.toContain('Latest IoT reading')
  })
})
