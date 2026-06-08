
import { useState, useEffect, useRef } from 'react'
import {
  transactionApi,
  type TransactionType,
  type TransactionItemInput,
} from '../api/transactionApi'
import api from '../api/axios'

// ─── Types ────────────────────────────────────────────────────

interface ProductSearchResult {
  id:       string
  sku:      string
  name:     string
  unit:     string
  category?: string
}

type ItemRow = {
  _key:               number
  product_id:         string
  product_name:       string   // hiển thị tên, không phải UUID
  product_sku:        string
  product_unit:       string
  to_bin_id:          string
  from_bin_id:        string
  quantity_requested: number
  scan_method:        string
}

// ─── ProductSearch inline component ───────────────────────────

function ProductSearchInput({
  value,
  displayName,
  onSelect,
}: {
  value:       string
  displayName: string
  onSelect:    (p: ProductSearchResult) => void
}) {
  const [query,   setQuery]   = useState(displayName)
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Sync khi displayName thay đổi từ ngoài
  useEffect(() => { setQuery(displayName) }, [displayName])

  // Click ngoài → đóng dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get('/products', { params: { search: q, limit: 8 } })
        const items: ProductSearchResult[] = res.data?.data?.items ?? []
        setResults(items)
        setOpen(items.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 280)
  }

  const select = (p: ProductSearchResult) => {
    setQuery(`${p.sku} — ${p.name}`)
    setOpen(false)
    onSelect(p)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={value ? '✓ Đã chọn' : 'Tìm SKU hoặc tên sản phẩm...'}
        style={{
          ...cellInput,
          borderColor: value ? '#86efac' : '#e5e7eb',
          background:  value ? '#f0fdf4' : '#fff',
        }}
      />
      {loading && (
        <span style={{ position: 'absolute', right: '0.5rem', top: '0.4rem', fontSize: '0.7rem', color: '#9ca3af' }}>
          ⌛
        </span>
      )}
      {open && (
        <div style={dropdownStyle}>
          {results.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => select(p)}
              style={dropdownItem}
            >
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e3a5f', fontSize: '0.78rem' }}>
                {p.sku}
              </span>
              <span style={{ color: '#374151', fontSize: '0.82rem' }}> — {p.name}</span>
              {p.unit && (
                <span style={{ color: '#9ca3af', fontSize: '0.72rem', marginLeft: '0.25rem' }}>
                  ({p.unit})
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const dropdownStyle: React.CSSProperties = {
  position:     'absolute',
  top:          '100%',
  left:         0,
  right:        0,
  zIndex:       200,
  background:   '#fff',
  border:       '1.5px solid #e5e7eb',
  borderRadius: '0.5rem',
  boxShadow:    '0 8px 24px rgba(0,0,0,0.12)',
  marginTop:    '0.25rem',
  maxHeight:    '14rem',
  overflowY:    'auto',
  display:      'flex',
  flexDirection:'column',
}

const dropdownItem: React.CSSProperties = {
  padding:    '0.5rem 0.75rem',
  textAlign:  'left',
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  borderBottom: '1px solid #f3f4f6',
  fontFamily: 'inherit',
  display:    'flex',
  alignItems: 'baseline',
  gap:        '0.125rem',
}

const cellInput: React.CSSProperties = {
  width:        '100%',
  padding:      '0.375rem 0.5rem',
  border:       '1.5px solid #e5e7eb',
  borderRadius: '0.375rem',
  fontSize:     '0.8rem',
  outline:      'none',
  fontFamily:   'inherit',
  background:   '#fff',
  color:        '#111827',
  boxSizing:    'border-box',
}

// ─── Constants ────────────────────────────────────────────────

const newRow = (): ItemRow => ({
  _key:               Date.now() + Math.random(),
  product_id:         '',
  product_name:       '',
  product_sku:        '',
  product_unit:       '',
  to_bin_id:          '',
  from_bin_id:        '',
  quantity_requested: 1,
  scan_method:        'manual',
})

type TxTypeOption = { value: TransactionType; label: string; icon: string; desc: string }
const TYPE_OPTIONS: TxTypeOption[] = [
  { value: 'import',   label: 'Nhập kho',       icon: '📥', desc: 'Hàng về kho' },
  { value: 'export',   label: 'Xuất kho',        icon: '📤', desc: 'Hệ thống tự gợi ý bin' },
  { value: 'transfer', label: 'Chuyển vị trí',   icon: '🔄', desc: 'Di chuyển trong kho' },
]

const STATUS_COLOR: Record<string, string> = {
  pending:    '#d97706',
  processing: '#2563eb',
  done:       '#16a34a',
  rejected:   '#dc2626',
}
const STATUS_LABEL: Record<string, string> = {
  pending:    'Chờ duyệt',
  processing: 'Đang thực hiện',
  done:       'Hoàn tất',
  rejected:   'Đã từ chối',
}

// ─── Component ────────────────────────────────────────────────

export default function TransactionCreatePage() {
  const [type,    setType]    = useState<TransactionType>('import')
  const [note,    setNote]    = useState('')
  const [items,   setItems]   = useState<ItemRow[]>([newRow()])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [created, setCreated] = useState<{ code: string; id: string; status: string } | null>(null)

  const addRow    = () => setItems((p) => [...p, newRow()])
  const removeRow = (key: number) => setItems((p) => p.filter((r) => r._key !== key))

  const updateRow = (key: number, patch: Partial<ItemRow>) =>
    setItems((p) => p.map((r) => (r._key === key ? { ...r, ...patch } : r)))

  const handleSelectProduct = (key: number, p: ProductSearchResult) => {
    updateRow(key, {
      product_id:   p.id,
      product_name: p.name,
      product_sku:  p.sku,
      product_unit: p.unit,
    })
  }

  const handleSubmit = async () => {
    setError('')

    for (const row of items) {
      if (!row.product_id) { setError('Vui lòng chọn sản phẩm cho tất cả các dòng'); return }
      if (row.quantity_requested < 1) { setError('Số lượng phải ≥ 1'); return }
      if (type === 'transfer' && !row.from_bin_id.trim()) {
        setError('Nhập từ bin nào cho phiếu chuyển kho'); return
      }
      if ((type === 'import' || type === 'transfer') && !row.to_bin_id.trim()) {
        setError('Chọn bin đích cho phiếu nhập / chuyển'); return
      }
    }

    const payload = {
      type,
      note,
      items: items.map(({ _key: _, product_name: __, product_sku: ___, product_unit: ____, ...rest }): TransactionItemInput => {
        const item: TransactionItemInput = {
          product_id:         rest.product_id,
          quantity_requested: rest.quantity_requested,
          scan_method:        rest.scan_method || 'manual',
        }
        // Export: KHÔNG gửi from_bin_id — backend tự suggest
        if (type !== 'export' && rest.from_bin_id?.trim()) item.from_bin_id = rest.from_bin_id.trim()
        if (rest.to_bin_id?.trim())                         item.to_bin_id   = rest.to_bin_id.trim()
        return item
      }),
    }

    setLoading(true)
    try {
      const tx = await transactionApi.create(payload)
      setCreated({ code: tx.code, id: tx.id, status: tx.status })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCreated(null); setItems([newRow()]); setNote(''); setError('')
  }

  // ── Success state ─────────────────────────────────────────

  if (created) {
    return (
      <div style={s.successWrap}>
        <div style={s.successCard}>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.successTitle}>Tạo phiếu thành công</h2>
          <div style={s.codeBox}>
            <span style={s.codeLabel}>Mã phiếu</span>
            <span style={s.codeValue}>{created.code}</span>
          </div>
          <div style={s.statusPill(created.status)}>
            {STATUS_LABEL[created.status] ?? created.status}
          </div>
          {created.status === 'pending' && (
            <p style={s.successHint}>
              Phiếu đã được gửi — chờ quản lý duyệt.
              {created.code.startsWith('EXP') &&
                ' Bin xuất hàng đã được hệ thống gợi ý tự động.'}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button style={s.btnSecondary} onClick={handleReset}>Tạo phiếu mới</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────

  const needFrom = type === 'transfer'  // export không cần from_bin (auto-suggest)
  const needTo   = type === 'import' || type === 'transfer'

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Tạo phiếu kho</h1>
        <p style={s.subtitle}>Nhập đầy đủ thông tin để gửi phiếu chờ duyệt</p>
      </div>

      <div style={s.body}>
        {/* Loại phiếu */}
        <section>
          <label style={s.sectionLabel}>Loại phiếu</label>
          <div style={s.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setType(opt.value)} style={s.typeBtn(type === opt.value)}>
                <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{opt.label}</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.7, textAlign: 'center' }}>{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* Hint cho export */}
          {type === 'export' && (
            <div style={s.hintBox}>
              <span style={{ fontSize: '1rem' }}>💡</span>
              <span>
                Lệnh xuất kho: hệ thống sẽ <strong>tự động gợi ý bin</strong> tối ưu cho từng sản phẩm.
                Nhân viên xem bin đề xuất trên app Android và scan xác nhận.
              </span>
            </div>
          )}
        </section>

        {/* Ghi chú */}
        <section>
          <label style={s.sectionLabel} htmlFor="note">Ghi chú</label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú (tuỳ chọn)..."
            style={s.input}
          />
        </section>

        {/* Danh sách sản phẩm */}
        <section>
          <div style={s.sectionHeader}>
            <label style={s.sectionLabel}>Sản phẩm</label>
            <button style={s.btnAddRow} onClick={addRow}>+ Thêm dòng</button>
          </div>

          <div style={s.tableWrap}>
            {/* Header */}
            <div style={s.tableHead}>
              <span style={{ ...s.col, flex: '0 0 1.5rem' }}>#</span>
              <span style={{ ...s.col, flex: 3 }}>Sản phẩm *</span>
              <span style={{ ...s.col, flex: '0 0 5rem' }}>SL *</span>
              {needFrom && <span style={{ ...s.col, flex: 2 }}>Bin nguồn</span>}
              {needTo   && <span style={{ ...s.col, flex: 2 }}>Bin đích</span>}
              {type === 'export' && (
                <span style={{ ...s.col, flex: 2, color: '#3b82f6', fontSize: '0.68rem' }}>
                  Bin (tự động gợi ý)
                </span>
              )}
              <span style={{ ...s.col, flex: '0 0 1.5rem' }} />
            </div>

            {/* Rows */}
            {items.map((row, idx) => (
              <div key={row._key} style={s.tableRow(idx % 2 === 1)}>
                <span style={{ ...s.col, flex: '0 0 1.5rem', color: '#9ca3af', fontSize: '0.75rem' }}>
                  {idx + 1}
                </span>

                {/* Product search */}
                <div style={{ ...s.col, flex: 3 }}>
                  <ProductSearchInput
                    value={row.product_id}
                    displayName={row.product_id ? `${row.product_sku} — ${row.product_name}` : ''}
                    onSelect={(p) => handleSelectProduct(row._key, p)}
                  />
                </div>

                {/* Qty */}
                <div style={{ ...s.col, flex: '0 0 5rem' }}>
                  <input
                    type="number" min={1}
                    value={row.quantity_requested}
                    onChange={(e) => updateRow(row._key, { quantity_requested: Number(e.target.value) })}
                    style={cellInput}
                  />
                  {row.product_unit && (
                    <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginLeft: '0.25rem', whiteSpace: 'nowrap' }}>
                      {row.product_unit}
                    </span>
                  )}
                </div>

                {/* From bin (chỉ transfer) */}
                {needFrom && (
                  <div style={{ ...s.col, flex: 2 }}>
                    <input
                      value={row.from_bin_id}
                      onChange={(e) => updateRow(row._key, { from_bin_id: e.target.value })}
                      placeholder="UUID bin nguồn"
                      style={cellInput}
                    />
                  </div>
                )}

                {/* To bin (import/transfer) */}
                {needTo && (
                  <div style={{ ...s.col, flex: 2 }}>
                    <input
                      value={row.to_bin_id}
                      onChange={(e) => updateRow(row._key, { to_bin_id: e.target.value })}
                      placeholder="UUID bin đích"
                      style={cellInput}
                    />
                  </div>
                )}

                {/* Export: show placeholder */}
                {type === 'export' && (
                  <div style={{ ...s.col, flex: 2 }}>
                    <span style={{
                      fontSize: '0.72rem', color: '#3b82f6',
                      fontStyle: 'italic', padding: '0.25rem 0.5rem',
                      background: '#eff6ff', borderRadius: '0.375rem',
                      border: '1px dashed #93c5fd',
                    }}>
                      Hệ thống tự gợi ý
                    </span>
                  </div>
                )}

                {/* Remove */}
                <div style={{ ...s.col, flex: '0 0 1.5rem' }}>
                  {items.length > 1 && (
                    <button onClick={() => removeRow(row._key)} style={s.btnRemove} aria-label="Xoá dòng">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div style={s.errorBox}>
            <span>⚠️</span> {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={s.btnSubmit(loading)}>
          {loading ? 'Đang tạo phiếu...' : `Tạo phiếu ${type === 'export' ? 'xuất' : type === 'import' ? 'nhập' : 'chuyển'}`}
        </button>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const s = {
  page:     { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" } as React.CSSProperties,
  header:   { padding: '2rem 2rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#fff' } as React.CSSProperties,
  title:    { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle: { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  body:     { maxWidth: '56rem', margin: '0 auto', padding: '1.5rem 2rem 4rem', display: 'flex', flexDirection: 'column' as const, gap: '1.75rem' },
  sectionLabel: { display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.625rem' } as React.CSSProperties,
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' } as React.CSSProperties,

  hintBox: {
    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    marginTop: '0.75rem', padding: '0.625rem 0.875rem',
    background: '#eff6ff', border: '1.5px solid #bfdbfe',
    borderRadius: '0.625rem', fontSize: '0.82rem', color: '#1e40af',
    lineHeight: '1.5',
  } as React.CSSProperties,

  typeRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const },
  typeBtn: (active: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
    padding: '0.875rem 1.5rem', borderRadius: '0.75rem',
    border: active ? '2px solid #2563eb' : '2px solid #e5e7eb',
    background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#374151',
    cursor: 'pointer', transition: 'all 0.15s', minWidth: '9rem', fontFamily: 'inherit',
  }),

  input: {
    width: '100%', boxSizing: 'border-box' as const, padding: '0.625rem 0.875rem',
    border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem',
    outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#111827',
  } as React.CSSProperties,

  tableWrap: { border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', background: '#fff' } as React.CSSProperties,
  tableHead: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 1rem', background: '#f3f4f6',
    fontSize: '0.72rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  } as React.CSSProperties,
  tableRow: (odd: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 1rem', background: odd ? '#fafafa' : '#fff',
    borderTop: '1px solid #f0f0f0',
  }),
  col: { display: 'flex', alignItems: 'center' } as React.CSSProperties,

  btnAddRow: { background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', padding: '0.25rem 0' } as React.CSSProperties,
  btnRemove: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.875rem', padding: '0.25rem', lineHeight: 1 } as React.CSSProperties,

  errorBox: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.75rem 1rem', background: '#fef2f2',
    border: '1.5px solid #fecaca', borderRadius: '0.5rem',
    color: '#dc2626', fontSize: '0.875rem',
  } as React.CSSProperties,

  btnSubmit: (disabled: boolean): React.CSSProperties => ({
    padding: '0.875rem', background: disabled ? '#93c5fd' : '#2563eb',
    color: '#fff', border: 'none', borderRadius: '0.75rem', fontSize: '1rem',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }),

  btnSecondary: {
    padding: '0.625rem 1.25rem', background: '#fff', color: '#374151',
    border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontSize: '0.875rem',
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,

  // Success
  successWrap: { minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" } as React.CSSProperties,
  successCard: { background: '#fff', borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center' as const, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', maxWidth: '22rem', width: '100%' },
  successIcon: { width: '4rem', height: '4rem', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 1.25rem', color: '#16a34a' } as React.CSSProperties,
  successTitle: { margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  codeBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f3f4f6', borderRadius: '0.625rem', marginBottom: '0.75rem' } as React.CSSProperties,
  codeLabel: { fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 } as React.CSSProperties,
  codeValue:  { fontSize: '0.9rem', color: '#111827', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'monospace' } as React.CSSProperties,
  statusPill: (status: string): React.CSSProperties => ({ display: 'inline-block', padding: '0.25rem 0.875rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: STATUS_COLOR[status] ?? '#6b7280', marginBottom: '0.75rem' }),
  successHint: { fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0 0' } as React.CSSProperties,
}