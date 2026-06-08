import { useState, useEffect, useCallback, useRef } from 'react'
import { transactionApi, type Transaction } from '../api/transactionApi'
import { useNavigate } from 'react-router-dom'
import ExportPanel from '../components/ExportPanel'
import { useAuthStore } from '../store/authStore'
// Thêm vào import
import { useSocket } from '../hooks/useSocket'

// ─── Constants ────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fef3c7', color: '#92400e', label: 'Chờ duyệt' },
  processing: { bg: '#dbeafe', color: '#1e40af', label: 'Đang thực hiện' },
  done:       { bg: '#dcfce7', color: '#166534', label: 'Hoàn tất' },
  rejected:   { bg: '#fee2e2', color: '#991b1b', label: 'Từ chối' },
  draft:      { bg: '#f3f4f6', color: '#374151', label: 'Nháp' },
}

const TYPE_LABEL: Record<string, string> = {
  import: '📥 Nhập', export: '📤 Xuất', transfer: '🔄 Chuyển',
}

// ─── CompleteModal ────────────────────────────────────────────
function CompleteModal({
  tx,
  onDone,
  onClose,
}: {
  tx: Transaction
  onDone: () => void
  onClose: () => void
}) {
  const [actuals, setActuals] = useState<Record<string, number>>(
    Object.fromEntries(tx.items.map((i) => [i.product_id, i.quantity_requested]))
  )
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleComplete = async () => {
    setError('')
    setLoading(true)
    try {
      const items = tx.items.map((i) => ({
        product_id:      i.product_id,
        from_bin_id:     i.from_bin_id ?? undefined,
        to_bin_id:       i.to_bin_id   ?? undefined,
        quantity_actual: actuals[i.product_id] ?? 0,
      }))
      await transactionApi.complete(tx.id, items)
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <h3 style={modalStyles.title}>Xác nhận số lượng thực tế</h3>
        <p style={modalStyles.sub}>Phiếu: <strong>{tx.code}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', margin: '1rem 0' }}>
          {tx.items.map((item) => (
            <div key={item.id} style={modalStyles.itemRow}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>
                  {item.product?.name ?? item.product_id}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                  Yêu cầu: {item.quantity_requested} {item.product?.unit}
                </p>
              </div>
              <input
                type="number"
                min={0}
                value={actuals[item.product_id] ?? 0}
                onChange={(e) =>
                  setActuals((p) => ({ ...p, [item.product_id]: Number(e.target.value) }))
                }
                style={modalStyles.qtyInput}
              />
            </div>
          ))}
        </div>
        {error && (
          <p style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            ⚠️ {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={modalStyles.btnCancel} onClick={onClose} disabled={loading}>Huỷ</button>
          <button style={modalStyles.btnConfirm(loading)} onClick={handleComplete} disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Xác nhận hoàn tất'}
          </button>
        </div>
      </div>
    </div>
  )
}

const modalStyles = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: '1rem',
    padding: '1.75rem', maxWidth: '28rem', width: '100%', margin: '1rem',
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
  },
  title: { margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 800 },
  sub:   { margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#6b7280' },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.625rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem',
  } as React.CSSProperties,
  qtyInput: {
    width: '5rem', padding: '0.375rem 0.5rem', border: '1.5px solid #d1d5db',
    borderRadius: '0.375rem', fontSize: '0.9rem', textAlign: 'center' as const,
    fontFamily: 'inherit',
  },
  btnCancel: {
    flex: 1, padding: '0.625rem', background: '#fff', border: '1.5px solid #d1d5db',
    borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#000',
  } as React.CSSProperties,
  btnConfirm: (disabled: boolean): React.CSSProperties => ({
    flex: 2, padding: '0.625rem', background: disabled ? '#93c5fd' : '#2563eb',
    color: '#fff', border: 'none', borderRadius: '0.625rem',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }),
}

// ─── Toast notification ───────────────────────────────────────
interface ToastMsg { id: number; text: string }

function Toast({ toasts }: { toasts: ToastMsg[] }) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 2000,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: '#1e3a5f', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '0.625rem',
          fontSize: '0.875rem', fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'slideIn 0.2s ease',
        }}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function TransactionListPage() {
  const navigate = useNavigate()
  const [items,      setItems]      = useState<Transaction[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [status,     setStatus]     = useState('')
  const [txType,     setTxType]     = useState('')
  const [loading,    setLoading]    = useState(false)
  const [completeTx, setCompleteTx] = useState<Transaction | null>(null)
  const [toasts,     setToasts]     = useState<ToastMsg[]>([])
  const role    = useAuthStore((s) => s.role)
  const [allItems, setAllItems] = useState<Transaction[]>([])

  // ref để load() bên trong WS callback luôn dùng bản mới nhất
  const loadRef = useRef<() => void>(() => {})

  const addToast = (text: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const load = useCallback(async () => {
    console.log('[LOAD] called, status:', status, 'txType:', txType, 'page:', page)
  setLoading(true)
    setLoading(true)
    try {
      const res = await transactionApi.list({
        status: status || undefined,
        type:   txType  || undefined,
        page,
        limit:  10,
      })
      setItems(res.items ?? [])
      setTotal(res.total ?? 0)

      const allRes = await transactionApi.list({
        status: status || undefined,
        type:   txType || undefined,
        page: 1, limit: 200,
      })
      setAllItems(allRes.items ?? [])
    } catch {
      // handle silently
    } finally {
      setLoading(false)
    }
  }, [status, txType, page])

  // Giữ loadRef luôn trỏ đến load mới nhất
  useEffect(() => { loadRef.current = load }, [load])

  // Gọi load khi filter/page thay đổi
  useEffect(() => { load() }, [load])
  const addToastRef = useRef(addToast)
  useEffect(() => { addToastRef.current = addToast }, [addToast])

  // ── WebSocket real-time ──────────────────────────────────────
useSocket({
  onTransactionUpdate: (d) => {
    console.log('[TX] onTransactionUpdate fired', d) 
    loadRef.current()
    const statusText: Record<string, string> = {
      processing: 'Đang thực hiện',
      done:       'Hoàn tất',
      rejected:   'Từ chối',
    }
    addToastRef.current(`📋 Phiếu ${d.transaction_code}: ${statusText[d.status] ?? d.status}`)
  },
  onBinSuggestion: (d) => {
    loadRef.current()
    addToastRef.current(`📦 Bin đề xuất cho phiếu ${d.transaction_code}: ${d.suggested_bin_display}`)
  },
  onStockUpdate: () => {
    loadRef.current()
  },
})

  const handleApprove = async (id: string) => {
    try {
      await transactionApi.approve(id)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'Không thể duyệt phiếu')
    }
  }

  const handleReject = async (id: string) => {
    if (!window.confirm('Xác nhận từ chối phiếu này?')) return
    await transactionApi.reject(id)
    load()
  }

  const totalPages = Math.ceil(total / 10)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Kho phiếu</h1>
          <p style={s.subtitle}>Quản lý nhập xuất · {total} phiếu</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/dashboard')} style={s.btnBack}>← Dashboard</button>
            <ExportPanel
              items={allItems}
              filenamePrefix="phieu_kho"
              pdfTitle="Báo cáo phiếu kho tháng"
              allowedRoles={['admin', 'manager', 'warehouse']}
              currentRole={role}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <select value={txType} onChange={(e) => { setTxType(e.target.value); setPage(1) }} style={s.select}>
          <option value="">Tất cả loại</option>
          <option value="import">Nhập kho</option>
          <option value="export">Xuất kho</option>
          <option value="transfer">Chuyển vị trí</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={s.select}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="processing">Đang thực hiện</option>
          <option value="done">Hoàn tất</option>
          <option value="rejected">Từ chối</option>
        </select>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.loading}>Đang tải...</div>
        ) : items.length === 0 ? (
          <div style={s.empty}>Không có phiếu nào</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Mã phiếu</th>
                <th style={s.th}>Loại</th>
                <th style={s.th}>Trạng thái</th>
                <th style={s.th}>Sản phẩm</th>
                <th style={s.th}>Người tạo</th>
                <th style={s.th}>Người duyệt</th>
                <th style={s.th}>Ngày tạo</th>
                <th style={s.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx, idx) => {
                const st = STATUS_STYLE[tx.status] ?? STATUS_STYLE.draft
                return (
                  <tr key={tx.id} style={s.tr(idx % 2 === 1)}>
                    <td style={s.td}>
                      <span style={s.code}>{tx.code}</span>
                      <button
                        style={s.btnDetailSmall}
                        onClick={() => navigate(`/transactions/${tx.id}`)}
                      >
                        Chi tiết
                      </button>
                    </td>
                    <td style={s.td}>{TYPE_LABEL[tx.type] ?? tx.type}</td>
                    <td style={s.td}>
                      <span style={s.badge(st.bg, st.color)}>{st.label}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.itemCount}>{tx.items?.length ?? 0} sản phẩm</span>
                    </td>
                    <td style={s.td}>
                      {tx.created_by
                        ? <span>
                            <span style={{ fontWeight: 600 }}>{tx.created_by.full_name}</span>
                            <br />
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>@{tx.created_by.username}</span>
                          </span>
                        : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={s.td}>
                      {tx.approved_by
                        ? <span>
                            <span style={{ fontWeight: 600 }}>{tx.approved_by.full_name}</span>
                            <br />
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>@{tx.approved_by.username}</span>
                          </span>
                        : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={s.td}>
                      {new Date(tx.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {tx.status === 'pending' && (role === 'admin' || role === 'manager') && (
                          <>
                            <button style={s.btnApprove} onClick={() => handleApprove(tx.id)}>Duyệt</button>
                            <button style={s.btnReject}  onClick={() => handleReject(tx.id)}>Từ chối</button>
                          </>
                        )}
                        {tx.status === 'processing' && (role === 'admin' || role === 'manager') && (
                          <button style={s.btnComplete} onClick={() => setCompleteTx(tx)}>Hoàn tất</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={s.pageBtn(page === 1)} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            ← Trước
          </button>
          <span style={s.pageInfo}>Trang {page} / {totalPages}</span>
          <button style={s.pageBtn(page === totalPages)} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Sau →
          </button>
        </div>
      )}

      {/* Complete Modal */}
      {completeTx && (
        <CompleteModal
          tx={completeTx}
          onDone={() => { setCompleteTx(null); load() }}
          onClose={() => setCompleteTx(null)}
        />
      )}

      {/* Toast notifications */}
      <Toast toasts={toasts} />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  page:     { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:   { padding: '2rem 2rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#fff' } as React.CSSProperties,
  title:    { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle: { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  filters:  { padding: '1rem 2rem', display: 'flex', gap: '0.75rem', background: '#fff', borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  select:   { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', background: '#fff', color: '#374151' } as React.CSSProperties,
  tableWrap:{ margin: '1.5rem 2rem', background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' } as React.CSSProperties,
  table:    { width: '100%', borderCollapse: 'collapse' as const },
  thead:    { background: '#f9fafb' },
  th:       { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  tr:       (odd: boolean): React.CSSProperties => ({ background: odd ? '#fafafa' : '#fff' }),
  td:       { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  btnDetailSmall: {
    display: 'block', marginTop: '0.3rem',
    padding: '0.25rem 0.75rem', background: '#eff6ff',
    color: '#2563eb', border: '1px solid #bfdbfe',
    borderRadius: '0.375rem', fontSize: '0.75rem',
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'center' as const, width: 'fit-content', minWidth: '4.5rem',
  } as React.CSSProperties,
  code:       { fontFamily: 'monospace', fontWeight: 700, color: '#111827', fontSize: '0.85rem' } as React.CSSProperties,
  badge:      (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '999px',
    background: bg, color, fontSize: '0.75rem', fontWeight: 700,
  }),
  itemCount:  { color: '#6b7280', fontSize: '0.8rem' } as React.CSSProperties,
  btnBack:    { padding: '0.4rem 0.875rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', color: '#374151' } as React.CSSProperties,
  btnApprove: { padding: '0.3rem 0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnReject:  { padding: '0.3rem 0.75rem', background: '#fff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnComplete:{ padding: '0.3rem 0.75rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  loading:    { padding: '3rem', textAlign: 'center' as const, color: '#6b7280' },
  empty:      { padding: '3rem', textAlign: 'center' as const, color: '#9ca3af', fontSize: '0.9rem' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', color: '#6b7280', fontSize: '0.875rem' } as React.CSSProperties,
  pageBtn:    (disabled: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem',
    background: disabled ? '#f3f4f6' : '#fff', color: disabled ? '#9ca3af' : '#374151',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.875rem',
  }),
  pageInfo:   { fontWeight: 600, color: '#374151' } as React.CSSProperties,
}