import { useState } from 'react'
import type { Transaction } from '../api/transactionApi'
import {
  exportCSV, exportPDF, filterByMonth, makeFilename, fmtMonth,
} from '../utils/exportUtils'

interface Props {
  items: Transaction[]       // toàn bộ data đã load
  filenamePrefix: string     // vd: 'phieu_kho' | 'dashboard'
  pdfTitle: string           // vd: 'Báo cáo kho tháng ...'
  allowedRoles: string[]     // ['admin','manager'] hoặc ['admin','manager','warehouse']
  currentRole: string
}

export default function ExportPanel({
  items, filenamePrefix, pdfTitle, allowedRoles, currentRole,
}: Props) {

  // Tháng mặc định = tháng hiện tại
  const now = new Date()
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  if (!allowedRoles.includes(currentRole)) return null

  const selectedMonth = new Date(month + '-01')
  const filtered      = filterByMonth(items, selectedMonth)
  const monthLabel    = fmtMonth(selectedMonth)
  const filename      = makeFilename(filenamePrefix, selectedMonth)

  const handleCSV = () => {
    if (filtered.length === 0) { alert('Không có dữ liệu trong tháng này'); return }
    exportCSV(filtered, filename)
  }

  const handlePDF = () => {
    if (filtered.length === 0) { alert('Không có dữ liệu trong tháng này'); return }
    exportPDF(filtered, filename, `${pdfTitle} ${monthLabel}`, monthLabel)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.625rem',
      padding: '0.5rem 0.75rem', background: '#F0FDF4',
      border: '1.5px solid #BBF7D0', borderRadius: '0.625rem',
    }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#15803D' }}>
        📊 Xuất tháng:
      </span>
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        style={{
          padding: '0.3rem 0.5rem', border: '1.5px solid #D1D5DB',
          borderRadius: '0.375rem', fontSize: '0.8rem',
          fontFamily: 'inherit', background: '#fff',
        }}
      />
      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
        ({filtered.length} phiếu)
      </span>
      <button onClick={handleCSV} style={btnStyle('#16A34A')}>
        ⬇ CSV
      </button>
      <button onClick={handlePDF} style={btnStyle('#2563EB')}>
        🖨 PDF
      </button>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '0.3rem 0.75rem', background: bg, color: '#fff',
    border: 'none', borderRadius: '0.375rem', fontSize: '0.8rem',
    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  }
}