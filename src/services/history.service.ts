import { api } from './api'
import type { HistoryEntry, HistoryType } from '@/types/history.types'

interface BackendHistory {
  idHistorique: string
  type: string
  dateEmission: string
  zonePrecedente?: string | null
  zoneActuelle?: string | null
  detail?: string | null
}

export const historyService = {
  // GET /history/{idLot}?type=TRANSFERT|ALERTE|SHIPPED → List<HistoriqueResponseDto>
  getLotHistory: async (lotId: string, type?: HistoryType): Promise<HistoryEntry[]> => {
    const qs = type ? `?type=${type}` : ''
    const list = await api.get<BackendHistory[]>(`/history/${lotId}${qs}`)
    return list
      .map((h) => ({
        id: h.idHistorique,
        type: h.type,
        date: h.dateEmission,
        previous_zone_id: h.zonePrecedente ?? undefined,
        current_zone_id: h.zoneActuelle ?? undefined,
        detail: h.detail ?? undefined,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  },
}
