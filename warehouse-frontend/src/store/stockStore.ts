import { create } from 'zustand'
import type { StockUpdatePayload, AlertPayload } from '../hooks/useSocket'

interface StockState {
  // productId → total_quantity (cập nhật real-time qua WS)
  quantities: Record<string, number>
  alerts:     AlertPayload[]

  setQuantity:  (payload: StockUpdatePayload) => void
  addAlert:     (alert: AlertPayload) => void
  dismissAlert: (productId: string) => void
  clearAlerts:  () => void
}

export const useStockStore = create<StockState>((set) => ({
  quantities: {},
  alerts:     [],

  setQuantity: (payload) =>
    set((s) => ({
      quantities: { ...s.quantities, [payload.product_id]: payload.total_quantity },
    })),

  addAlert: (alert) =>
    set((s) => ({
      // giữ mỗi product 1 alert mới nhất
      alerts: [alert, ...s.alerts.filter((a) => a.product_id !== alert.product_id)],
    })),

  dismissAlert: (productId) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.product_id !== productId) })),

  clearAlerts: () => set({ alerts: [] }),
}))