import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'

// ─── Payload types ────────────────────────────────────────────

export type WsMessage<T = unknown> = { event: string; data: T }

export type StockUpdatePayload = {
  product_id: string
  product_name: string
  total_quantity: number
  delta: number
  tx_code: string
}

export type AlertPayload = {
  product_id: string
  product_name: string
  current_quantity: number
  min_stock: number
  level: 'warning' | 'critical'
  message?: string
}

export type TransactionUpdatePayload = {
  transaction_id:   string
  transaction_code: string
  status:           string
  created_by_id:    string
}

export type BinSuggestionPayload = {
  transaction_id:        string
  transaction_code:      string
  item_id:               string
  product_name:          string
  suggested_bin_id:      string
  suggested_bin_display: string
  created_by_id:         string
}

export type Handlers = {
  onStockUpdate?:        (payload: StockUpdatePayload) => void
  onAlert?:              (payload: AlertPayload) => void
  onTransactionUpdate?:  (payload: TransactionUpdatePayload) => void
  onBinSuggestion?:      (payload: BinSuggestionPayload) => void
}

// ─── Singleton state (module-level, 1 instance toàn app) ──────

type AnyHandler = (payload: unknown) => void
const subscribers = new Map<string, Set<AnyHandler>>()
let globalWs: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws'

function dispatch(event: string, payload: unknown) {
  console.log('[WS] dispatch event:', event, 'subscribers:', subscribers.get(event)?.size ?? 0)
  subscribers.get(event)?.forEach((fn) => fn(payload))
}

function wsConnect() {
  if (
    globalWs?.readyState === WebSocket.OPEN ||
    globalWs?.readyState === WebSocket.CONNECTING
  ) return

  const ws = new WebSocket(WS_URL)
  globalWs = ws

  ws.onopen = () => {
    console.log('[WS] connected')
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  ws.onmessage = (e) => {
    try {
      const msg: WsMessage = JSON.parse(e.data)
      dispatch(msg.event, msg.data)
    } catch {
      console.warn('[WS] parse error', e.data)
    }
  }

  ws.onclose = () => {
    console.log('[WS] disconnected')
    globalWs = null
    if (useAuthStore.getState().token) {
      reconnectTimer = setTimeout(wsConnect, 3000)
    }
  }

  ws.onerror = () => ws.close()
}

function wsDisconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  globalWs?.close()
  globalWs = null
}

function addSubscriber(event: string, fn: AnyHandler) {
  if (!subscribers.has(event)) subscribers.set(event, new Set())
  subscribers.get(event)!.add(fn)
}

function removeSubscriber(event: string, fn: AnyHandler) {
  subscribers.get(event)?.delete(fn)
}

// ─── Hook ─────────────────────────────────────────────────────

export function useSocket(handlers: Handlers) {
  const token = useAuthStore((s) => s.token)

  // Luôn giữ handlers mới nhất — tránh stale closure
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!token) {
      wsDisconnect()
      return
    }

    // Đảm bảo có đúng 1 WS connection toàn app
    wsConnect()

    // Tạo stable wrapper functions trỏ vào handlersRef
    const onStockUpdate       = (p: unknown) => handlersRef.current.onStockUpdate?.(p as StockUpdatePayload)
    const onAlert             = (p: unknown) => handlersRef.current.onAlert?.(p as AlertPayload)
    const onTransactionUpdate = (p: unknown) => handlersRef.current.onTransactionUpdate?.(p as TransactionUpdatePayload)
    const onBinSuggestion     = (p: unknown) => handlersRef.current.onBinSuggestion?.(p as BinSuggestionPayload)

    addSubscriber('stock_update',        onStockUpdate)
    addSubscriber('alert',               onAlert)
    addSubscriber('transaction_update',  onTransactionUpdate)
    addSubscriber('bin_suggestion',      onBinSuggestion)

    return () => {
      removeSubscriber('stock_update',        onStockUpdate)
      removeSubscriber('alert',               onAlert)
      removeSubscriber('transaction_update',  onTransactionUpdate)
      removeSubscriber('bin_suggestion',      onBinSuggestion)
    }
  }, [token])
}