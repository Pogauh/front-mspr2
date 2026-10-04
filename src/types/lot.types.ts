export type LotStatus = string

export interface Lot {
  id: string
  batch_number: string
  farm_id: string
  farm_name?: string
  country_id?: string
  country_name?: string
  warehouse_id?: string
  warehouse_name?: string
  zone_id?: string
  zone_name?: string
  quantity?: number
  characteristic?: number
  production_date: string
  storage_date?: string
  status: LotStatus
  latest_reading?: {
    temperature: number
    humidity: number
    recorded_at: string
    threshold_status: 'ok' | 'warn' | 'alert'
  }
}

export interface LotFilters {
  country_id?: string
  farm_id?: string
  warehouse_id?: string
  zone_id?: string
  status?: LotStatus
  search?: string
  page?: number
  limit?: number
  sort?: 'storage_date_asc' | 'storage_date_desc' | 'production_date_asc'
  withReadings?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
