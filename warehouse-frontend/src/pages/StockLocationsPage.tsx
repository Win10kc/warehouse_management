import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'

interface BinStockRow {
  warehouse_id:   string
  warehouse_name: string
  zone_code:      string
  zone_name:      string
  rack_code:      string
  bin_id:         string
  bin_code:       string
  product_id:     string
  product_name:   string
  sku:            string
  unit:           string
  quantity:       number
}

type CollapseMap = Record<string, boolean>

function toggle(map: CollapseMap, key: string): CollapseMap {
  return { ...map, [key]: !map[key] }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      transition: 'transform 0.2s',
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      fontSize: '0.75rem',
      color: '#6b7280',
      marginRight: '0.375rem',
    }}>▶</span>
  )
}

// ── QR Modal ──────────────────────────────────────────────────
function QRModal({ binId, binCode, onClose }: { binId: string; binCode: string; onClose: () => void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(binId)}&margin=10`

  // Đóng khi click backdrop
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div style={ms.backdrop} onClick={handleBackdrop}>
      <div style={ms.modal}>
        {/* Header */}
        <div style={ms.modalHeader}>
          <div>
            <p style={ms.modalLabel}>QR Code — Bin</p>
            <p style={ms.modalBinCode}>{binCode}</p>
          </div>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* QR image */}
        <div style={ms.qrWrap}>
          <img
            src={qrUrl}
            alt={`QR bin ${binCode}`}
            width={220}
            height={220}
            style={{ borderRadius: '0.5rem', display: 'block' }}
          />
        </div>

        {/* Bin ID nhỏ để tham khảo */}
        <div style={ms.binIdWrap}>
          <span style={ms.binIdLabel}>Bin ID</span>
          <span style={ms.binIdValue}>{binId}</span>
        </div>

        <p style={ms.hint}>
          Android scan QR này để bắt đầu kiểm kê bin <strong>{binCode}</strong>
        </p>

        <button style={ms.closeFullBtn} onClick={onClose}>Đóng</button>
      </div>
    </div>
  )
}

const ms: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: '1.25rem', padding: '1.75rem',
    width: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
  },
  modalHeader: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  modalLabel: { margin: 0, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 },
  modalBinCode: { margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' },
  closeBtn: {
    background: '#f3f4f6', border: 'none', borderRadius: '0.5rem',
    width: '2rem', height: '2rem', cursor: 'pointer', fontSize: '0.875rem',
    color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qrWrap: {
    background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem',
    border: '1.5px solid #e2e8f0',
  },
  binIdWrap: {
    width: '100%', background: '#f8fafc', borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem',
  },
  binIdLabel: { fontSize: '0.65rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' },
  binIdValue: { fontFamily: 'monospace', fontSize: '0.7rem', color: '#374151', wordBreak: 'break-all' },
  hint: { margin: 0, fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' },
  closeFullBtn: {
    width: '100%', padding: '0.625rem', background: '#1d4ed8', color: '#fff',
    border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.875rem', fontFamily: 'inherit',
  },
}

// ── Main Page ─────────────────────────────────────────────────
export default function StockLocationsPage() {
  const navigate = useNavigate()
  const [rows,    setRows]    = useState<BinStockRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')

  const [openWH,   setOpenWH]   = useState<CollapseMap>({})
  const [openZone, setOpenZone] = useState<CollapseMap>({})
  const [openRack, setOpenRack] = useState<CollapseMap>({})

  // QR modal state
  const [qrBin, setQrBin] = useState<{ binId: string; binCode: string } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await api.get('/stock/locations', { params: q ? { search: q } : {} })
      const data: BinStockRow[] = res.data.data ?? []
      setRows(data)

      const wh: CollapseMap = {}
      const zone: CollapseMap = {}
      const rack: CollapseMap = {}
      data.forEach((r) => {
        wh[r.warehouse_id] = true
        zone[`${r.warehouse_id}__${r.zone_code}`] = true
        rack[`${r.warehouse_id}__${r.zone_code}__${r.rack_code}`] = false
      })
      setOpenWH(wh)
      setOpenZone(zone)
      setOpenRack(rack)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load('') }, [load])

  const handleSearch = (val: string) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(val), 300)
  }

  // ── Build hierarchy ───────────────────────────────────────────
  type RackMap  = Record<string, BinStockRow[]>
  type ZoneMap  = Record<string, { racks: RackMap; zone_name: string }>
  type WHMap    = Record<string, { zones: ZoneMap; warehouse_name: string }>

  const hierarchy = rows.reduce<WHMap>((wh, r) => {
    if (!wh[r.warehouse_id]) wh[r.warehouse_id] = { warehouse_name: r.warehouse_name, zones: {} }
    const zones = wh[r.warehouse_id].zones
    const zKey = r.zone_code
    if (!zones[zKey]) zones[zKey] = { zone_name: r.zone_name, racks: {} }
    const racks = zones[zKey].racks
    if (!racks[r.rack_code]) racks[r.rack_code] = []
    racks[r.rack_code].push(r)
    return wh
  }, {})

  const totalItems = rows.length
  const totalWH    = Object.keys(hierarchy).length

  // ── Group rows by bin để hiện nút QR 1 lần/bin ───────────────
  // Dùng trong render: lấy bin đầu tiên của mỗi nhóm bin_code trong rack
  const getUniqueBins = (rRows: BinStockRow[]) => {
    const seen = new Set<string>()
    return rRows.filter((r) => {
      if (seen.has(r.bin_id)) return false
      seen.add(r.bin_id)
      return true
    })
  }

  return (
    <div style={s.page}>
      {/* QR Modal */}
      {qrBin && (
        <QRModal
          binId={qrBin.binId}
          binCode={qrBin.binCode}
          onClose={() => setQrBin(null)}
        />
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Tồn kho theo vị trí</h1>
          <p style={s.subtitle}>{totalItems} mặt hàng · {totalWH} kho</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            style={s.searchInput}
            placeholder="🔍 Tìm kho, khu, kệ, sản phẩm, SKU..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button style={s.btnBack} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {loading ? (
        <div style={s.center}>Đang tải...</div>
      ) : rows.length === 0 ? (
        <div style={s.center}>Không có dữ liệu{search ? ` cho "${search}"` : ''}</div>
      ) : (
        <div style={{ padding: '1.5rem 2rem' }}>
          {Object.entries(hierarchy).map(([whId, whData]) => (
            <div key={whId} style={s.whCard}>

              {/* Warehouse header */}
              <div style={s.whHeader} onClick={() => setOpenWH((m) => toggle(m, whId))}>
                <Chevron open={!!openWH[whId]} />
                <span style={s.whIcon}>🏭</span>
                <span style={s.whName}>{whData.warehouse_name}</span>
                <span style={s.countBadge('blue')}>{Object.keys(whData.zones).length} khu vực</span>
                <span style={s.countBadge('gray')}>{rows.filter((r) => r.warehouse_id === whId).length} mặt hàng</span>
              </div>

              {openWH[whId] && (
                <div style={s.whBody}>
                  {Object.entries(whData.zones).map(([zCode, zData]) => {
                    const zKey = `${whId}__${zCode}`
                    const zRows = rows.filter((r) => r.warehouse_id === whId && r.zone_code === zCode)
                    return (
                      <div key={zCode} style={s.zoneCard}>

                        {/* Zone header */}
                        <div style={s.zoneHeader} onClick={() => setOpenZone((m) => toggle(m, zKey))}>
                          <Chevron open={!!openZone[zKey]} />
                          <span style={s.zoneIcon}>📦</span>
                          <span style={s.zoneCode}>{zCode}</span>
                          <span style={s.zoneName}>{zData.zone_name}</span>
                          <span style={s.countBadge('teal')}>{Object.keys(zData.racks).length} kệ</span>
                          <span style={s.countBadge('gray')}>{zRows.length} mặt hàng</span>
                        </div>

                        {openZone[zKey] && (
                          <div style={s.zoneBody}>
                            {Object.entries(zData.racks).map(([rCode, rRows]) => {
                              const rKey = `${whId}__${zCode}__${rCode}`
                              const uniqueBins = getUniqueBins(rRows)
                              return (
                                <div key={rCode} style={s.rackCard}>

                                  {/* Rack header */}
                                  <div style={s.rackHeader} onClick={() => setOpenRack((m) => toggle(m, rKey))}>
                                    <Chevron open={!!openRack[rKey]} />
                                    <span style={s.rackIcon}>🗄️</span>
                                    <span style={s.rackCode}>{rCode}</span>
                                    <span style={s.countBadge('purple')}>{uniqueBins.length} bin</span>
                                    <span style={s.countBadge('gray')}>
                                      {rRows.reduce((sum, r) => sum + r.quantity, 0).toLocaleString('vi-VN')} sp
                                    </span>
                                  </div>

                                  {/* Bins */}
                                  {openRack[rKey] && (
                                    <div style={s.binTableWrap}>
                                      {/* ── Bin QR buttons ── */}
                                      <div style={s.binQrBar}>
                                        <span style={s.binQrBarLabel}>📌 Bins trong kệ này:</span>
                                        <div style={s.binQrList}>
                                          {uniqueBins.map((b) => (
                                            <button
                                              key={b.bin_id}
                                              style={s.qrBtn}
                                              title={`Hiện QR cho bin ${b.bin_code}`}
                                              onClick={() => setQrBin({ binId: b.bin_id, binCode: b.bin_code })}
                                            >
                                              <span style={s.qrBtnCode}>{b.bin_code}</span>
                                              <span style={s.qrBtnIcon}>QR</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      {/* ── Table sản phẩm ── */}
                                      <table style={s.table}>
                                        <thead>
                                          <tr style={s.thead}>
                                            <th style={s.th}>Bin</th>
                                            <th style={s.th}>Sản phẩm</th>
                                            <th style={s.th}>SKU</th>
                                            <th style={s.th}>ĐVT</th>
                                            <th style={{ ...s.th, textAlign: 'right' }}>Tồn kho</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rRows.map((r, idx) => (
                                            <tr key={`${r.bin_id}-${r.product_id}`} style={s.tr(idx % 2 === 1)}>
                                              <td style={s.td}>
                                                <span style={s.mono}>{r.bin_code}</span>
                                              </td>
                                              <td style={s.td}>{r.product_name}</td>
                                              <td style={s.td}><span style={s.sku}>{r.sku}</span></td>
                                              <td style={s.td}>{r.unit}</td>
                                              <td style={{
                                                ...s.td,
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: r.quantity < 10 ? '#dc2626' : '#111827',
                                              }}>
                                                {r.quantity.toLocaleString('vi-VN')}
                                                {r.quantity < 10 && (
                                                  <span style={s.lowBadge}>⚠ Thấp</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
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
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s: Record<string, any> = {
  page:        { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'DM Sans','Segoe UI',sans-serif" },
  header:      { padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  title:       { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' },
  subtitle:    { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' },
  searchInput: { padding: '0.5rem 0.875rem', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'inherit', width: '18rem', color: '#111827', background: '#fff' },
  btnBack:     { padding: '0.5rem 1rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', color: '#374151' },
  center:      { padding: '4rem', textAlign: 'center', color: '#9ca3af' },

  whCard:   { background: '#fff', borderRadius: '1rem', border: '1.5px solid #e2e8f0', marginBottom: '1rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  whHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 1.25rem', cursor: 'pointer', userSelect: 'none', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  whIcon:   { fontSize: '1.1rem' },
  whName:   { fontWeight: 800, fontSize: '1rem', color: '#1e3a5f', flex: 1 },
  whBody:   { padding: '0.75rem' },

  zoneCard:   { background: '#f8fafc', borderRadius: '0.75rem', border: '1.5px solid #e2e8f0', marginBottom: '0.625rem', overflow: 'hidden' },
  zoneHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', cursor: 'pointer', userSelect: 'none', background: '#f0f9ff', borderBottom: '1px solid #bae6fd' },
  zoneIcon:   { fontSize: '1rem' },
  zoneCode:   { fontFamily: 'monospace', fontWeight: 700, color: '#0369a1', fontSize: '0.875rem' },
  zoneName:   { color: '#374151', fontSize: '0.875rem', flex: 1 },
  zoneBody:   { padding: '0.5rem 0.75rem' },

  rackCard:   { background: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '0.375rem', overflow: 'hidden' },
  rackHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer', userSelect: 'none', background: '#fafafa' },
  rackIcon:   { fontSize: '0.9rem' },
  rackCode:   { fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', fontSize: '0.825rem', flex: 1 },

  countBadge: (color: 'blue' | 'teal' | 'purple' | 'gray'): React.CSSProperties => {
    const map = {
      blue:   { bg: '#dbeafe', c: '#1d4ed8' },
      teal:   { bg: '#ccfbf1', c: '#0f766e' },
      purple: { bg: '#ede9fe', c: '#6d28d9' },
      gray:   { bg: '#f3f4f6', c: '#6b7280' },
    }
    return { background: map[color].bg, color: map[color].c, borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }
  },

  // Bin QR bar
  binQrBar:      { padding: '0.625rem 1rem', background: '#fafaf9', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  binQrBarLabel: { fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  binQrList:     { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' },
  qrBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.25rem 0.625rem', border: '1.5px solid #2563eb',
    borderRadius: '0.5rem', background: '#eff6ff', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
  },
  qrBtnCode: { fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#1d4ed8' },
  qrBtnIcon: { fontSize: '0.68rem', fontWeight: 800, color: '#fff', background: '#2563eb', borderRadius: '0.25rem', padding: '0.05rem 0.3rem', letterSpacing: '0.03em' },

  binTableWrap: { borderTop: '1px solid #f3f4f6' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  thead:        { background: '#f9fafb' },
  th:           { padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  tr:           (odd: boolean): React.CSSProperties => ({ background: odd ? '#fafafa' : '#fff' }),
  td:           { padding: '0.625rem 1rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  mono:         { fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#2563eb' },
  sku:          { fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' },
  lowBadge:     { marginLeft: '0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: '999px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 },
}