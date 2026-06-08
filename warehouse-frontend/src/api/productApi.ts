import api from './axios'

// ── Types ─────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  contact: string
  note: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  unit: string
  description: string
  category: string
  qr_code?: string
  rfid_uid?: string
  image_url: string
  min_stock: number
  max_stock: number
  supplier_id?: string
  supplier?: Supplier
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  limit: number
}

export interface CreateProductPayload {
  sku: string
  name: string
  unit: string
  description?: string
  category?: string
  qr_code?: string
  rfid_uid?: string
  min_stock?: number
  max_stock?: number
  supplier_id?: string
}

export interface UpdateProductPayload {
  name?: string
  unit?: string
  description?: string
  category?: string
  min_stock?: number
  max_stock?: number
  is_active?: boolean
  supplier_id?: string // "" = không đổi, "clear" = xóa NCC
}

export interface CreateSupplierPayload {
  name: string
  contact?: string
  note?: string
}

export interface UpdateSupplierPayload {
  name?: string
  contact?: string
  note?: string
  is_active?: boolean
}

// ── Product API ───────────────────────────────────────────────

export const productApi = {
  list: (params?: {
    search?: string
    category?: string
    supplier_id?: string
    is_active?: boolean
    page?: number
    limit?: number
  }): Promise<ProductListResponse> =>
    api.get('/products', { params }).then((r) => r.data.data),

  getByID: (id: string): Promise<Product> =>
    api.get(`/products/${id}`).then((r) => r.data.data),

  create: (payload: CreateProductPayload): Promise<Product> =>
    api.post('/products', payload).then((r) => r.data.data),

  update: (id: string, payload: UpdateProductPayload): Promise<Product> =>
    api.put(`/products/${id}`, payload).then((r) => r.data.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/products/${id}`).then(() => undefined),

  generateQR: (id: string): Promise<{ product: Product; qr_image: string; qr_value: string }> =>
    api.post(`/products/${id}/generate-qr`).then((r) => r.data.data),
}

// ── Supplier API ──────────────────────────────────────────────

export const supplierApi = {
  list: (): Promise<Supplier[]> =>
    api.get('/suppliers').then((r) => r.data.data),

  getByID: (id: string): Promise<Supplier> =>
    api.get(`/suppliers/${id}`).then((r) => r.data.data),

  create: (payload: CreateSupplierPayload): Promise<Supplier> =>
    api.post('/suppliers', payload).then((r) => r.data.data),

  update: (id: string, payload: UpdateSupplierPayload): Promise<Supplier> =>
    api.put(`/suppliers/${id}`, payload).then((r) => r.data.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/suppliers/${id}`).then(() => undefined),
}