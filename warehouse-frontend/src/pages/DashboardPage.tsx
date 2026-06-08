import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { dashboardApi, type Transaction } from '../api/transactionApi'
import { useAuthStore } from '../store/authStore'
import ExportPanel from '../components/ExportPanel'

// ─── Màu sắc ──────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#2563EB',
  done: '#16A34A',
  rejected: '#DC2626',
  draft: '#9CA3AF',
}
const TYPE_COLOR: Record<string, string> = {
  import: '#2563EB',
  export: '#F59E0B',
  transfer: '#8B5CF6',
}

// ─── Filter range helpers ──────────────────────────────────────
type FilterKey = 'week' | 'month' | 'prev_month' | 'custom'

function getFilterRange(key: FilterKey, customFrom?: string, customTo?: string): { from: Date; to: Date; label: string } {
  const now = new Date()
  if (key === 'week') {
    const from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0)
    return { from, to: now, label: '7 ngày gần nhất' }
  }
  if (key === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from, to: now, label: 'Tháng này' }
  }
  if (key === 'prev_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from, to, label: 'Tháng trước' }
  }
  // custom
  const from = customFrom ? new Date(customFrom) : new Date(now.setDate(now.getDate() - 6))
  const to = customTo ? new Date(customTo) : new Date()
  return { from, to, label: `${customFrom} – ${customTo}` }
}

function filterByRange(items: Transaction[], from: Date, to: Date): Transaction[] {
  return items.filter((t) => {
    const d = new Date(t.created_at)
    return d >= from && d <= to
  })
}

// ─── Build trend chart data ────────────────────────────────────
function buildTrendData(items: Transaction[], from: Date, to: Date) {
  const days: { date: string; label: string }[] = []
  const diffMs = to.getTime() - from.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 14) {
    // Ngày
    for (let i = 0; i <= diffDays; i++) {
      const d = new Date(from); d.setDate(from.getDate() + i)
      days.push({ date: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}` })
    }
    return days.map(({ date, label }) => {
      const dayItems = items.filter((t) => t.created_at.slice(0, 10) === date)
      return {
        label,
        'Nhập kho': dayItems.filter((t) => t.type === 'import').length,
        'Xuất kho': dayItems.filter((t) => t.type === 'export').length,
        'Chuyển vị trí': dayItems.filter((t) => t.type === 'transfer').length,
      }
    })
  } else {
    // Tuần
    const weeks: { start: Date; label: string }[] = []
    const cur = new Date(from)
    let weekNum = 1
    while (cur <= to) {
      weeks.push({ start: new Date(cur), label: `T${weekNum++}` })
      cur.setDate(cur.getDate() + 7)
    }
    return weeks.map(({ start, label }) => {
      const end = new Date(start); end.setDate(start.getDate() + 6)
      const wItems = items.filter((t) => {
        const d = new Date(t.created_at)
        return d >= start && d <= end
      })
      return {
        label,
        'Nhập kho': wItems.filter((t) => t.type === 'import').length,
        'Xuất kho': wItems.filter((t) => t.type === 'export').length,
        'Chuyển vị trí': wItems.filter((t) => t.type === 'transfer').length,
      }
    })
  }
}

// ─── Top products helper ───────────────────────────────────────
interface TopProduct { name: string; sku: string; qty: number }

function buildTopProducts(items: Transaction[], txType: 'import' | 'export'): TopProduct[] {
  const map = new Map<string, TopProduct>()
  items
    .filter((t) => t.type === txType && t.status === 'done')
    .forEach((t) => {
      ;(t.items ?? []).forEach((item) => {
        const key = item.product_id
        const qty = item.quantity_actual ?? item.quantity_requested ?? 0
        if (map.has(key)) {
          map.get(key)!.qty += qty
        } else {
          map.set(key, {
            name: item.product?.name ?? 'Không tên',
            sku: item.product?.sku ?? '—',
            qty,
          })
        }
      })
    })
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
}

// ─── Sub-components ────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '1rem', padding: '1.25rem 1.5rem',
      border: '1.5px solid #e5e7eb', flex: 1, minWidth: '140px',
      borderTop: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  )
}

function FilterBar({
  active, onChange, customFrom, customTo, onCustomChange,
}: {
  active: FilterKey
  onChange: (k: FilterKey) => void
  customFrom: string
  customTo: string
  onCustomChange: (from: string, to: string) => void
}) {
  const opts: { key: FilterKey; label: string }[] = [
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'prev_month', label: 'Tháng trước' },
    { key: 'custom', label: 'Tùy chọn' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            padding: '0.3rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem',
            border: '1.5px solid', cursor: 'pointer',
            borderColor: active === o.key ? '#2563EB' : '#e5e7eb',
            background: active === o.key ? '#EFF6FF' : '#fff',
            color: active === o.key ? '#2563EB' : '#6B7280',
            fontWeight: active === o.key ? 700 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
      {active === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
            style={{ padding: '0.25rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8rem' }}
          />
          <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
            style={{ padding: '0.25rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8rem' }}
          />
        </div>
      )}
    </div>
  )
}

function TopProductsCard({ items }: { items: Transaction[] }) {
  const [tab, setTab] = useState<'import' | 'export'>('import')
  const tops = useMemo(() => buildTopProducts(items, tab), [items, tab])

  const medals = ['🥇', '🥈', '🥉', '4.', '5.']

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={cardTitle}>Top sản phẩm</h3>
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
          {(['import', 'export'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer',
                border: 'none', borderRight: t === 'import' ? '1px solid #e5e7eb' : 'none',
                background: tab === t ? '#EFF6FF' : '#fff',
                color: tab === t ? '#2563EB' : '#6B7280',
                fontWeight: tab === t ? 700 : 400,
              }}
            >
              {t === 'import' ? '📥 Nhập nhiều nhất' : '📤 Xuất nhiều nhất'}
            </button>
          ))}
        </div>
      </div>
      {tops.length === 0 ? (
        <div style={empty}>Chưa có dữ liệu phiếu hoàn tất</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['#', 'Sản phẩm', 'SKU', 'Tổng SL'].map((h) => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left',
                  fontSize: '0.72rem', fontWeight: 700, color: '#6B7280',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tops.map((p, i) => (
              <tr key={p.sku} style={{ background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                <td style={{ ...td, fontSize: '1rem', width: '2rem' }}>{medals[i]}</td>
                <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{p.name}</td>
                <td style={{ ...td, fontFamily: 'monospace', color: '#6B7280' }}>{p.sku}</td>
                <td style={{ ...td, fontWeight: 700, color: '#2563EB' }}>{p.qty.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function DashboardPage() {
  const [all, setAll] = useState<Transaction[]>([])
  const [done, setDone] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter state
  const [filterKey, setFilterKey] = useState<FilterKey>('week')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10))

  const role = useAuthStore((s) => s.role)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [allRes, doneRes] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getRecentDone(),
      ])
      setAll(allRes.items ?? [])
      setDone(doneRes.items ?? [])
    } catch {
      setError('Không thể tải dữ liệu dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filtered data ─────────────────────────────────────────
  const { from, to, label: rangeLabel } = getFilterRange(filterKey, customFrom, customTo)
  const filtered = useMemo(() => filterByRange(all, from, to), [all, from, to])

  const total = filtered.length
  const pending = filtered.filter((t) => t.status === 'pending').length
  const processing = filtered.filter((t) => t.status === 'processing').length
  const totalDone = filtered.filter((t) => t.status === 'done').length
  const rejected = filtered.filter((t) => t.status === 'rejected').length

  const pieStatus = [
    { name: 'Chờ duyệt', value: pending, color: STATUS_COLOR.pending },
    { name: 'Đang xử lý', value: processing, color: STATUS_COLOR.processing },
    { name: 'Hoàn tất', value: totalDone, color: STATUS_COLOR.done },
    { name: 'Từ chối', value: rejected, color: STATUS_COLOR.rejected },
  ].filter((d) => d.value > 0)

  const pieType = [
    { name: 'Nhập kho', value: filtered.filter((t) => t.type === 'import').length, color: TYPE_COLOR.import },
    { name: 'Xuất kho', value: filtered.filter((t) => t.type === 'export').length, color: TYPE_COLOR.export },
    { name: 'Chuyển vị trí', value: filtered.filter((t) => t.type === 'transfer').length, color: TYPE_COLOR.transfer },
  ].filter((d) => d.value > 0)

  const trendData = useMemo(() => buildTrendData(filtered, from, to), [filtered, from, to])

  const recentDone = useMemo(() => [...done]
    .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime())
    .slice(0, 5), [done])

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6B7280' }}>Tổng quan hoạt động kho</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterBar
            active={filterKey}
            onChange={setFilterKey}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t) }}
          />
          <ExportPanel
            items={all}
            filenamePrefix="dashboard_tong_hop"
            pdfTitle="Báo cáo tổng hợp kho tháng"
            allowedRoles={['admin', 'manager']}
            currentRole={role}
          />
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.75rem 1rem',
            borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6B7280' }}>Đang tải...</div>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <StatCard label="Tổng phiếu" value={total} color="#6B7280" sub={rangeLabel} />
              <StatCard label="Chờ duyệt" value={pending} color={STATUS_COLOR.pending} sub="cần xử lý" />
              <StatCard label="Đang xử lý" value={processing} color={STATUS_COLOR.processing} />
              <StatCard label="Hoàn tất" value={totalDone} color={STATUS_COLOR.done} />
              <StatCard label="Từ chối" value={rejected} color={STATUS_COLOR.rejected} />
            </div>

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={card}>
                <h3 style={cardTitle}>
                  Phiếu theo ngày
                  <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    ({rangeLabel})
                  </span>
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="Nhập kho" fill={TYPE_COLOR.import} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Xuất kho" fill={TYPE_COLOR.export} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Chuyển vị trí" fill={TYPE_COLOR.transfer} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <h3 style={cardTitle}>Phân loại phiếu</h3>
                {pieType.length === 0 ? (
                  <div style={empty}>Chưa có dữ liệu</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieType} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={80}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {pieType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Charts row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={card}>
                <h3 style={cardTitle}>Trạng thái phiếu</h3>
                {pieStatus.length === 0 ? (
                  <div style={empty}>Chưa có dữ liệu</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieStatus} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                        {pieStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={card}>
                <h3 style={cardTitle}>Phiếu hoàn tất gần đây</h3>
                {recentDone.length === 0 ? (
                  <div style={empty}>Chưa có phiếu hoàn tất</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        {['Mã phiếu', 'Loại', 'SP', 'Hoàn tất lúc'].map((h) => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left',
                            fontSize: '0.75rem', fontWeight: 700, color: '#6B7280',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentDone.map((tx, i) => (
                        <tr key={tx.id} style={{ background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                          <td style={td}><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tx.code}</span></td>
                          <td style={td}>
                            {{ import: '📥 Nhập', export: '📤 Xuất', transfer: '🔄 Chuyển' }[tx.type] ?? tx.type}
                          </td>
                          <td style={td}>{tx.items?.length ?? 0} SP</td>
                          <td style={td}>
                            {new Date(tx.completed_at ?? tx.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Top products — full width */}
            <TopProductsCard items={filtered} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: '1rem', padding: '1.25rem 1.5rem',
  border: '1.5px solid #e5e7eb',
}
const cardTitle: React.CSSProperties = {
  margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827',
}
const empty: React.CSSProperties = {
  textAlign: 'center', padding: '3rem', color: '#9CA3AF', fontSize: '0.875rem',
}
const td: React.CSSProperties = {
  padding: '0.625rem 0.75rem', color: '#374151', borderBottom: '1px solid #F3F4F6',
}