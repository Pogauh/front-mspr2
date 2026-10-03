import { mockFetch } from '@/mocks/handlers'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

let _token: string | null = null
let _onUnauthorized: (() => void) | null = null

export function setToken(token: string | null) {
  _token = token
}

export function setUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`
  }

  const fullUrl = `${BASE_URL}${path}`

  let response: Response
  if (IS_MOCK) {
    response = await mockFetch(fullUrl, { ...options, headers })
  } else {
    response = await fetch(fullUrl, { ...options, headers })
  }

  if (response.status === 401) {
    _onUnauthorized?.()
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
