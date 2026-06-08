import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────
interface Bin      { id: string; code: string; qr_code: string; capacity: number; is_active: boolean }
interface Rack     { id: string; code: string; name: string; max_weight_kg: number; bins: Bin[] }
interface Zone     { id: string; code: string; name: string; description: string; racks: Rack[] }
interface Warehouse{ id: string; name: string; address: string; description: string; is_active: boolean; zones: Zone[] }

// ─── Confirm Dialog ───────────────────────────────────────────
function ConfirmDialog({
  message, onConfirm, onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={dl.overlay}>
      <div style={dl.box}>
        <div style={dl.icon}>⚠️</div>
        <p style={dl.msg}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={dl.btnCancel} onClick={onCancel}>Huỷ</button>
          <button style={dl.btnOk} onClick={onConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal tạo/sửa ───────────────────────────────────────────
type ModalMode = 'create-wh' | 'create-zone' | 'create-rack' | 'create-bin' | null

function CreateModal({
  mode, parentName, onSave, onClose,
}: {
  mode: ModalMode
  parentName: string
  onSave: (data: Record<string, string | number>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm]   = useState<Record<string, string | number>>({})
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const f = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }))

  const titles: Record<string, string> = {
    'create-wh':   'Thêm kho mới',
    'create-zone': `Thêm khu vực vào "${parentName}"`,
    'create-rack': `Thêm kệ vào "${parentName}"`,
    'create-bin':  `Thêm bin vào "${parentName}"`,
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try { await onSave(form); onClose() }
    catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra')
    } finally { setSaving(false) }
  }

  return (
    <div style={dl.overlay}>
      <div style={{ ...dl.box, maxWidth: '26rem', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>
          {mode ? titles[mode] : ''}
        </h3>

        {/* Warehouse */}
        {mode === 'create-wh' && <>
          <Field label="Tên kho *"    value={form.name        as string ?? ''} onChange={(v) => f('name', v)} placeholder="Kho Hà Nội" />
          <Field label="Địa chỉ"      value={form.address     as string ?? ''} onChange={(v) => f('address', v)} placeholder="123 Đường ABC" />
          <Field label="Mô tả"        value={form.description as string ?? ''} onChange={(v) => f('description', v)} />
        </>}

        {/* Zone */}
        {mode === 'create-zone' && <>
          <Field label="Mã khu vực *" value={form.code        as string ?? ''} onChange={(v) => f('code', v)} placeholder="ZONE-A" />
          <Field label="Tên khu vực *"value={form.name        as string ?? ''} onChange={(v) => f('name', v)} placeholder="Khu A" />
          <Field label="Mô tả"        value={form.description as string ?? ''} onChange={(v) => f('description', v)} />
        </>}

        {/* Rack */}
        {mode === 'create-rack' && <>
          <Field label="Mã kệ *"      value={form.code           as string ?? ''} onChange={(v) => f('code', v)} placeholder="RACK-01" />
          <Field label="Tên kệ *"     value={form.name           as string ?? ''} onChange={(v) => f('name', v)} placeholder="Kệ 01" />
          <Field label="Tải trọng (kg)" value={form.max_weight_kg as string ?? ''} onChange={(v) => f('max_weight_kg', Number(v))} placeholder="500" type="number" />
        </>}

        {/* Bin */}
        {mode === 'create-bin' && <>
          <Field label="Mã bin *"     value={form.code     as string ?? ''} onChange={(v) => f('code', v)} placeholder="BIN-01" />
          <Field label="Mã QR"        value={form.qr_code  as string ?? ''} onChange={(v) => f('qr_code', v)} placeholder="QR-BIN-01" />
          <Field label="Capacity"     value={form.capacity as string ?? ''} onChange={(v) => f('capacity', Number(v))} placeholder="100" type="number" />
        </>}

        {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>⚠️ {error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button style={dl.btnCancel} onClick={onClose} disabled={saving}>Huỷ</button>
          <button style={dl.btnOk}     onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Xác nhận tạo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', color: '#111827', background: '#fff' }}
      />
    </label>
  )
}

// ─── Chevron ──────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)', fontSize: '0.7rem', color: '#9ca3af', marginRight: '0.25rem' }}>
      ▶
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function WarehouseManagerPage() {
  const navigate = useNavigate()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(false)
  const [openWH,  setOpenWH]        = useState<Record<string, boolean>>({})
  const [openZone,setOpenZone]      = useState<Record<string, boolean>>({})
  const [openRack,setOpenRack]      = useState<Record<string, boolean>>({})

  // Modal state
  const [modal, setModal]           = useState<{ mode: ModalMode; parentName: string; onSave: (d: Record<string, string | number>) => Promise<void> } | null>(null)

  // Confirm state
  const [confirm, setConfirm]       = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [error,   setError]         = useState('')

  // ── Load ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/warehouses')
      const whs: Warehouse[] = res.data.data ?? []

      // Load zones + racks + bins cho mỗi warehouse
      const full = await Promise.all(whs.map(async (wh) => {
        const zRes = await api.get(`/warehouses/${wh.id}/zones`)
        const zones: Zone[] = zRes.data.data ?? []
        const fullZones = await Promise.all(zones.map(async (z) => {
          const rRes = await api.get(`/warehouses/${wh.id}/zones/${z.id}/racks`)
          const racks: Rack[] = rRes.data.data ?? []
          const fullRacks = await Promise.all(racks.map(async (r) => {
            const bRes = await api.get(`/warehouses/${wh.id}/zones/${z.id}/racks/${r.id}/bins`)
            return { ...r, bins: bRes.data.data ?? [] }
          }))
          return { ...z, racks: fullRacks }
        }))
        return { ...wh, zones: fullZones }
      }))

      setWarehouses(full)
      // Mở hết warehouse mặc định
      const openMap: Record<string, boolean> = {}
      full.forEach((w) => { openMap[w.id] = true })
      setOpenWH(openMap)
    } catch { setError('Không thể tải dữ liệu') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Helpers confirm + delete ─────────────────────────────────
  const askConfirm = (message: string, onConfirm: () => void) =>
    setConfirm({ message, onConfirm })

  const deleteWH = (wh: Warehouse) => {
    const hasStock = wh.zones.some((z) => z.racks.some((r) => r.bins.length > 0))
    if (hasStock) { setError(`Kho "${wh.name}" còn hàng trong bin, không thể xóa`); return }
    askConfirm(
      `Xóa kho "${wh.name}"? Hành động này không thể hoàn tác.`,
      async () => {
        await api.delete(`/warehouses/${wh.id}`)
        load()
      }
    )
  }

  const deleteZone = (wh: Warehouse, z: Zone) => {
    const hasStock = z.racks.some((r) => r.bins.length > 0)
    if (hasStock) { setError(`Khu vực "${z.code}" còn hàng trong bin, không thể xóa`); return }
    askConfirm(
      `Xóa khu vực "${z.code} — ${z.name}" khỏi kho "${wh.name}"? Hành động này không thể hoàn tác.`,
      async () => {
        await api.delete(`/warehouses/${wh.id}/zones/${z.id}`)
        load()
      }
    )
  }

  const deleteRack = (wh: Warehouse, z: Zone, r: Rack) => {
    if (r.bins.length > 0) { setError(`Kệ "${r.code}" còn bin, không thể xóa`); return }
    askConfirm(
      `Xóa kệ "${r.code}" khỏi khu vực "${z.code}"? Hành động này không thể hoàn tác.`,
      async () => {
        await api.delete(`/warehouses/${wh.id}/zones/${z.id}/racks/${r.id}`)
        load()
      }
    )
  }

  const deleteBin = (wh: Warehouse, z: Zone, r: Rack, b: Bin) => {
    askConfirm(
      `Xóa bin "${b.code}" khỏi kệ "${r.code}"? Hành động này không thể hoàn tác.`,
      async () => {
        await api.delete(`/warehouses/${wh.id}/zones/${z.id}/racks/${r.id}/bins/${b.id}`)
        load()
      }
    )
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Quản lý cấu trúc kho</h1>
          <p style={s.subtitle}>{warehouses.length} kho · {warehouses.reduce((a, w) => a + w.zones.length, 0)} khu vực</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button style={s.btnPrimary} onClick={() =>
            setModal({
              mode: 'create-wh',
              parentName: '',
              onSave: async (d) => { await api.post('/warehouses', d); load() },
            })
          }>
            + Thêm kho
          </button>
          <button style={s.btnBack} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={s.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={s.errorClose}>✕</button>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '1.5rem 2rem' }}>
        {loading ? (
          <div style={s.center}>Đang tải...</div>
        ) : warehouses.length === 0 ? (
          <div style={s.center}>Chưa có kho nào. Bấm "+ Thêm kho" để bắt đầu.</div>
        ) : (
          warehouses.map((wh) => (
            <div key={wh.id} style={s.whCard}>

              {/* Warehouse row */}
              <div style={s.whRow}>
                <div style={s.rowLeft} onClick={() => setOpenWH((m) => ({ ...m, [wh.id]: !m[wh.id] }))}>
                  <Chevron open={!!openWH[wh.id]} />
                  <span style={s.whIcon}>🏭</span>
                  <span style={s.whName}>{wh.name}</span>
                  {wh.address && <span style={s.meta}>{wh.address}</span>}
                  <span style={s.badge('#dbeafe', '#1d4ed8')}>{wh.zones.length} khu</span>
                </div>
                <div style={s.rowActions}>
                  <button style={s.btnAdd} onClick={() =>
                    setModal({
                      mode: 'create-zone',
                      parentName: wh.name,
                      onSave: async (d) => {
                        askConfirm(
                          `Thêm khu vực vào kho "${wh.name}"? Thao tác này sẽ thay đổi cấu trúc kho.`,
                          async () => { await api.post(`/warehouses/${wh.id}/zones`, d); load() }
                        )
                      },
                    })
                  }>+ Zone</button>
                  <button style={s.btnDel} onClick={() => deleteWH(wh)}>🗑</button>
                </div>
              </div>

              {/* Zones */}
              {openWH[wh.id] && (
                <div style={s.whBody}>
                  {wh.zones.length === 0 ? (
                    <div style={s.empty}>Chưa có khu vực nào</div>
                  ) : wh.zones.map((z) => {
                    const zKey = `${wh.id}__${z.id}`
                    return (
                      <div key={z.id} style={s.zoneCard}>

                        {/* Zone row */}
                        <div style={s.zoneRow}>
                          <div style={s.rowLeft} onClick={() => setOpenZone((m) => ({ ...m, [zKey]: !m[zKey] }))}>
                            <Chevron open={!!openZone[zKey]} />
                            <span style={s.zoneIcon}>📦</span>
                            <span style={s.zoneCode}>{z.code}</span>
                            <span style={s.zoneName}>{z.name}</span>
                            <span style={s.badge('#ccfbf1', '#0f766e')}>{z.racks.length} kệ</span>
                          </div>
                          <div style={s.rowActions}>
                            <button style={s.btnAdd} onClick={() =>
                              setModal({
                                mode: 'create-rack',
                                parentName: `${z.code} — ${z.name}`,
                                onSave: async (d) => {
                                  askConfirm(
                                    `Thêm kệ vào khu vực "${z.code}"? Thao tác này sẽ thay đổi cấu trúc kho.`,
                                    async () => { await api.post(`/warehouses/${wh.id}/zones/${z.id}/racks`, d); load() }
                                  )
                                },
                              })
                            }>+ Kệ</button>
                            <button style={s.btnDel} onClick={() => deleteZone(wh, z)}>🗑</button>
                          </div>
                        </div>

                        {/* Racks */}
                        {openZone[zKey] && (
                          <div style={s.zoneBody}>
                            {z.racks.length === 0 ? (
                              <div style={s.empty}>Chưa có kệ nào</div>
                            ) : z.racks.map((r) => {
                              const rKey = `${zKey}__${r.id}`
                              return (
                                <div key={r.id} style={s.rackCard}>

                                  {/* Rack row */}
                                  <div style={s.rackRow}>
                                    <div style={s.rowLeft} onClick={() => setOpenRack((m) => ({ ...m, [rKey]: !m[rKey] }))}>
                                      <Chevron open={!!openRack[rKey]} />
                                      <span style={s.rackIcon}>🗄️</span>
                                      <span style={s.rackCode}>{r.code}</span>
                                      <span style={s.meta}>{r.name}</span>
                                      {r.max_weight_kg > 0 && <span style={s.meta}>max {r.max_weight_kg}kg</span>}
                                      <span style={s.badge('#ede9fe', '#6d28d9')}>{r.bins.length} bin</span>
                                    </div>
                                    <div style={s.rowActions}>
                                      <button style={s.btnAdd} onClick={() =>
                                        setModal({
                                          mode: 'create-bin',
                                          parentName: r.code,
                                          onSave: async (d) => {
                                            askConfirm(
                                              `Thêm bin vào kệ "${r.code}"? Thao tác này sẽ thay đổi cấu trúc kho.`,
                                              async () => { await api.post(`/warehouses/${wh.id}/zones/${z.id}/racks/${r.id}/bins`, d); load() }
                                            )
                                          },
                                        })
                                      }>+ Bin</button>
                                      <button style={s.btnDel} onClick={() => deleteRack(wh, z, r)}>🗑</button>
                                    </div>
                                  </div>

                                  {/* Bins */}
                                  {openRack[rKey] && (
                                    <div style={s.binGrid}>
                                      {r.bins.length === 0 ? (
                                        <div style={s.empty}>Chưa có bin nào</div>
                                      ) : r.bins.map((b) => (
                                        <div key={b.id} style={s.binChip}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                            <span style={s.binCode}>{b.code}</span>
                                            {b.qr_code && <span style={s.qrBadge}>QR</span>}
                                          </div>
                                          {b.capacity > 0 && (
                                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>cap: {b.capacity}</span>
                                          )}
                                          <button style={s.binDel} onClick={() => deleteBin(wh, z, r, b)}>🗑</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {modal && (
        <CreateModal
          mode={modal.mode}
          parentName={modal.parentName}
          onSave={modal.onSave}
          onClose={() => setModal(null)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={async () => {
            await confirm.onConfirm()
            setConfirm(null)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  page:       { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:     { padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  title:      { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle:   { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  btnPrimary: { padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' } as React.CSSProperties,
  btnBack:    { padding: '0.5rem 1rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', color: '#374151' } as React.CSSProperties,
  center:     { padding: '4rem', textAlign: 'center' as const, color: '#9ca3af' },
  empty:      { padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' } as React.CSSProperties,
  errorBanner:{ margin: '1rem 2rem 0', padding: '0.75rem 1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.625rem', color: '#dc2626', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  errorClose: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem' } as React.CSSProperties,

  // Rows
  rowLeft:    { display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, cursor: 'pointer', userSelect: 'none' as const, minWidth: 0 },
  rowActions: { display: 'flex', gap: '0.375rem', flexShrink: 0 },
  btnAdd:     { padding: '0.25rem 0.625rem', background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  btnDel:     { padding: '0.25rem 0.5rem', background: '#fff', color: '#ef4444', border: '1.5px solid #fca5a5', borderRadius: '0.375rem', fontSize: '0.8rem', cursor: 'pointer' } as React.CSSProperties,

  // Warehouse
  whCard:     { background: '#fff', borderRadius: '1rem', border: '1.5px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as React.CSSProperties,
  whRow:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' } as React.CSSProperties,
  whIcon:     { fontSize: '1.1rem', flexShrink: 0 } as React.CSSProperties,
  whName:     { fontWeight: 800, fontSize: '1rem', color: '#1e3a5f' } as React.CSSProperties,
  whBody:     { padding: '0.75rem' } as React.CSSProperties,
  meta:       { fontSize: '0.78rem', color: '#9ca3af' } as React.CSSProperties,

  // Zone
  zoneCard:   { background: '#f8fafc', borderRadius: '0.75rem', border: '1.5px solid #e2e8f0', marginBottom: '0.5rem', overflow: 'hidden' } as React.CSSProperties,
  zoneRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', gap: '0.5rem' } as React.CSSProperties,
  zoneIcon:   { fontSize: '1rem', flexShrink: 0 } as React.CSSProperties,
  zoneCode:   { fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.875rem' } as React.CSSProperties,
  zoneName:   { color: '#374151', fontSize: '0.875rem' } as React.CSSProperties,
  zoneBody:   { padding: '0.5rem 0.75rem' } as React.CSSProperties,

  // Rack
  rackCard:   { background: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '0.375rem', overflow: 'hidden' } as React.CSSProperties,
  rackRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.875rem', background: '#fafafa', gap: '0.5rem' } as React.CSSProperties,
  rackIcon:   { fontSize: '0.9rem', flexShrink: 0 } as React.CSSProperties,
  rackCode:   { fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', fontSize: '0.825rem' } as React.CSSProperties,

  // Bin grid
  binGrid:    { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', padding: '0.625rem 0.875rem', borderTop: '1px solid #f3f4f6', background: '#fdfdfd' },
  binChip:    { display: 'flex', flexDirection: 'column' as const, gap: '0.2rem', padding: '0.5rem 0.625rem', background: '#f3f4f6', borderRadius: '0.5rem', border: '1px solid #e5e7eb', minWidth: '90px' } as React.CSSProperties,
  binCode:    { fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#111827' } as React.CSSProperties,
  qrBadge:    { background: '#dcfce7', color: '#166534', borderRadius: '3px', padding: '0 4px', fontSize: '0.65rem', fontWeight: 700 } as React.CSSProperties,
  binDel:     { alignSelf: 'flex-end', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', padding: 0, marginTop: '0.1rem' } as React.CSSProperties,

  badge: (bg: string, color: string): React.CSSProperties => ({
    background: bg, color, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
  }),
}

const dl = {
  overlay:   { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  box:       { background: '#fff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '22rem', width: '100%', margin: '1rem', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  icon:      { fontSize: '2rem', textAlign: 'center' as const } as React.CSSProperties,
  msg:       { margin: 0, fontSize: '0.9rem', color: '#374151', textAlign: 'center' as const, lineHeight: 1.5 } as React.CSSProperties,
  btnCancel: { flex: 1, padding: '0.625rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' } as React.CSSProperties,
  btnOk:     { flex: 2, padding: '0.625rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
}