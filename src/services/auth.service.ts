import { api, setToken } from './api'
import type { LoginPayload, AuthResponse, User, UserRole } from '@/types/user.types'

// Shapes returned by the siege backend (AuthController)
interface BackendLoginResponse {
  token: string
  user?: User // only present when the mock layer answers
}

interface BackendMe {
  id: string
  email: string
  roles: string[]
  countryId?: string | null
}

// Backend roles are the front roles, upper-cased with a ROLE_ prefix (ROLE_FARM_MANAGER -> farm_manager)
const toFrontRole = (r: string) => r.replace(/^ROLE_/, '').toLowerCase() as UserRole

function toUser(data: BackendMe | User): User {
  if ('role' in data) return data // already a front User (mock layer)
  return {
    id: data.id,
    email: data.email,
    name: data.email,
    role: toFrontRole(data.roles[0] ?? ''),
    country_id: data.countryId ?? undefined,
  }
}

export const authService = {
  // POST /api/auth/login -> { token }, then GET /api/auth/me for the profile
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await api.post<BackendLoginResponse>('/api/auth/login', payload)
    if (res.user) return { token: res.token, user: res.user }
    setToken(res.token) // /api/auth/me needs the Bearer token
    const me = await api.get<BackendMe | User>('/api/auth/me')
    return { token: res.token, user: toUser(me) }
  },

  // The backend is stateless JWT: no logout endpoint, the session is dropped client side
  logout: async (): Promise<void> => {
    if (import.meta.env.VITE_MOCK === 'true') await api.post<void>('/api/auth/logout', {})
  },

  me: async (): Promise<User> => toUser(await api.get<BackendMe | User>('/api/auth/me')),
}
