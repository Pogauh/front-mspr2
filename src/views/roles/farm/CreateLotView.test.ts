import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import CreateLotView from './CreateLotView.vue'

vi.mock('@/services/lots.service', () => ({
  lotsService: {
    createLot: vi.fn(),
  },
}))

vi.mock('@/services/geo.service', () => ({
  geoService: {
    getFarms: vi.fn().mockResolvedValue([
      { id: 'farm-1', name: 'Pepper Farm', country_id: 'COLOMBIE' },
    ]),
    getWarehouses: vi.fn().mockResolvedValue([
      { id: 'wh-1', name: 'Main Warehouse', country_id: 'COLOMBIE' },
    ]),
    getZones: vi.fn().mockResolvedValue([
      { id: 'zone-1', name: 'Zone A', warehouse_id: 'wh-1' },
    ]),
  },
}))

import { lotsService } from '@/services/lots.service'
import { geoService } from '@/services/geo.service'

const mockCreateLot = vi.mocked(lotsService.createLot)
const mockGetFarms = vi.mocked(geoService.getFarms)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/farm', component: { template: '<div />' } },
    { path: '/farm/create-lot', component: { template: '<div />' } },
  ],
})

function mountCreate(countryId: string | undefined = 'COLOMBIE', farmId: string | undefined = undefined) {
  return mount(CreateLotView, {
    global: {
      plugins: [
        router,
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: {
              user: { id: 'u-1', name: 'Alice', role: 'farm_manager', country_id: countryId, farm_id: farmId },
              token: 'tok',
            },
          },
        }),
      ],
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFarms.mockResolvedValue([{ id: 'farm-1', name: 'Pepper Farm', country_id: 'COLOMBIE' }])
  mockCreateLot.mockResolvedValue(undefined)
})

describe('CreateLotView', () => {
  it('shows the form title', () => {
    // Arrange + Act
    const wrapper = mountCreate()

    // Assert
    expect(wrapper.text()).toContain('Create a lot')
  })

  it('loads available farms from geoService on mount', async () => {
    // Arrange + Act
    mountCreate()
    await flushPromises()

    // Assert
    expect(mockGetFarms).toHaveBeenCalledWith('COLOMBIE')
  })

  it('shows an error when submitting without selecting a farm', async () => {
    // Arrange
    const wrapper = mountCreate()
    await flushPromises()

    // Act - don't select a farm (selectedFarmId stays empty)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // Assert
    expect(wrapper.find('.error').text()).toBe('Please select a farm')
    expect(mockCreateLot).not.toHaveBeenCalled()
  })

  it('calls createLot and redirects to /farm on success', async () => {
    // Arrange
    const wrapper = mountCreate('COLOMBIE')
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'push')

    // Act - select a farm and submit
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('farm-1')
    await selects[1]!.setValue('wh-1')
    await flushPromises()
    await wrapper.findAll('select')[2]!.setValue('zone-1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // Assert
    expect(mockCreateLot).toHaveBeenCalledWith(
      expect.objectContaining({ farm_id: 'farm-1', zone_id: 'zone-1', pays: 'COLOMBIE' }),
    )
    expect(pushSpy).toHaveBeenCalledWith('/farm')
  })

  it('shows an error when submitting without selecting a zone', async () => {
    // Arrange
    const wrapper = mountCreate('COLOMBIE')
    await flushPromises()

    // Act
    await wrapper.find('select').setValue('farm-1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // Assert
    expect(wrapper.find('.error').text()).toBe('Please select a zone')
    expect(mockCreateLot).not.toHaveBeenCalled()
  })

  it('shows an error message when createLot fails', async () => {
    // Arrange
    mockCreateLot.mockRejectedValue(new Error('Server error'))
    const wrapper = mountCreate()
    await flushPromises()

    // Act
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('farm-1')
    await selects[1]!.setValue('wh-1')
    await flushPromises()
    await wrapper.findAll('select')[2]!.setValue('zone-1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // Assert
    expect(wrapper.find('.error').text()).toContain('Server error')
  })
})
