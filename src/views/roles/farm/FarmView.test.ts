import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import FarmView from './FarmView.vue'

vi.mock('@/services/lots.service', () => ({
  lotsService: {
    getLots: vi.fn(),
  },
}))

vi.mock('@/services/movements.service', () => ({
  movementsService: {
    stockOut: vi.fn(),
  },
}))

vi.mock('@/services/geo.service', () => ({
  geoService: {
    getWarehouses: vi.fn().mockResolvedValue([]),
  },
}))

import { lotsService } from '@/services/lots.service'
import { movementsService } from '@/services/movements.service'

const mockGetLots = vi.mocked(lotsService.getLots)
const mockStockOut = vi.mocked(movementsService.stockOut)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/farm', component: { template: '<div />' } },
    { path: '/farm/create-lot', component: { template: '<div />' } },
  ],
})

const makeLot = (overrides = {}) => ({
  id: 'lot-1',
  batch_number: 'ABC123',
  status: 'stored',
  farm_id: 'farm-1',
  country_id: 'COLOMBIE',
  production_date: '2024-01-01',
  ...overrides,
})

function mountFarm(countryId = 'COLOMBIE') {
  return mount(FarmView, {
    global: {
      plugins: [
        router,
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              user: {
                id: 'u-1',
                name: 'Alice',
                role: 'farm_manager',
                country_id: countryId,
                farm_id: 'farm-1',
              },
              token: 'tok',
            },
          },
        }),
      ],
      stubs: {
        LotTable: { template: '<div class="lot-table" />' },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetLots.mockResolvedValue({ data: [makeLot()], total: 1, page: 1, limit: 50 })
  mockStockOut.mockResolvedValue({ id: 'mv-1' } as never)
})

describe('FarmView', () => {
  it('renders the My Farm heading', async () => {
    // Arrange + Act
    const wrapper = mountFarm()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('My Farm')
  })

  it('calls lotsService.getLots on mount', async () => {
    // Arrange + Act
    mountFarm()
    await flushPromises()

    // Assert
    expect(mockGetLots).toHaveBeenCalledOnce()
  })

  it('shows the Record a shipment section', async () => {
    // Arrange + Act
    const wrapper = mountFarm()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Record a shipment')
  })

  it('shows a success message after recording a shipment', async () => {
    // Arrange
    const wrapper = mountFarm()
    await flushPromises()

    // Select a lot and trigger shipment
    await wrapper.find('select').setValue('lot-1')
    await wrapper.find('.btn-danger').trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Shipment recorded.')
  })
})
