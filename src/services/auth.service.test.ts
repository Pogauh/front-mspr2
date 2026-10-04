import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  setToken: vi.fn(),
}))

import { api, setToken } from './api'
import { authService } from './auth.service'

const mockGet = vi.mocked(api.get)
const mockPost = vi.mocked(api.post)
const mockSetToken = vi.mocked(setToken)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authService.login', () => {
  it('logs in on the backend then loads and maps the profile', async () => {
    // Arrange
    const payload = { email: 'admin@siege.fr', password: 'password123' }
    mockPost.mockResolvedValue({ token: 'tok-123' })
    mockGet.mockResolvedValue({ id: 'u-1', email: 'admin@siege.fr', roles: ['ROLE_ADMIN'], countryId: null })

    // Act
    const result = await authService.login(payload)

    // Assert
    expect(mockPost).toHaveBeenCalledWith('/api/auth/login', payload)
    expect(mockSetToken).toHaveBeenCalledWith('tok-123')
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me')
    expect(result).toEqual({
      token: 'tok-123',
      user: { id: 'u-1', email: 'admin@siege.fr', name: 'admin@siege.fr', role: 'admin', country_id: undefined },
    })
  })

  it('returns the user directly when the response already contains one (mock layer)', async () => {
    // Arrange
    const response = { token: 'tok', user: { id: 'u-1', name: 'Alice', role: 'quality' } }
    mockPost.mockResolvedValue(response)

    // Act
    const result = await authService.login({ email: 'a@b.c', password: 'x' })

    // Assert
    expect(result).toEqual(response)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('authService.me', () => {
  it('maps the backend role to the front role', async () => {
    // Arrange
    mockGet.mockResolvedValue({ id: 'u-2', email: 'q@siege.fr', roles: ['ROLE_QUALITY'], countryId: 'c-1' })

    // Act
    const result = await authService.me()

    // Assert
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me')
    expect(result).toMatchObject({ id: 'u-2', role: 'quality', country_id: 'c-1' })
  })
})
