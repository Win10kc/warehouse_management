import { useState } from 'react'
import {
  transactionApi,
  type TransactionType,
  type TransactionItemInput,
} from '../api/transactionApi'

// ─── Types nội bộ ─────────────────────────────────────────────

type ItemRow = TransactionItemInput & { _key: number }

const newRow = (): ItemRow => ({
  _key:               Date.now() + Math.random(),
  product_id:         '',
  to_bin_id:          '',
  from_bin_id:        '',
  quantity_requested: 1,
  scan_method:        'manual',
})

// ─── Constants ────────────────────────────────────────────────

const TYPE_OPTIONS: { value: TransactionType; label: string; icon: string; desc: string }[] = [
  { value: 'import',   label: 'Nhập kho',   icon: '📥', desc: 'Hàng về kho' },
  { value: 'export',   label: 'Xuất kho',   icon: '📤', desc: 'Hàng ra khỏi kho' },
  { value: 'transfer', label: 'Chuyển vị trí', icon: '🔄', desc: 'Di chuyển trong kho' },
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

  // ── Item helpers ────────────────────────────────────────────

  const addRow = () => setItems((p) => [...p, newRow()])

  const removeRow = (key: number) =>
    setItems((p) => p.filter((r) => r._key !== key))

  const updateRow = (key: number, field: keyof TransactionItemInput, value: string | number) =>
    setItems((p) => p.map((r) => (r._key === key ? { ...r, [field]: value } : r)))

  // ── Submit ──────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError('')

    // Validate nhanh phía client
    for (const row of items) {
      if (!row.product_id.trim()) { setError('Vui lòng nhập Product ID cho tất cả các dòng'); return }
      if (row.quantity_requested < 1) { setError('Số lượng phải ≥ 1'); return }
    }

    const payload = {
      type,
      note,
      items: items.map(({ _key: _, ...rest }) => {
        const item: TransactionItemInput = {
          product_id:         rest.product_id.trim(),
          quantity_requested: rest.quantity_requested,
          scan_method:        rest.scan_method || 'manual',
        }
        if (rest.from_bin_id?.trim()) item.from_bin_id = rest.from_bin_id.trim()
        if (rest.to_bin_id?.trim())   item.to_bin_id   = rest.to_bin_id.trim()
        return item
      }),
    }

    setLoading(true)
    try {
      const tx = await transactionApi.create(payload)
      setCreated({ code: tx.code, id: tx.id, status: tx.status })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })
        ?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCreated(null)
    setItems([newRow()])
    setNote('')
    setError('')
  }

  // ── Render: Success state ────────────────────────────────────

  if (created) {
    return (
      <div style={styles.successWrap}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Tạo phiếu thành công</h2>
          <div style={styles.codeBox}>
            <span style={styles.codeLabel}>Mã phiếu</span>
            <span style={styles.codeValue}>{created.code}</span>
          </div>
          <div style={styles.statusPill(created.status)}>
            {STATUS_LABEL[created.status] ?? created.status}
          </div>
          <p style={styles.successHint}>
            Phiếu đã được gửi — chờ quản lý duyệt để tiếp tục.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button style={styles.btnSecondary} onClick={handleReset}>
              Tạo phiếu mới
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Form ─────────────────────────────────────────────

  const needFrom = type === 'export' || type === 'transfer'
  const needTo   = type === 'import' || type === 'transfer'

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Tạo phiếu kho</h1>
        <p style={styles.subtitle}>Nhập đầy đủ thông tin để gửi phiếu chờ duyệt</p>
      </div>

      <div style={styles.body}>
        {/* Loại phiếu */}
        <section style={styles.section}>
          <label style={styles.sectionLabel}>Loại phiếu</label>
          <div style={styles.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                style={styles.typeBtn(type === opt.value)}
              >
                <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{opt.label}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Ghi chú */}
        <section style={styles.section}>
          <label style={styles.sectionLabel} htmlFor="note">Ghi chú</label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú (tuỳ chọn)..."
            style={styles.input}
          />
        </section>

        {/* Danh sách sản phẩm */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <label style={styles.sectionLabel}>Sản phẩm</label>
            <button style={styles.btnAddRow} onClick={addRow}>+ Thêm dòng</button>
          </div>

          <div style={styles.tableWrap}>
            {/* Header */}
            <div style={styles.tableHead}>
              <span style={{ ...styles.col, flex: '0 0 2rem' }}>#</span>
              <span style={{ ...styles.col, flex: 3 }}>Product ID *</span>
              <span style={{ ...styles.col, flex: 1 }}>Số lượng *</span>
              {needFrom && <span style={{ ...styles.col, flex: 2 }}>Bin nguồn</span>}
              {needTo   && <span style={{ ...styles.col, flex: 2 }}>Bin đích</span>}
              <span style={{ ...styles.col, flex: '0 0 2rem' }} />
            </div>

            {/* Rows */}
            {items.map((row, idx) => (
              <div key={row._key} style={styles.tableRow(idx % 2 === 1)}>
                <span style={{ ...styles.col, flex: '0 0 2rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                  {idx + 1}
                </span>
                <div style={{ ...styles.col, flex: 3 }}>
                  <input
                    value={row.product_id}
                    onChange={(e) => updateRow(row._key, 'product_id', e.target.value)}
                    placeholder="UUID sản phẩm"
                    style={styles.cellInput}
                  />
                </div>
                <div style={{ ...styles.col, flex: 1 }}>
                  <input
                    type="number"
                    min={1}
                    value={row.quantity_requested}
                    onChange={(e) => updateRow(row._key, 'quantity_requested', Number(e.target.value))}
                    style={styles.cellInput}
                  />
                </div>
                {needFrom && (
                  <div style={{ ...styles.col, flex: 2 }}>
                    <input
                      value={row.from_bin_id ?? ''}
                      onChange={(e) => updateRow(row._key, 'from_bin_id', e.target.value)}
                      placeholder="UUID bin"
                      style={styles.cellInput}
                    />
                  </div>
                )}
                {needTo && (
                  <div style={{ ...styles.col, flex: 2 }}>
                    <input
                      value={row.to_bin_id ?? ''}
                      onChange={(e) => updateRow(row._key, 'to_bin_id', e.target.value)}
                      placeholder="UUID bin"
                      style={styles.cellInput}
                    />
                  </div>
                )}
                <div style={{ ...styles.col, flex: '0 0 2rem' }}>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeRow(row._key)}
                      style={styles.btnRemove}
                      aria-label="Xoá dòng"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={styles.btnSubmit(loading)}
        >
          {loading ? 'Đang tạo phiếu...' : 'Tạo phiếu'}
        </button>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const styles = {
  page: {
    minHeight:  '100vh',
    background: '#f8fafc',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  } as React.CSSProperties,

  header: {
    padding:    '2rem 2rem 1rem',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
  } as React.CSSProperties,

  title: {
    margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827',
  } as React.CSSProperties,

  subtitle: {
    margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280',
  } as React.CSSProperties,

  body: {
    maxWidth: '56rem', margin: '0 auto', padding: '1.5rem 2rem 4rem',
    display: 'flex', flexDirection: 'column' as const, gap: '1.75rem',
  },

  section: {} as React.CSSProperties,

  sectionLabel: {
    display: 'block', fontWeight: 600, fontSize: '0.875rem',
    color: '#374151', marginBottom: '0.625rem',
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem',
  } as React.CSSProperties,

  typeRow: {
    display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const,
  },

  typeBtn: (active: boolean): React.CSSProperties => ({
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           '0.2rem',
    padding:       '0.875rem 1.5rem',
    borderRadius:  '0.75rem',
    border:        active ? '2px solid #2563eb' : '2px solid #e5e7eb',
    background:    active ? '#eff6ff' : '#fff',
    color:         active ? '#1d4ed8' : '#374151',
    cursor:        'pointer',
    transition:    'all 0.15s',
    minWidth:      '8rem',
    fontFamily:    'inherit',
  }),

  input: {
    width:         '100%',
    boxSizing:     'border-box' as const,
    padding:       '0.625rem 0.875rem',
    border:        '1.5px solid #d1d5db',
    borderRadius:  '0.5rem',
    fontSize:      '0.875rem',
    outline:       'none',
    fontFamily:    'inherit',
    background:    '#fff',
    color:         '#111827',
  } as React.CSSProperties,

  tableWrap: {
    border:        '1.5px solid #e5e7eb',
    borderRadius:  '0.75rem',
    overflow:      'hidden',
    background:    '#fff',
  } as React.CSSProperties,

  tableHead: {
    display:    'flex',
    alignItems: 'center',
    gap:        '0.5rem',
    padding:    '0.5rem 1rem',
    background: '#f3f4f6',
    fontSize:   '0.75rem',
    fontWeight: 600,
    color:      '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  tableRow: (odd: boolean): React.CSSProperties => ({
    display:    'flex',
    alignItems: 'center',
    gap:        '0.5rem',
    padding:    '0.5rem 1rem',
    background: odd ? '#fafafa' : '#fff',
    borderTop:  '1px solid #f0f0f0',
  }),

  col: {
    display: 'flex', alignItems: 'center',
  } as React.CSSProperties,

  cellInput: {
    width:        '100%',
    padding:      '0.375rem 0.5rem',
    border:       '1.5px solid #e5e7eb',
    borderRadius: '0.375rem',
    fontSize:     '0.8rem',
    outline:      'none',
    fontFamily:   'inherit',
    background:   '#fff',
    color:        '#111827',
  } as React.CSSProperties,

  btnAddRow: {
    background: 'none', border: 'none',
    color: '#2563eb', fontWeight: 600, fontSize: '0.875rem',
    cursor: 'pointer', fontFamily: 'inherit', padding: '0.25rem 0',
  } as React.CSSProperties,

  btnRemove: {
    background: 'none', border: 'none',
    color: '#f87171', cursor: 'pointer',
    fontSize: '0.875rem', padding: '0.25rem',
    lineHeight: 1,
  } as React.CSSProperties,

  errorBox: {
    display:      'flex',
    alignItems:   'center',
    gap:          '0.5rem',
    padding:      '0.75rem 1rem',
    background:   '#fef2f2',
    border:       '1.5px solid #fecaca',
    borderRadius: '0.5rem',
    color:        '#dc2626',
    fontSize:     '0.875rem',
  } as React.CSSProperties,

  btnSubmit: (disabled: boolean): React.CSSProperties => ({
    padding:       '0.875rem',
    background:    disabled ? '#93c5fd' : '#2563eb',
    color:         '#fff',
    border:        'none',
    borderRadius:  '0.75rem',
    fontSize:      '1rem',
    fontWeight:    700,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    fontFamily:    'inherit',
    transition:    'background 0.15s',
  }),

  btnSecondary: {
    padding:      '0.625rem 1.25rem',
    background:   '#fff',
    color:        '#374151',
    border:       '1.5px solid #d1d5db',
    borderRadius: '0.625rem',
    fontSize:     '0.875rem',
    fontWeight:   600,
    cursor:       'pointer',
    fontFamily:   'inherit',
  } as React.CSSProperties,

  // Success styles
  successWrap: {
    minHeight:     '100vh',
    background:    '#f8fafc',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    fontFamily:    "'DM Sans', 'Segoe UI', sans-serif",
  } as React.CSSProperties,

  successCard: {
    background:   '#fff',
    borderRadius: '1.25rem',
    padding:      '2.5rem',
    textAlign:    'center' as const,
    boxShadow:    '0 4px 32px rgba(0,0,0,0.08)',
    maxWidth:     '22rem',
    width:        '100%',
  },

  successIcon: {
    width:        '4rem',
    height:       '4rem',
    background:   '#dcfce7',
    borderRadius: '50%',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    fontSize:     '1.75rem',
    margin:       '0 auto 1.25rem',
    color:        '#16a34a',
  } as React.CSSProperties,

  successTitle: {
    margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 800, color: '#111827',
  } as React.CSSProperties,

  codeBox: {
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    gap:          '0.5rem',
    padding:      '0.75rem 1rem',
    background:   '#f3f4f6',
    borderRadius: '0.625rem',
    marginBottom: '0.75rem',
  } as React.CSSProperties,

  codeLabel: {
    fontSize: '0.8rem', color: '#6b7280', fontWeight: 600,
  } as React.CSSProperties,

  codeValue: {
    fontSize: '0.9rem', color: '#111827', fontWeight: 800, letterSpacing: '0.04em',
  } as React.CSSProperties,

  statusPill: (status: string): React.CSSProperties => ({
    display:      'inline-block',
    padding:      '0.25rem 0.875rem',
    borderRadius: '999px',
    fontSize:     '0.8rem',
    fontWeight:   700,
    color:        '#fff',
    background:   STATUS_COLOR[status] ?? '#6b7280',
    marginBottom: '0.75rem',
  }),

  successHint: {
    fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0 0',
  } as React.CSSProperties,
}