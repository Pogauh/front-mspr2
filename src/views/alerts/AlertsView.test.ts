import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import AlertsView from './AlertsView.vue'

vi.mock('@/services/alerts.service', () => ({
  alertsService: {
    getAlerts: vi.fn(),
    markAsRead: vi.fn(),
  },
}))

import { alertsService } from '@/services/alerts.service'

const mockGetAlerts = vi.mocked(alertsService.getAlerts)
const mockMarkAsRead = vi.mocked(alertsService.markAsRead)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/alerts', component: { template: '<div />' } }],
})

const makeAlert = (overrides = {}) => ({
  id: 'a-1',
  type: 'threshold' as const,
  message: 'Temperature too high',
  is_read: false,
  is_active: true,
  created_at: '2024-01-15T10:00:00',
  zone_name: 'Zone A',
  ...overrides,
})

function mountAlerts() {
  return mount(AlertsView, {
    global: {
      plugins: [
        router,
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { auth: { user: null } },
        }),
      ],
      stubs: { Pagination: true, CascadeFilter: true },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAlerts.mockResolvedValue({ data: [makeAlert()], total: 1, page: 1, limit: 20 })
  mockMarkAsRead.mockResolvedValue({} as never)
})

describe('AlertsView', () => {
  it('shows the loading indicator while alerts are being fetched', async () => {
    // Arrange
    mockGetAlerts.mockImplementation(() => new Promise(() => {}))
    const wrapper = mountAlerts()
    await nextTick()

    // Assert
    expect(wrapper.find('.loading').exists()).toBe(true)
  })

  it('renders alerts after loading completes', async () => {
    // Arrange + Act
    const wrapper = mountAlerts()
    await flushPromises()

    // Assert
    expect(wrapper.text()).toContain('Temperature too high')
  })

  it('shows "No alerts" when the list is empty', async () => {
    // Arrange
    mockGetAlerts.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 })
    const wrapper = mountAlerts()
    await flushPromises()

    // Assert
    expect(wrapper.find('.empty').text()).toBe('No alerts')
  })

  it('shows "Mark as read" button for unread alerts', async () => {
    // Arrange + Act
    const wrapper = mountAlerts()
    await flushPromises()

    // Assert
    expect(wrapper.find('.btn-read').exists()).toBe(true)
  })

  it('shows "✓ Read" label and hides the button after marking as read', async () => {
    // Arrange
    const wrapper = mountAlerts()
    await flushPromises()

    // Act
    await wrapper.find('.btn-read').trigger('click')
    await flushPromises()

    // Assert
    expect(wrapper.find('.read-label').exists()).toBe(true)
    expect(wrapper.find('.btn-read').exists()).toBe(false)
  })

  it('calls getAlerts with type filter when type filter changes', async () => {
    // Arrange
    const wrapper = mountAlerts()
    await flushPromises()
    mockGetAlerts.mockClear()

    // Act
    await wrapper.find('select').setValue('fifo')
    await flushPromises()

    // Assert
    expect(mockGetAlerts).toHaveBeenCalledWith(expect.objectContaining({ type: 'fifo' }))
  })
})
