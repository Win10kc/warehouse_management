import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface SKURow {
  product_id:     string
  sku:            string
  product_name:   string
  unit:           string
  total_import:   number
  total_export:   number
  total_transfer: number
  net_change:     number
}

function exportCSV(rows: SKURow[], month: string) {
  const headers = ['SKU', 'Tên sản phẩm', 'ĐVT', 'Nhập', 'Xuất', 'Chuyển', 'Biến động ròng']
  const data = rows.map((r) => [
    r.sku,
    `"${r.product_name.replace(/"/g, '""')}"`,
    r.unit,
    r.total_import,
    r.total_export,
    r.total_transfer,
    r.net_change,
  ])
  const csv = [headers, ...data].map((r) => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `bao_cao_sku_${month}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function exportPDF(rows: SKURow[], month: string) {
  const totalImport  = rows.reduce((s, r) => s + r.total_import,  0)
  const totalExport  = rows.reduce((s, r) => s + r.total_export,  0)
  const totalNet     = rows.reduce((s, r) => s + r.net_change,    0)

  const rowsHTML = rows.map((r, i) => `
    <tr style="background:${i % 2 === 1 ? '#F9FAFB' : '#fff'}">
      <td style="font-family:monospace;font-weight:700">${r.sku}</td>
      <td>${r.product_name}</td>
      <td>${r.unit}</td>
      <td style="text-align:right;color:#2563EB">${r.total_import.toLocaleString('vi-VN')}</td>
      <td style="text-align:right;color:#D97706">${r.total_export.toLocaleString('vi-VN')}</td>
      <td style="text-align:right;color:#7C3AED">${r.total_transfer.toLocaleString('vi-VN')}</td>
      <td style="text-align:right;font-weight:700;color:${r.net_change >= 0 ? '#16A34A' : '#DC2626'}">
        ${r.net_change >= 0 ? '+' : ''}${r.net_change.toLocaleString('vi-VN')}
      </td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"/>
  <title>Báo cáo SKU ${month}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px}
    h1{font-size:18px;font-weight:800;margin-bottom:4px}
    .sub{font-size:12px;color:#6B7280;margin-bottom:16px}
    .stats{display:flex;gap:12px;margin-bottom:16px}
    .stat{background:#F3F4F6;border-radius:8px;padding:8px 14px;flex:1}
    .stat-label{font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em}
    .stat-value{font-size:18px;font-weight:800;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#1E40AF;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
    td{padding:5px 8px;border-bottom:1px solid #E5E7EB}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>Báo cáo theo SKU</h1>
  <div class="sub">Tháng ${month} · ${rows.length} sản phẩm · Chỉ tính phiếu đã hoàn tất</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Tổng SKU</div><div class="stat-value">${rows.length}</div></div>
    <div class="stat"><div class="stat-label">Tổng nhập</div><div class="stat-value" style="color:#2563EB">${totalImport.toLocaleString('vi-VN')}</div></div>
    <div class="stat"><div class="stat-label">Tổng xuất</div><div class="stat-value" style="color:#D97706">${totalExport.toLocaleString('vi-VN')}</div></div>
    <div class="stat"><div class="stat-label">Biến động ròng</div><div class="stat-value" style="color:${totalNet >= 0 ? '#16A34A' : '#DC2626'}">${totalNet >= 0 ? '+' : ''}${totalNet.toLocaleString('vi-VN')}</div></div>
  </div>
  <table><thead><tr>
    <th>SKU</th><th>Tên sản phẩm</th><th>ĐVT</th>
    <th>Nhập</th><th>Xuất</th><th>Chuyển</th><th>Biến động ròng</th>
  </tr></thead><tbody>${rowsHTML}</tbody></table>
  <div style="margin-top:16px;font-size:10px;color:#9CA3AF;text-align:right">
    Hệ thống Quản lý Kho · Xuất lúc ${new Date().toLocaleString('vi-VN')}
  </div>
  </body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Trình duyệt chặn popup'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

export default function SKUReportPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)
  const now = new Date()
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [rows,    setRows]    = useState<SKURow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/reports/products', { params: { month: m } })
      setRows(res.data.data?.rows ?? [])
    } catch {
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [load, month])

  // Chỉ admin/manager mới vào được (PrivateRoute đã guard, thêm lớp UI)
  if (role === 'warehouse') {
    return <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
      Không có quyền truy cập
    </div>
  }

  const totalImport = rows.reduce((s, r) => s + r.total_import, 0)
  const totalExport = rows.reduce((s, r) => s + r.total_export, 0)
  const totalNet    = rows.reduce((s, r) => s + r.net_change,   0)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Báo cáo theo SKU</h1>
          <p style={s.subtitle}>
            {rows.length} sản phẩm · chỉ tính phiếu <strong>hoàn tất</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={s.monthInput}
          />
          {rows.length > 0 && <>
            <button style={s.btnCSV} onClick={() => exportCSV(rows, month)}>⬇ CSV</button>
            <button style={s.btnPDF} onClick={() => exportPDF(rows, month)}>🖨 PDF</button>
          </>}
          <button style={s.btnBack} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div style={s.cards}>
          {[
            { label: 'Tổng SKU',       value: rows.length,  color: '#6b7280', fmt: false },
            { label: 'Tổng nhập',      value: totalImport,  color: '#2563eb', fmt: true  },
            { label: 'Tổng xuất',      value: totalExport,  color: '#d97706', fmt: true  },
            { label: 'Biến động ròng', value: totalNet,     color: totalNet >= 0 ? '#16a34a' : '#dc2626', fmt: true },
          ].map((c) => (
            <div key={c.label} style={s.card}>
              <div style={s.cardLabel}>{c.label}</div>
              <div style={{ ...s.cardValue, color: c.color }}>
                {c.fmt
                  ? (c.value >= 0 ? '' : '') + (c.value as number).toLocaleString('vi-VN')
                  : c.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}>Đang tải...</div>
        ) : error ? (
          <div style={{ ...s.center, color: '#dc2626' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={s.center}>Không có dữ liệu phiếu hoàn tất trong tháng này</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>SKU</th>
                <th style={s.th}>Tên sản phẩm</th>
                <th style={s.th}>ĐVT</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Nhập</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Xuất</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Chuyển</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Biến động ròng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.product_id} style={s.tr(idx % 2 === 1)}>
                  <td style={s.td}><span style={s.mono}>{r.sku}</span></td>
                  <td style={s.td}>{r.product_name}</td>
                  <td style={s.td}>{r.unit}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                    {r.total_import > 0 ? `+${r.total_import.toLocaleString('vi-VN')}` : '—'}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                    {r.total_export > 0 ? r.total_export.toLocaleString('vi-VN') : '—'}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>
                    {r.total_transfer > 0 ? r.total_transfer.toLocaleString('vi-VN') : '—'}
                  </td>
                  <td style={{
                    ...s.td, textAlign: 'right', fontWeight: 700,
                    color: r.net_change > 0 ? '#16a34a' : r.net_change < 0 ? '#dc2626' : '#6b7280',
                  }}>
                    {r.net_change > 0 ? `+${r.net_change.toLocaleString('vi-VN')}`
                     : r.net_change === 0 ? '±0'
                     : r.net_change.toLocaleString('vi-VN')}
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

const s = {
  page:       { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:     { padding: '2rem', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  title:      { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle:   { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  monthInput: { padding: '0.4rem 0.625rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', color: '#111827' } as React.CSSProperties,
  btnCSV:     { padding: '0.4rem 0.875rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' } as React.CSSProperties,
  btnPDF:     { padding: '0.4rem 0.875rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' } as React.CSSProperties,
  btnBack:    { padding: '0.4rem 0.875rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', color: '#374151' } as React.CSSProperties,
  cards:      { display: 'flex', gap: '1rem', padding: '1.5rem 2rem 0', flexWrap: 'wrap' as const },
  card:       { background: '#fff', borderRadius: '0.875rem', padding: '1rem 1.5rem', border: '1.5px solid #e5e7eb', flex: 1, minWidth: '140px' } as React.CSSProperties,
  cardLabel:  { fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.375rem' },
  cardValue:  { fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 } as React.CSSProperties,
  tableWrap:  { margin: '1.5rem 2rem', background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' } as React.CSSProperties,
  table:      { width: '100%', borderCollapse: 'collapse' as const },
  thead:      { background: '#f9fafb' },
  th:         { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  tr:         (odd: boolean): React.CSSProperties => ({ background: odd ? '#fafafa' : '#fff' }),
  td:         { padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  mono:       { fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#111827' } as React.CSSProperties,
  center:     { padding: '4rem', textAlign: 'center' as const, color: '#9ca3af' },
}