import api from './axios'

// ─── Types ────────────────────────────────────────────────────

export type TransactionType   = 'import' | 'export' | 'transfer'
export type TransactionStatus = 'draft' | 'pending' | 'processing' | 'done' | 'rejected'

export interface UserSummary {
  id:        string
  username:  string
  full_name: string
  role:      string
}

export interface TransactionItemInput {
  product_id:          string
  from_bin_id?:        string
  to_bin_id?:          string
  quantity_requested:  number
  scan_method?:        string
}

export interface CreateTransactionPayload {
  type:   TransactionType
  note?:  string
  items:  TransactionItemInput[]
}

export interface CompleteItemInput {
  product_id:       string
  from_bin_id?:     string
  to_bin_id?:       string
  quantity_actual:  number
}

// BinInfo: trả về trong FindByID (detail page), không có trong List
export interface BinInfo {
  id:             string
  code:           string
  rack_code:      string
  zone_code:      string
  zone_name:      string
  warehouse_name: string
}

export interface TransactionItem {
  id:                  string
  product_id:          string
  product:             { id: string; name: string; sku: string; unit: string }
  from_bin_id:         string | null
  to_bin_id:           string | null
  // from_bin/to_bin chỉ có trong GET /transactions/:id (detail), không có trong list
  from_bin?:           BinInfo | null
  to_bin?:             BinInfo | null
  quantity_requested:  number
  quantity_actual:     number
  scan_method:         string
  suggested_bin_id?: string
  suggested_bin?: BinInfo
}

export interface Transaction {
  id:           string
  code:         string
  type:         TransactionType
  status:       TransactionStatus
  note:         string
  created_at:   string
  approved_at:  string | null
  completed_at: string | null
  created_by:   UserSummary
  approved_by?: UserSummary
  items:        TransactionItem[]
}

// ─── API calls ────────────────────────────────────────────────

export const transactionApi = {
  list: (params?: {
    type?:           string
    status?:         string
    page?:           number
    limit?:          number
    created_by_me?:  boolean
  }) => api.get('/transactions', { params }).then((r) => r.data.data),

  getById: (id: string) =>
    api.get(`/transactions/${id}`).then((r) => r.data.data),

  create: (payload: CreateTransactionPayload) =>
    api.post('/transactions', payload).then((r) => r.data.data),

  approve: (id: string) =>
    api.put(`/transactions/${id}/approve`).then((r) => r.data.data),

  complete: (id: string, items: CompleteItemInput[]) =>
    api.put(`/transactions/${id}/complete`, { items }).then((r) => r.data.data),

  reject: (id: string) =>
    api.put(`/transactions/${id}/reject`).then((r) => r.data.data),
  
  suggestBin: (txId: string, itemId: string, binId: string) =>
    api.put(`/transactions/${txId}/suggest-bin`, { item_id: itemId, bin_id: binId })
       .then((r) => r.data),
}

export const stockApi = {
  list: () =>
    api.get('/stock').then((r) => r.data.data),

  getByProduct: (productId: string) =>
    api.get(`/stock/${productId}`).then((r) => r.data.data),
}

// ─── Dashboard helpers ────────────────────────────────────────

export const dashboardApi = {
  getSummary: () =>
    api.get('/transactions', { params: { limit: 200, page: 1 } })
       .then((r) => r.data.data as { items: Transaction[]; total: number }),

  getRecentDone: () =>
    api.get('/transactions', { params: { status: 'done', limit: 100, page: 1 } })
       .then((r) => r.data.data as { items: Transaction[]; total: number }),
}