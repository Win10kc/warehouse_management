import type { Transaction } from '../api/transactionApi'

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMonth(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

const TYPE_LABEL: Record<string, string> = {
  import: 'Nhập kho', export: 'Xuất kho', transfer: 'Chuyển vị trí',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', processing: 'Đang xử lý',
  done: 'Hoàn tất', rejected: 'Từ chối', draft: 'Nháp',
}

// ─── Filter theo tháng ────────────────────────────────────────

export function filterByMonth(items: Transaction[], month: Date): Transaction[] {
  const y = month.getFullYear()
  const m = month.getMonth()
  return items.filter((t) => {
    const d = new Date(t.created_at)
    return d.getFullYear() === y && d.getMonth() === m
  })
}

// ─── Export CSV ───────────────────────────────────────────────

export function exportCSV(items: Transaction[], filename: string) {
  const headers = [
  'Mã phiếu', 'Loại', 'Trạng thái', 'Số sản phẩm',
  'Tổng SL yêu cầu', 'Tổng SL thực tế', 'Ghi chú',
  'Người tạo', 'Người duyệt',   
  'Ngày tạo', 'Hoàn tất lúc',
]

  const rows = items.map((t) => {
    const totalReq = t.items?.reduce((s, i) => s + i.quantity_requested, 0) ?? 0
    const totalAct = t.items?.reduce((s, i) => s + i.quantity_actual,   0) ?? 0
    return [
        t.code,
        TYPE_LABEL[t.type]     ?? t.type,
        STATUS_LABEL[t.status] ?? t.status,
        t.items?.length ?? 0,
        totalReq,
        totalAct,
        `"${(t.note ?? '').replace(/"/g, '""')}"`,
        t.created_by  ? `${t.created_by.full_name} (@${t.created_by.username})`   : '',   // ← THÊM
        t.approved_by ? `${t.approved_by.full_name} (@${t.approved_by.username})` : '',   // ← THÊM
        fmtDate(t.created_at),
        fmtDate(t.completed_at),
]
  })

  const csv = [headers, ...rows]
    .map((r) => r.join(','))
    .join('\n')

  // BOM UTF-8 để Excel đọc tiếng Việt đúng
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename + '.csv')
}

// ─── Export PDF ───────────────────────────────────────────────

export function exportPDF(
  items: Transaction[],
  filename: string,
  title: string,
  monthLabel: string,
) {
  const totalReq = items.reduce((s, t) =>
    s + (t.items?.reduce((ss, i) => ss + i.quantity_requested, 0) ?? 0), 0)
  const totalAct = items.reduce((s, t) =>
    s + (t.items?.reduce((ss, i) => ss + i.quantity_actual, 0) ?? 0), 0)
  const done      = items.filter((t) => t.status === 'done').length
  const rejected  = items.filter((t) => t.status === 'rejected').length

  const rows = items.map((t, i) => {
    const req = t.items?.reduce((s, ii) => s + ii.quantity_requested, 0) ?? 0
    const act = t.items?.reduce((s, ii) => s + ii.quantity_actual,   0) ?? 0
    const bg  = i % 2 === 1 ? '#F9FAFB' : '#fff'
    const statusColor: Record<string, string> = {
      done: '#16A34A', rejected: '#DC2626',
      pending: '#D97706', processing: '#2563EB',
    }
    const sc = statusColor[t.status] ?? '#6B7280'
    return `
  <tr style="background:${bg}">
    <td>${i + 1}</td>
    <td style="font-family:monospace;font-weight:700">${t.code}</td>
    <td>${TYPE_LABEL[t.type] ?? t.type}</td>
    <td><span style="color:${sc};font-weight:600">${STATUS_LABEL[t.status] ?? t.status}</span></td>
    <td style="text-align:center">${t.items?.length ?? 0}</td>
    <td style="text-align:right">${req}</td>
    <td style="text-align:right">${act}</td>
    <td>${t.created_by  ? `${t.created_by.full_name}<br/><span style="color:#9CA3AF;font-size:10px">@${t.created_by.username}</span>` : '—'}</td>
    <td>${t.approved_by ? `${t.approved_by.full_name}<br/><span style="color:#9CA3AF;font-size:10px">@${t.approved_by.username}</span>` : '—'}</td>
    <td>${fmtDate(t.created_at)}</td>
    <td>${fmtDate(t.completed_at)}</td>
  </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>${filename}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px }
  h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px }
  .sub { font-size: 12px; color: #6B7280; margin-bottom: 20px }
  .stats { display: flex; gap: 16px; margin-bottom: 20px }
  .stat { background: #F3F4F6; border-radius: 8px; padding: 10px 16px; flex: 1 }
  .stat-label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: .05em }
  .stat-value { font-size: 20px; font-weight: 800; margin-top: 2px }
  table { width: 100%; border-collapse: collapse; font-size: 11px }
  th { background: #1E40AF; color: #fff; padding: 7px 8px; text-align: left;
       font-size: 10px; text-transform: uppercase; letter-spacing: .04em }
  td { padding: 6px 8px; border-bottom: 1px solid #E5E7EB }
  .footer { margin-top: 20px; font-size: 10px; color: #9CA3AF; text-align: right }
  @media print { body { padding: 0 } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="sub">Tháng ${monthLabel} · Xuất lúc ${fmtDate(new Date().toISOString())} · Tổng ${items.length} phiếu</div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Tổng phiếu</div>
      <div class="stat-value">${items.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Hoàn tất</div>
      <div class="stat-value" style="color:#16A34A">${done}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Từ chối</div>
      <div class="stat-value" style="color:#DC2626">${rejected}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Tổng SL yêu cầu</div>
      <div class="stat-value">${totalReq}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Tổng SL thực tế</div>
      <div class="stat-value">${totalAct}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Mã phiếu</th><th>Loại</th><th>Trạng thái</th>
        <th>SP</th><th>SL yêu cầu</th><th>SL thực tế</th>
        <th>Người tạo</th><th>Người duyệt</th> 
        <th>Ngày tạo</th><th>Hoàn tất lúc</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Hệ thống Quản lý Kho · ${new Date().getFullYear()}</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Trình duyệt chặn popup — cho phép popup để xuất PDF'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Tạo tên file theo tháng ──────────────────────────────────

export function makeFilename(prefix: string, month: Date): string {
  const y = month.getFullYear()
  const m = String(month.getMonth() + 1).padStart(2, '0')
  return `${prefix}_thang${m}_${y}`
}

export { fmtMonth }