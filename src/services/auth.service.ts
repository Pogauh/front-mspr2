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

// Backend roles -> front roles (admin gets the widest view, HQ)
const ROLE_MAP: Record<string, UserRole> = {
  ROLE_ADMIN: 'hq',
  ROLE_HEADQUARTER: 'hq',
  ROLE_WAREHOUSE_MANAGER: 'warehouse_manager',
  ROLE_QUALITY: 'quality',
  ROLE_SUPPLY_CHAIN: 'supply_chain',
  ROLE_OPERATION_MANAGER: 'farm_manager',
}

function toUser(data: BackendMe | User): User {
  if ('role' in data) return data // already a front User (mock layer)
  const backendRole = data.roles?.find((r) => ROLE_MAP[r])
  return {
    id: data.id,
    email: data.email,
    name: data.email,
    role: backendRole ? ROLE_MAP[backendRole] : 'hq',
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
