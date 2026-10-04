export type HistoryType = 'TRANSFERT' | 'ALERTE' | 'SHIPPED'

export interface HistoryEntry {
  id: string
  type: string
  date: string
  previous_zone_id?: string
  current_zone_id?: string
  detail?: string
}
