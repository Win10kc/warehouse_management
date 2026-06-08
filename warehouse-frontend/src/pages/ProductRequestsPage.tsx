import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'
import { useSocket, type AlertPayload } from '../hooks/useSocket'

interface ProductRequest {
  id: string
  raw_code: string
  suggested_name: string
  supplier_name: string
  note: string
  status: string
  created_at: string
  reported_by: {
    full_name: string
    username: string
  }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#fef3c7', color: '#92400e', label: 'Chờ xử lý' },
  resolved: { bg: '#dcfce7', color: '#166534', label: 'Đã xử lý' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Từ chối' },
}

// ─── Modal tạo sản phẩm mới từ request ───────────────────────
function CreateProductModal({
  request,
  onDone,
  onClose,
}: {
  request: ProductRequest
  onDone: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    sku:         '',
    name:        request.suggested_name,
    unit:        'cái',
    description: request.note,
    category:    '',
    supplier_name: request.supplier_name,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleCreate = async () => {
    if (!form.sku.trim())  { setError('Vui lòng nhập SKU'); return }
    if (!form.name.trim()) { setError('Vui lòng nhập tên sản phẩm'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/products', {
        sku:         form.sku.trim(),
        name:        form.name.trim(),
        unit:        form.unit.trim() || 'cái',
        description: form.description.trim(),
        category:    form.category.trim(),
        min_stock:   0,
        max_stock:   0,
        qr_code:     request.raw_code || undefined,
      })
      await api.put(`/product-requests/${request.id}/resolve`)
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={ms.overlay}>
      <div style={ms.card}>
        <h3 style={ms.title}>Tạo sản phẩm mới</h3>
        <div style={ms.infoBox}>
          <p style={ms.infoRow}><span style={ms.infoLabel}>Mã quét:</span> <span style={ms.mono}>{request.raw_code}</span></p>
          <p style={ms.infoRow}><span style={ms.infoLabel}>Báo cáo bởi:</span> {request.reported_by?.full_name} (@{request.reported_by?.username})</p>
          {request.supplier_name && (
  <p style={ms.infoRow}>
    <span style={ms.infoLabel}>Nhà cung cấp (staff báo):</span>
    {request.supplier_name}
  </p>
)}
          {request.note && <p style={ms.infoRow}><span style={ms.infoLabel}>Ghi chú:</span> {request.note}</p>}
        </div>
        <label style={ms.label}>
          SKU *
          <input style={ms.input} value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="VD: SP-001" />
        </label>
        <label style={ms.label}>
          Tên sản phẩm *
          <input style={ms.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tên sản phẩm" />
        </label>
        <label style={ms.label}>
          Đơn vị tính
          <input style={ms.input} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="cái, hộp, kg..." />
        </label>
        <label style={ms.label}>
          Danh mục
          <input style={ms.input} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Tuỳ chọn" />
        </label>
        <label style={ms.label}>
          Mô tả
          <input style={ms.input} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Tuỳ chọn" />
        </label>
        {error && <p style={ms.error}>⚠️ {error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button style={ms.btnCancel} onClick={onClose} disabled={saving}>Huỷ</button>
          <button style={ms.btnConfirm(saving)} onClick={handleCreate} disabled={saving}>
            {saving ? 'Đang tạo...' : 'Tạo sản phẩm & Resolve'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProductRequestsPage() {
  const navigate = useNavigate()
  const [requests,   setRequests]   = useState<ProductRequest[]>([])
  const [loading,    setLoading]    = useState(false)
  const [filter,     setFilter]     = useState('pending')
  const [createFrom, setCreateFrom] = useState<ProductRequest | null>(null)
  // Badge số báo cáo mới chưa đọc kể từ lần load cuối
  const [newCount,   setNewCount]   = useState(0)
  const loadedRef = useRef(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/product-requests', {
        params: filter ? { status: filter } : {},
      })
      setRequests(res.data.data ?? [])
      setNewCount(0) // reset khi đã load xong
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false) }
  }, [filter])

  useEffect(() => {
    loadedRef.current = false
    load().then(() => { loadedRef.current = true })
  }, [load])

  // ── Real-time: lắng nghe WS alert product_request ──────────
  const handleAlert = useCallback((payload: AlertPayload) => {
    if (payload.message && !payload.product_id) {
      // Đây là product_request alert — nếu đang filter pending thì reload silent
      if (filter === 'pending' || filter === '') {
        load(true)
      } else {
        // Đang xem tab khác → chỉ tăng badge
        setNewCount((n) => n + 1)
      }
    }
  }, [filter, load])

  useSocket({ onAlert: handleAlert })

  const handleReject = async (id: string) => {
    if (!window.confirm('Từ chối báo cáo này?')) return
    await api.put(`/product-requests/${id}/reject`)
    load()
  }

  const pending = requests.filter((r) => r.status === 'pending').length

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Báo cáo sản phẩm mới</h1>
          <p style={s.subtitle}>
            {pending > 0
              ? <><strong style={{ color: '#d97706' }}>{pending} báo cáo chờ xử lý</strong> · {requests.length} tổng</>
              : `${requests.length} báo cáo`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setNewCount(0) }} style={s.select}>
            <option value="">Tất cả</option>
            <option value="pending">
              Chờ xử lý{newCount > 0 && filter !== 'pending' ? ` (+${newCount} mới)` : ''}
            </option>
            <option value="resolved">Đã xử lý</option>
            <option value="rejected">Từ chối</option>
          </select>
          <button style={s.btnBack} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Banner thông báo có báo cáo mới khi đang ở tab khác */}
      {newCount > 0 && (
        <div style={s.newBanner}>
          📋 Có <strong>{newCount} báo cáo mới</strong> — chuyển sang tab "Chờ xử lý" để xem
          <button
            style={s.newBannerBtn}
            onClick={() => { setFilter('pending'); setNewCount(0) }}
          >
            Xem ngay
          </button>
        </div>
      )}

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}>Đang tải...</div>
        ) : requests.length === 0 ? (
          <div style={s.center}>Không có báo cáo nào</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Mã quét được</th>
                <th style={s.th}>Tên đề xuất</th>
                <th style={s.th}>Ghi chú</th>
                <th style={s.th}>Báo cáo bởi</th>
                <th style={s.th}>Thời gian</th>
                <th style={s.th}>Trạng thái</th>
                <th style={s.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, idx) => {
                const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
                return (
                  <tr key={r.id} style={s.tr(idx % 2 === 1)}>
                    <td style={s.td}><span style={s.mono}>{r.raw_code}</span></td>
                    <td style={s.td}><strong>{r.suggested_name}</strong></td>
                    <td style={{ ...s.td, color: '#6b7280', maxWidth: '12rem' }}>{r.note || '—'}</td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 600 }}>{r.reported_by?.full_name}</span>
                      <br />
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>@{r.reported_by?.username}</span>
                    </td>
                    <td style={s.td}>
                      {new Date(r.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(st.bg, st.color)}>{st.label}</span>
                    </td>
                    <td style={s.td}>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button style={s.btnCreate} onClick={() => setCreateFrom(r)}>+ Tạo SKU</button>
                          <button style={s.btnReject} onClick={() => handleReject(r.id)}>Từ chối</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {createFrom && (
        <CreateProductModal
          request={createFrom}
          onDone={() => { setCreateFrom(null); load() }}
          onClose={() => setCreateFrom(null)}
        />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  page:        { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:      { padding: '2rem', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  title:       { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle:    { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  select:      { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#374151' } as React.CSSProperties,
  btnBack:     { padding: '0.5rem 1rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', color: '#374151' } as React.CSSProperties,
  tableWrap:   { margin: '1.5rem 2rem', background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' } as React.CSSProperties,
  table:       { width: '100%', borderCollapse: 'collapse' as const },
  thead:       { background: '#f9fafb' },
  th:          { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  tr:          (odd: boolean): React.CSSProperties => ({ background: odd ? '#fafafa' : '#fff' }),
  td:          { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  mono:        { fontFamily: 'monospace', fontWeight: 700, color: '#111827', fontSize: '0.85rem' } as React.CSSProperties,
  badge:       (bg: string, color: string): React.CSSProperties => ({ display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '999px', background: bg, color, fontSize: '0.75rem', fontWeight: 700 }),
  btnCreate:   { padding: '0.3rem 0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnReject:   { padding: '0.3rem 0.75rem', background: '#fff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  center:      { padding: '4rem', textAlign: 'center' as const, color: '#9ca3af' },
  newBanner:   { margin: '1rem 2rem 0', padding: '0.75rem 1rem', background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '0.625rem', color: '#92400e', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' } as React.CSSProperties,
  newBannerBtn:{ padding: '0.3rem 0.75rem', background: '#d97706', color: '#fff', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
}

const ms = {
  overlay:   { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  card:      { background: '#fff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '28rem', width: '100%', margin: '1rem', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  title:     { margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  infoBox:   { background: '#f8fafc', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  infoRow:   { margin: 0, fontSize: '0.8rem', color: '#374151' } as React.CSSProperties,
  infoLabel: { fontWeight: 700, color: '#6b7280', marginRight: '0.375rem' } as React.CSSProperties,
  mono:      { fontFamily: 'monospace', fontWeight: 700, color: '#111827' } as React.CSSProperties,
  label:     { display: 'flex', flexDirection: 'column' as const, gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  input:     { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', color: '#111827', background: '#fff' } as React.CSSProperties,
  error:     { color: '#dc2626', fontSize: '0.8rem', margin: 0 } as React.CSSProperties,
  btnCancel: { flex: 1, padding: '0.625rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' } as React.CSSProperties,
  btnConfirm:(disabled: boolean): React.CSSProperties => ({ flex: 2, padding: '0.625rem', background: disabled ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }),
}