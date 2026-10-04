export type UserRole =
  | 'farm_manager'
  | 'warehouse_manager'
  | 'quality'
  | 'supply_chain'
  | 'hq'
  | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  country_id?: string
  farm_id?: string
  warehouse_ids?: string[]
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}
