import { useState, useEffect, useCallback } from 'react'
import { productApi, supplierApi, type Product, type Supplier } from '../api/productApi'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

// ─── Types ────────────────────────────────────────────────────
type ModalMode = 'none' | 'create-product' | 'edit-product' | 'create-supplier' | 'edit-supplier' | 'suppliers'

// ─── QRModal ─────────────────────────────────────────────────
function QRModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await productApi.generateQR(product.id)

      const image = res.qr_image.startsWith('data:')
        ? res.qr_image
        : `data:image/png;base64,${res.qr_image}`

      setQrImage(image)
    } catch {
      alert('Không thể tạo QR')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generate()
  }, [product.id])

  const downloadQR = () => {
    if (!qrImage) return

    const a = document.createElement('a')
    a.href = qrImage
    a.download = `${product.sku}-qr.png`
    a.click()
  }

  const printQR = () => {
    if (!qrImage) return

    const win = window.open('', '_blank')

    if (!win) return

    win.document.write(`
      <html>
        <head>
          <title>${product.sku}</title>
        </head>
        <body style="text-align:center;font-family:sans-serif;padding:20px">
          <h2>${product.name}</h2>
          <img src="${qrImage}" width="250"/>
          <p>${product.sku}</p>
        </body>
      </html>
    `)

    win.document.close()
    win.focus()

    setTimeout(() => {
      win.print()
    }, 300)
  }

  return (
    <div style={modal.overlay}>
      <div style={modal.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0 }}>
            QR Code — {product.name}
          </h3>

          <button onClick={onClose} style={modal.btnClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Đang tạo QR...
          </div>
        ) : (
          <>
            {qrImage && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={qrImage}
                  alt="QR"
                  width={220}
                  height={220}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                  }}
                />

                <p
                  style={{
                    marginTop: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {product.sku}
                </p>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                onClick={downloadQR}
                style={{
                  ...modal.btnPrimary,
                  flex: 1,
                }}
              >
                📥 Tải PNG
              </button>

              <button
                onClick={printQR}
                style={{
                  ...modal.btnPrimary,
                  flex: 1,
                }}
              >
                🖨️ In QR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── ProductFormModal ─────────────────────────────────────────
function ProductFormModal({
  mode, product, suppliers, onDone, onClose,
}: {
  mode: 'create-product' | 'edit-product'
  product?: Product
  suppliers: Supplier[]
  onDone: () => void
  onClose: () => void
}) {
  const [sku,         setSku]         = useState(product?.sku ?? '')
  const [name,        setName]        = useState(product?.name ?? '')
  const [unit,        setUnit]        = useState(product?.unit ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [category,    setCategory]    = useState(product?.category ?? '')
  const [minStock,    setMinStock]    = useState(product?.min_stock ?? 0)
  const [maxStock,    setMaxStock]    = useState(product?.max_stock ?? 0)
  const [supplierID,  setSupplierID]  = useState(product?.supplier_id ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const handleSubmit = async () => {
    if (!sku || !name || !unit) { setError('Vui lòng điền SKU, Tên và Đơn vị'); return }
    setLoading(true); setError('')
    try {
      if (mode === 'create-product') {
        await productApi.create({ sku, name, unit, description, category, min_stock: minStock, max_stock: maxStock, supplier_id: supplierID || undefined })
      } else if (product) {
        await productApi.update(product.id, { name, unit, description, category, min_stock: minStock, max_stock: maxStock, supplier_id: supplierID || 'clear' })
      }
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={modal.overlay}>
      <div style={{ ...modal.card, maxWidth: '36rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
            {mode === 'create-product' ? '+ Thêm sản phẩm mới' : `Sửa — ${product?.name}`}
          </h3>
          <button onClick={onClose} style={modal.btnClose}>✕</button>
        </div>

        <div style={modal.grid}>
          <label style={modal.label}>SKU *</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} disabled={mode === 'edit-product'}
            style={{ ...modal.input, ...(mode === 'edit-product' ? { background: '#f3f4f6', color: '#9ca3af' } : {}) }}
            placeholder="VD: HDMI-2M-NCC-A" />

          <label style={modal.label}>Tên sản phẩm *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={modal.input} placeholder="VD: Cáp HDMI 2m" />

          <label style={modal.label}>Đơn vị *</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} style={modal.input} placeholder="VD: cái, hộp, cuộn" />

          <label style={modal.label}>Danh mục</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={modal.input} placeholder="VD: Điện tử" />

          <label style={modal.label}>Nhà cung cấp</label>
          <select value={supplierID} onChange={(e) => setSupplierID(e.target.value)} style={modal.input}>
            <option value="">— Không có —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label style={modal.label}>Mô tả</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            style={{ ...modal.input, height: '4rem', resize: 'vertical' }} placeholder="Mô tả ngắn..." />

          <label style={modal.label}>Tồn kho tối thiểu</label>
          <input type="number" min={0} value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} style={modal.input} />

          <label style={modal.label}>Tồn kho tối đa</label>
          <input type="number" min={0} value={maxStock} onChange={(e) => setMaxStock(Number(e.target.value))} style={modal.input} />
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0' }}>⚠️ {error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button onClick={onClose} style={modal.btnSecondary}>Huỷ</button>
          <button onClick={handleSubmit} disabled={loading} style={modal.btnPrimary}>
            {loading ? 'Đang lưu...' : mode === 'create-product' ? 'Tạo sản phẩm' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SupplierManagerModal ─────────────────────────────────────
function SupplierManagerModal({
  suppliers, onRefresh, onClose,
}: {
  suppliers: Supplier[]
  onRefresh: () => void
  onClose: () => void
}) {
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [name,    setName]    = useState('')
  const [contact, setContact] = useState('')
  const [note,    setNote]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const role = useAuthStore((s) => s.role)
  const canWrite = role === 'admin' || role === 'manager'

  const resetForm = () => { setName(''); setContact(''); setNote(''); setEditTarget(null); setError('') }

  const startEdit = (s: Supplier) => {
    setEditTarget(s); setName(s.name); setContact(s.contact); setNote(s.note)
  }

  const handleSave = async () => {
    if (!name) { setError('Tên nhà cung cấp không được để trống'); return }
    setLoading(true); setError('')
    try {
      if (editTarget) {
        await supplierApi.update(editTarget.id, { name, contact, note })
      } else {
        await supplierApi.create({ name, contact, note })
      }
      resetForm()
      onRefresh()
    } catch {
      setError('Không thể lưu')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, sName: string) => {
    if (!window.confirm(`Vô hiệu hoá "${sName}"?`)) return
    try {
      await supplierApi.delete(id)
      onRefresh()
    } catch {
      alert('Không thể xoá')
    }
  }

  return (
    <div style={modal.overlay}>
      <div style={{ ...modal.card, maxWidth: '40rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>🏭 Quản lý nhà cung cấp</h3>
          <button onClick={onClose} style={modal.btnClose}>✕</button>
        </div>

        {/* Form thêm/sửa */}
        {canWrite && (
          <div style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem', border: '1.5px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.875rem', color: '#374151' }}>
              {editTarget ? `Sửa: ${editTarget.name}` : '+ Thêm nhà cung cấp'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nhà cung cấp *" style={modal.input} />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Liên hệ (SĐT / Email)" style={modal.input} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú" style={modal.input} />
              {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>⚠️ {error}</p>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editTarget && <button onClick={resetForm} style={modal.btnSecondary}>Huỷ sửa</button>}
                <button onClick={handleSave} disabled={loading} style={modal.btnPrimary}>
                  {loading ? 'Đang lưu...' : editTarget ? 'Lưu' : 'Thêm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách */}
        {suppliers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Chưa có nhà cung cấp nào</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Tên', 'Liên hệ', 'Ghi chú', ''].map((h) => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={stTd}><span style={{ fontWeight: 600 }}>{s.name}</span></td>
                  <td style={stTd}><span style={{ color: '#6b7280' }}>{s.contact || '—'}</span></td>
                  <td style={stTd}><span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{s.note || '—'}</span></td>
                  <td style={{ ...stTd, whiteSpace: 'nowrap' }}>
                    {canWrite && (
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button onClick={() => startEdit(s)} style={s2.btnEdit}>Sửa</button>
                        <button onClick={() => handleDelete(s.id, s.name)} style={s2.btnDel}>Xoá</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProductsPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)
  const canWrite = role === 'admin' || role === 'manager'

  const [products,  setProducts]  = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  // productId → total_quantity
  const [stockMap,  setStockMap]  = useState<Record<string, number>>({})
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [search,    setSearch]    = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [loading,   setLoading]   = useState(false)

  const [modalMode,  setModalMode]  = useState<ModalMode>('none')
  const [editTarget, setEditTarget] = useState<Product | undefined>()
  const [qrTarget,   setQrTarget]   = useState<Product | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productApi.list({ search: search || undefined, supplier_id: filterSupplier || undefined, page, limit: 20 })
      setProducts(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, filterSupplier, page])

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await supplierApi.list()
      setSuppliers(res ?? [])
    } catch {
      // silent
    }
  }, [])

  const loadStock = useCallback(async () => {
    try {
      const res = await api.get('/stock')
  
      const items: {
        product_id: string
        total_quantity: number
      }[] = res.data?.data ?? []
  
      const map: Record<string, number> = {}
  
      items.forEach((item) => {
        map[item.product_id] = item.total_quantity
      })
  
      setStockMap(map)
    } catch (err) {
      console.error('Load stock failed', err)
    }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadSuppliers() }, [loadSuppliers])
  useEffect(() => { loadStock() }, [loadStock])

  const openCreate = () => { setEditTarget(undefined); setModalMode('create-product') }
  const openEdit   = (p: Product) => { setEditTarget(p); setModalMode('edit-product') }
  const onDone     = () => { setModalMode('none'); loadProducts() }

  const handleToggleActive = async (p: Product) => {
    if (!window.confirm(`${p.is_active ? 'Vô hiệu hoá' : 'Kích hoạt lại'} "${p.name}"?`)) return
    try {
      const newActive = !p.is_active
      await productApi.update(p.id, { is_active: newActive })
      loadProducts()
    } catch {
      alert('Không thể cập nhật')
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Danh sách sản phẩm</h1>
          <p style={s.subtitle}>Quản lý sản phẩm và nhà cung cấp · {total} sản phẩm</p>
          <button onClick={() => navigate('/dashboard')} style={s.btnBack}>← Dashboard</button>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setModalMode('suppliers')} style={s.btnSecondary}>
              🏭 Nhà cung cấp
            </button>
            <button onClick={openCreate} style={s.btnPrimary}>
              + Thêm sản phẩm
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="🔍 Tìm theo tên hoặc SKU..."
          style={{ ...s.select, width: '240px' }}
        />
        <select value={filterSupplier} onChange={(e) => { setFilterSupplier(e.target.value); setPage(1) }} style={s.select}>
          <option value="">Tất cả nhà cung cấp</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.id}>{sup.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>Đang tải...</div>
        ) : products.length === 0 ? (
          <div style={s.empty}>Không tìm thấy sản phẩm nào</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['SKU', 'Tên sản phẩm', 'Đơn vị', 'Danh mục', 'Nhà cung cấp', 'Tồn kho', 'Trạng thái', 'Thao tác'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={s.td}>
                    <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: '#111827' }}>
                      {p.sku}
                    </code>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{p.name}</span>
                    {p.description && (
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#9ca3af', maxWidth: '200px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.description}
                      </p>
                    )}
                  </td>
                  <td style={s.td}><span style={s.badge('#f0fdf4', '#166534')}>{p.unit}</span></td>
                  <td style={s.td}><span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{p.category || '—'}</span></td>
                  <td style={s.td}>
                    {p.supplier ? (
                      <span style={s.badge('#eff6ff', '#1d4ed8')}>{p.supplier.name}</span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={s.td}>
                    {(() => {
                      const qty = stockMap[p.id] ?? null
                      if (qty === null) return <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
                      const color = qty === 0 ? '#dc2626' : p.min_stock > 0 && qty < p.min_stock ? '#d97706' : '#16a34a'
                      return (
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color }}>
                          {qty.toLocaleString()}
                          <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                            {p.unit}
                          </span>
                        </span>
                      )
                    })()}
                  </td>
                  <td style={s.td}>
                    <span style={p.is_active
                      ? s.badge('#dcfce7', '#166534')
                      : s.badge('#f3f4f6', '#6b7280')}>
                      {p.is_active ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <button onClick={() => setQrTarget(p)} style={s2.btnQr}>QR</button>
                      {canWrite && (
                        <>
                          <button onClick={() => openEdit(p)} style={s2.btnEdit}>Sửa</button>
                          <button onClick={() => handleToggleActive(p)}
                            style={p.is_active ? s2.btnDel : s2.btnActivate}>
                            {p.is_active ? 'Khoá' : 'Mở'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={s.pageBtn(page === 1)}>← Trước</button>
          <span style={{ fontWeight: 600, color: '#374151' }}>Trang {page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} style={s.pageBtn(page === totalPages)}>Sau →</button>
        </div>
      )}

      {/* Modals */}
      {(modalMode === 'create-product' || modalMode === 'edit-product') && (
        <ProductFormModal
          mode={modalMode}
          product={editTarget}
          suppliers={suppliers}
          onDone={onDone}
          onClose={() => setModalMode('none')}
        />
      )}
      {modalMode === 'suppliers' && (
        <SupplierManagerModal
          suppliers={suppliers}
          onRefresh={loadSuppliers}
          onClose={() => setModalMode('none')}
        />
      )}
      {qrTarget && (
        <QRModal product={qrTarget} onClose={() => setQrTarget(null)} />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  page:      { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:    { padding: '1.5rem 2rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#fff',
               display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' as const, gap: '1rem' } as React.CSSProperties,
  title:     { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle:  { margin: '0.25rem 0 0.5rem', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  filters:   { padding: '0.875rem 2rem', display: 'flex', gap: '0.75rem', background: '#fff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' as const } as React.CSSProperties,
  select:    { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#374151' } as React.CSSProperties,
  tableWrap: { margin: '1.5rem 2rem', background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' } as React.CSSProperties,
  table:     { width: '100%', borderCollapse: 'collapse' as const },
  th:        { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.72rem', fontWeight: 700,
               color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  td:        { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  badge:     (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '999px',
    background: bg, color, fontSize: '0.75rem', fontWeight: 700,
  }),
  empty:     { padding: '3rem', textAlign: 'center' as const, color: '#9ca3af', fontSize: '0.9rem' },
  pagination:{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', color: '#6b7280', fontSize: '0.875rem' } as React.CSSProperties,
  pageBtn:   (disabled: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem',
    background: disabled ? '#f3f4f6' : '#fff', color: disabled ? '#9ca3af' : '#374151',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.875rem',
  }),
  btnBack:    { padding: '0.35rem 0.875rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', color: '#374151' } as React.CSSProperties,
  btnPrimary: { padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' } as React.CSSProperties,
  btnSecondary: { padding: '0.5rem 1.25rem', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' } as React.CSSProperties,
}

const s2 = {
  btnQr:      { padding: '0.25rem 0.625rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnEdit:    { padding: '0.25rem 0.625rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnDel:     { padding: '0.25rem 0.625rem', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnActivate:{ padding: '0.25rem 0.625rem', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
}

const modal = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  card:    { background: '#fff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '28rem', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' as const },
  grid:    { display: 'flex', flexDirection: 'column' as const, gap: '0.625rem' },
  label:   { fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginTop: '0.25rem' } as React.CSSProperties,
  input:   { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', color: '#111827', width: '100%', boxSizing: 'border-box' as const },
  btnClose:    { background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af', padding: '0.25rem' } as React.CSSProperties,
  btnPrimary:  { flex: 2, padding: '0.625rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnSecondary:{ flex: 1, padding: '0.625rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' } as React.CSSProperties,
}

const stTd: React.CSSProperties = { padding: '0.75rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' }