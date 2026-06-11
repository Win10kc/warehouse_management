import { useState, useEffect, useRef, useCallback } from 'react'
import {
  transactionApi,
  type TransactionType,
  type TransactionItemInput,
} from '../api/transactionApi'
import api from '../api/axios'

interface ProductSearchResult {
  id: string; sku: string; name: string; unit: string
}

interface WHNode { id: string; name: string; code?: string }

type ItemRow = {
  _key: number
  product_id: string; product_name: string; product_sku: string; product_unit: string
  wh_id: string; wh_name: string
  zone_id: string; zone_name: string
  rack_id: string; rack_name: string
  bin_id: string; bin_code: string
  from_bin_id: string
  quantity_requested: number
  scan_method: string
}

// ─── ProductSearchInput ───────────────────────────────────────

function ProductSearchInput({ value, displayName, onSelect }: {
  value: string; displayName: string
  onSelect: (p: ProductSearchResult) => void
}) {
  const [query,   setQuery]   = useState(displayName)
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setQuery(displayName) }, [displayName])

  const search = (q: string) => {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get('/products', { params: { search: q, limit: 8 } })
        const items: ProductSearchResult[] = res.data?.data?.items ?? []
        setResults(items); setOpen(items.length > 0)
      } catch { setResults([]) } finally { setLoading(false) }
    }, 280)
  }

  const select = (p: ProductSearchResult) => {
    setQuery(`${p.sku} — ${p.name}`)
    setOpen(false)
    setResults([])
    onSelect(p)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => {
          // Delay close so mousedown on dropdown item fires first
          setTimeout(() => setOpen(false), 150)
        }}
        placeholder={value ? '✓ Đã chọn' : 'Tìm SKU hoặc tên…'}
        style={{
          ...inp,
          borderColor: value ? '#86efac' : '#e5e7eb',
          background:  value ? '#f0fdf4' : '#fff',
        }}
      />
      {loading && <span style={loadingDot}>⌛</span>}
      {open && results.length > 0 && (
        // onMouseDown preventDefault prevents input blur before click fires
        <div
          onMouseDown={e => e.preventDefault()}
          style={ddBox}
        >
          {results.map(p => (
            <button key={p.id} onMouseDown={() => select(p)} style={ddItem}>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e3a5f', fontSize: '0.78rem' }}>{p.sku}</span>
              <span style={{ color: '#374151', fontSize: '0.82rem' }}> — {p.name}</span>
              {p.unit && <span style={{ color: '#9ca3af', fontSize: '0.72rem', marginLeft: '0.25rem' }}>({p.unit})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BinPicker ────────────────────────────────────────────────

interface BinPickerProps {
  whId: string; whName: string
  zoneId: string; zoneName: string
  rackId: string; rackName: string
  binId: string; binCode: string
  onChange: (patch: Partial<ItemRow>) => void
}

function BinPicker({ whId, whName, zoneId, zoneName, rackId, rackName, binId, binCode, onChange }: BinPickerProps) {
  const [warehouses, setWarehouses] = useState<WHNode[]>([])
  const [zones,  setZones]  = useState<WHNode[]>([])
  const [racks,  setRacks]  = useState<WHNode[]>([])
  const [bins,   setBins]   = useState<WHNode[]>([])
  const [loading, setLoading] = useState('')

  useEffect(() => {
    api.get('/warehouses').then(r => setWarehouses(r.data?.data ?? [])).catch(() => {})
  }, [])

  const selectWH = useCallback(async (id: string, name: string) => {
    onChange({ wh_id: id, wh_name: name, zone_id: '', zone_name: '', rack_id: '', rack_name: '', bin_id: '', bin_code: '' })
    setZones([]); setRacks([]); setBins([])
    if (!id) return
    setLoading('zone')
    try { const r = await api.get(`/warehouses/${id}/zones`); setZones(r.data?.data ?? []) }
    finally { setLoading('') }
  }, [onChange])

  const selectZone = useCallback(async (id: string, name: string) => {
    onChange({ zone_id: id, zone_name: name, rack_id: '', rack_name: '', bin_id: '', bin_code: '' })
    setRacks([]); setBins([])
    if (!id) return
    setLoading('rack')
    try { const r = await api.get(`/warehouses/${whId}/zones/${id}/racks`); setRacks(r.data?.data ?? []) }
    finally { setLoading('') }
  }, [onChange, whId])

  const selectRack = useCallback(async (id: string, name: string) => {
    onChange({ rack_id: id, rack_name: name, bin_id: '', bin_code: '' })
    setBins([])
    if (!id) return
    setLoading('bin')
    try { const r = await api.get(`/warehouses/${whId}/zones/${zoneId}/racks/${id}/bins`); setBins(r.data?.data ?? []) }
    finally { setLoading('') }
  }, [onChange, whId, zoneId])

  const sel = (hasVal: boolean, disabled?: boolean): React.CSSProperties => ({
    ...inp, color: hasVal ? '#111827' : '#9ca3af', fontSize: '0.78rem',
    background: hasVal ? '#f0fdf4' : (disabled ? '#f9fafb' : '#fff'),
    borderColor: hasVal ? '#86efac' : '#e5e7eb',
    cursor: disabled ? 'not-allowed' : 'pointer',
    appearance: 'none' as const, paddingRight: '1.5rem',
    opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', width: '100%' }}>
      {/* Warehouse */}
      <div style={{ position: 'relative', flex: '1 1 6rem', minWidth: '6rem' }}>
        <select value={whId} onChange={e => {
          const o = warehouses.find(w => w.id === e.target.value)
          selectWH(e.target.value, o?.name ?? '')
        }} style={sel(!!whId)}>
          <option value="">Kho…</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <span style={chevron}>▾</span>
      </div>

      {/* Zone */}
      <div style={{ position: 'relative', flex: '1 1 6rem', minWidth: '6rem' }}>
        <select value={zoneId} disabled={!whId} onChange={e => {
          const o = zones.find(z => z.id === e.target.value)
          selectZone(e.target.value, o?.name ?? '')
        }} style={sel(!!zoneId, !whId)}>
          <option value="">{loading === 'zone' ? 'Đang tải…' : 'Khu vực…'}</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <span style={chevron}>▾</span>
      </div>

      {/* Rack */}
      <div style={{ position: 'relative', flex: '1 1 5rem', minWidth: '5rem' }}>
        <select value={rackId} disabled={!zoneId} onChange={e => {
          const o = racks.find(r => r.id === e.target.value)
          selectRack(e.target.value, o?.code ?? o?.name ?? '')
        }} style={sel(!!rackId, !zoneId)}>
          <option value="">{loading === 'rack' ? 'Đang tải…' : 'Rack…'}</option>
          {racks.map(r => <option key={r.id} value={r.id}>{r.code ?? r.name}</option>)}
        </select>
        <span style={chevron}>▾</span>
      </div>

      {/* Bin */}
      <div style={{ position: 'relative', flex: '1 1 5rem', minWidth: '5rem' }}>
        <select value={binId} disabled={!rackId} onChange={e => {
          const o = bins.find(b => b.id === e.target.value)
          onChange({ bin_id: e.target.value, bin_code: o?.code ?? o?.name ?? '' })
        }} style={sel(!!binId, !rackId)}>
          <option value="">{loading === 'bin' ? 'Đang tải…' : 'Bin…'}</option>
          {bins.length === 0 && rackId && loading !== 'bin'
            ? <option disabled value="">Không có bin</option>
            : bins.map(b => <option key={b.id} value={b.id}>{b.code ?? b.name}</option>)
          }
        </select>
        <span style={chevron}>▾</span>
      </div>

      {binId && (
        <div style={{ width: '100%', fontSize: '0.7rem', color: '#16a34a', fontWeight: 600, marginTop: '0.15rem' }}>
          ✓ {whName} › {zoneName} › {rackName} › {binCode}
        </div>
      )}
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────

const newRow = (): ItemRow => ({
  _key: Date.now() + Math.random(),
  product_id: '', product_name: '', product_sku: '', product_unit: '',
  wh_id: '', wh_name: '', zone_id: '', zone_name: '',
  rack_id: '', rack_name: '', bin_id: '', bin_code: '',
  from_bin_id: '', quantity_requested: 1, scan_method: 'manual',
})

const TYPE_OPTIONS = [
  { value: 'import'   as TransactionType, label: 'Nhập kho',     icon: '📥', desc: 'Hàng về kho' },
  { value: 'export'   as TransactionType, label: 'Xuất kho',      icon: '📤', desc: 'Hệ thống tự gợi ý bin' },
  { value: 'transfer' as TransactionType, label: 'Chuyển vị trí', icon: '🔄', desc: 'Di chuyển trong kho' },
]

const STATUS_COLOR: Record<string, string> = {
  pending: '#d97706', processing: '#2563eb', done: '#16a34a', rejected: '#dc2626',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', processing: 'Đang thực hiện', done: 'Hoàn tất', rejected: 'Đã từ chối',
}

// ─── Main ─────────────────────────────────────────────────────

export default function TransactionCreatePage() {
  const [type,    setType]    = useState<TransactionType>('import')
  const [note,    setNote]    = useState('')
  const [items,   setItems]   = useState<ItemRow[]>([newRow()])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [created, setCreated] = useState<{ code: string; id: string; status: string } | null>(null)

  const addRow    = () => setItems(p => [...p, newRow()])
  const removeRow = (key: number) => setItems(p => p.filter(r => r._key !== key))
  const updateRow = (key: number, patch: Partial<ItemRow>) =>
    setItems(p => p.map(r => r._key === key ? { ...r, ...patch } : r))

  const handleSubmit = async () => {
    setError('')
    for (const row of items) {
      if (!row.product_id) { setError('Vui lòng chọn sản phẩm cho tất cả các dòng'); return }
      if (row.quantity_requested < 1) { setError('Số lượng phải ≥ 1'); return }
      if (type === 'transfer' && !row.from_bin_id.trim()) { setError('Nhập bin nguồn cho phiếu chuyển kho'); return }
      if ((type === 'import' || type === 'transfer') && !row.bin_id) { setError('Vui lòng chọn bin đích cho tất cả các dòng'); return }
    }

    const payload = {
      type, note,
      items: items.map(({ product_id, quantity_requested, scan_method, bin_id, from_bin_id }): TransactionItemInput => {
        const item: TransactionItemInput = { product_id, quantity_requested, scan_method: scan_method || 'manual' }
        if (type !== 'export' && from_bin_id?.trim()) item.from_bin_id = from_bin_id.trim()
        if (bin_id) item.to_bin_id = bin_id
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
    } finally { setLoading(false) }
  }

  const handleReset = () => { setCreated(null); setItems([newRow()]); setNote(''); setError('') }

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
          <div style={s.statusPill(created.status)}>{STATUS_LABEL[created.status] ?? created.status}</div>
          {created.status === 'pending' && (
            <p style={s.successHint}>
              Phiếu đã gửi — chờ quản lý duyệt.
              {created.code.startsWith('EXP') && ' Bin xuất hàng được hệ thống gợi ý tự động.'}
            </p>
          )}
          <button style={{ ...s.btnSecondary, marginTop: '1.5rem' }} onClick={handleReset}>Tạo phiếu mới</button>
        </div>
      </div>
    )
  }

  const needFrom = type === 'transfer'
  const needTo   = type === 'import' || type === 'transfer'

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Tạo phiếu kho</h1>
        <p style={s.subtitle}>Nhập đầy đủ thông tin để gửi phiếu chờ duyệt</p>
      </div>

      <div style={s.body}>
        {/* Loại phiếu */}
        <section>
          <label style={s.sectionLabel}>Loại phiếu</label>
          <div style={s.typeRow}>
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setType(opt.value)} style={s.typeBtn(type === opt.value)}>
                <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{opt.label}</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.7, textAlign: 'center' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
          {type === 'export' && (
            <div style={s.hintBox}>
              <span>💡</span>
              <span>Lệnh xuất kho: hệ thống sẽ <strong>tự động gợi ý bin</strong> tối ưu. Phiếu sẽ bị từ chối khi duyệt nếu tồn kho không đủ.</span>
            </div>
          )}
        </section>

        {/* Ghi chú */}
        <section>
          <label style={s.sectionLabel} htmlFor="note">Ghi chú</label>
          <input id="note" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Nhập ghi chú (tuỳ chọn)..." style={s.input} />
        </section>

        {/* Sản phẩm — overflow visible để dropdown thoát ra ngoài */}
        <section>
          <div style={s.sectionHeader}>
            <label style={s.sectionLabel}>Sản phẩm</label>
            <button style={s.btnAddRow} onClick={addRow}>+ Thêm dòng</button>
          </div>

          <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', background: '#fff' }}>
            {/* Header */}
            <div style={s.tableHead}>
              <span style={{ ...colS, flex: '0 0 1.5rem' }}>#</span>
              <span style={{ ...colS, flex: 3 }}>Sản phẩm *</span>
              <span style={{ ...colS, flex: '0 0 5.5rem' }}>Số lượng *</span>
              {needFrom && <span style={{ ...colS, flex: '0 0 9rem' }}>Bin nguồn</span>}
              {needTo   && <span style={{ ...colS, flex: 4 }}>Bin đích *</span>}
              {type === 'export' && <span style={{ ...colS, flex: 2, color: '#3b82f6', fontSize: '0.68rem' }}>Bin (tự động)</span>}
              <span style={{ ...colS, flex: '0 0 1.5rem' }} />
            </div>

            {items.map((row, idx) => (
              <div key={row._key} style={{
                display: 'flex', gap: '0.5rem',
                padding: '0.625rem 1rem',
                background: idx % 2 === 1 ? '#fafafa' : '#fff',
                borderTop: idx === 0 ? 'none' : '1px solid #f0f0f0',
                // CRITICAL: overflow visible so product dropdown escapes
                overflow: 'visible',
                alignItems: 'flex-start',
              }}>
                <span style={{ ...colS, flex: '0 0 1.5rem', paddingTop: '0.4rem', color: '#9ca3af', fontSize: '0.75rem' }}>
                  {idx + 1}
                </span>

                <div style={{ flex: 3 }}>
                  <ProductSearchInput
                    value={row.product_id}
                    displayName={row.product_id ? `${row.product_sku} — ${row.product_name}` : ''}
                    onSelect={p => updateRow(row._key, { product_id: p.id, product_name: p.name, product_sku: p.sku, product_unit: p.unit })}
                  />
                </div>

                <div style={{ flex: '0 0 5.5rem' }}>
                  <input type="number" min={1} value={row.quantity_requested}
                    onChange={e => updateRow(row._key, { quantity_requested: Number(e.target.value) })}
                    style={inp} />
                  {row.product_unit && (
                    <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: '0.1rem' }}>{row.product_unit}</div>
                  )}
                </div>

                {needFrom && (
                  <div style={{ flex: '0 0 9rem' }}>
                    <input value={row.from_bin_id}
                      onChange={e => updateRow(row._key, { from_bin_id: e.target.value })}
                      placeholder="UUID bin nguồn" style={inp} />
                  </div>
                )}

                {needTo && (
                  <div style={{ flex: 4 }}>
                    <BinPicker
                      whId={row.wh_id}   whName={row.wh_name}
                      zoneId={row.zone_id} zoneName={row.zone_name}
                      rackId={row.rack_id} rackName={row.rack_name}
                      binId={row.bin_id}   binCode={row.bin_code}
                      onChange={patch => updateRow(row._key, patch)}
                    />
                  </div>
                )}

                {type === 'export' && (
                  <div style={{ flex: 2, paddingTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontStyle: 'italic', padding: '0.25rem 0.5rem', background: '#eff6ff', borderRadius: '0.375rem', border: '1px dashed #93c5fd' }}>
                      Hệ thống tự gợi ý
                    </span>
                  </div>
                )}

                <div style={{ flex: '0 0 1.5rem', paddingTop: '0.25rem' }}>
                  {items.length > 1 && (
                    <button onClick={() => removeRow(row._key)} style={s.btnRemove}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <div style={s.errorBox}>⚠️ {error}</div>}

        <button onClick={handleSubmit} disabled={loading} style={s.btnSubmit(loading)}>
          {loading ? 'Đang tạo phiếu…' : `Tạo phiếu ${type === 'export' ? 'xuất' : type === 'import' ? 'nhập' : 'chuyển'}`}
        </button>
      </div>
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '0.375rem 0.5rem', border: '1.5px solid #e5e7eb',
  borderRadius: '0.375rem', fontSize: '0.8rem', outline: 'none',
  fontFamily: 'inherit', background: '#fff', color: '#111827', boxSizing: 'border-box',
}

const colS: React.CSSProperties = { display: 'flex', alignItems: 'center' }

const chevron: React.CSSProperties = {
  position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)',
  pointerEvents: 'none', fontSize: '0.65rem', color: '#6b7280',
}

const loadingDot: React.CSSProperties = {
  position: 'absolute', right: '0.5rem', top: '0.4rem', fontSize: '0.7rem', color: '#9ca3af',
}

const ddBox: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
  background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem',
  boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: '13rem',
  overflowY: 'auto', display: 'flex', flexDirection: 'column',
}

const ddItem: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none',
  cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontFamily: 'inherit',
  display: 'flex', alignItems: 'baseline', gap: '0.125rem',
}

const s = {
  page:     { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:   { padding: '2rem 2rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#fff' } as React.CSSProperties,
  title:    { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle: { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  body:     { maxWidth: '64rem', margin: '0 auto', padding: '1.5rem 2rem 4rem', display: 'flex', flexDirection: 'column' as const, gap: '1.75rem' },
  sectionLabel:  { display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.625rem' } as React.CSSProperties,
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' } as React.CSSProperties,
  hintBox: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.625rem', fontSize: '0.82rem', color: '#1e40af', lineHeight: '1.5' } as React.CSSProperties,
  typeRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const },
  typeBtn: (active: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
    padding: '0.875rem 1.5rem', borderRadius: '0.75rem',
    border: active ? '2px solid #2563eb' : '2px solid #e5e7eb',
    background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#374151',
    cursor: 'pointer', minWidth: '9rem', fontFamily: 'inherit',
  }),
  input: { width: '100%', boxSizing: 'border-box' as const, padding: '0.625rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#111827' } as React.CSSProperties,
  tableHead: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f3f4f6', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderRadius: '0.75rem 0.75rem 0 0' } as React.CSSProperties,
  btnAddRow: { background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', padding: '0.25rem 0' } as React.CSSProperties,
  btnRemove: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.875rem', padding: '0.25rem', lineHeight: 1 } as React.CSSProperties,
  errorBox: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.5rem', color: '#dc2626', fontSize: '0.875rem' } as React.CSSProperties,
  btnSubmit: (disabled: boolean): React.CSSProperties => ({ padding: '0.875rem', background: disabled ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }),
  btnSecondary: { padding: '0.625rem 1.25rem', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  successWrap:  { minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  successCard:  { background: '#fff', borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center' as const, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', maxWidth: '22rem', width: '100%', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  successIcon:  { width: '4rem', height: '4rem', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', marginBottom: '1.25rem', color: '#16a34a' } as React.CSSProperties,
  successTitle: { margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  codeBox:  { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f3f4f6', borderRadius: '0.625rem', marginBottom: '0.75rem' } as React.CSSProperties,
  codeLabel:{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 } as React.CSSProperties,
  codeValue:{ fontSize: '0.9rem', color: '#111827', fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'monospace' } as React.CSSProperties,
  statusPill: (status: string): React.CSSProperties => ({ display: 'inline-block', padding: '0.25rem 0.875rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: STATUS_COLOR[status] ?? '#6b7280', marginBottom: '0.75rem' }),
  successHint: { fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0 0', textAlign: 'center' as const } as React.CSSProperties,
}