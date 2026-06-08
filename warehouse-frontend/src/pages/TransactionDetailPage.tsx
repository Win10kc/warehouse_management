import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { transactionApi, type Transaction, type TransactionItem } from '../api/transactionApi'
import { useAuthStore } from '../store/authStore'

// ─── Types & helpers ─────────────────────────────────────────

interface BinInfo {
  id:             string
  code:           string
  rack_code:      string
  zone_code:      string
  zone_name:      string
  warehouse_name: string
}

interface BinOption {
  id:   string
  code: string
  rack_code?:      string
  zone_name?:      string
  warehouse_name?: string
}

function formatBinLocation(bin: BinInfo): string {
  const parts: string[] = []
  if (bin.warehouse_name) parts.push(bin.warehouse_name)
  if (bin.zone_name)      parts.push(bin.zone_name)
  if (bin.rack_code)      parts.push(bin.rack_code)
  parts.push(bin.code)
  return parts.join(' › ')
}

function formatBinOption(bin: BinOption): string {
  const parts: string[] = []
  if (bin.warehouse_name) parts.push(bin.warehouse_name)
  if (bin.zone_name)      parts.push(bin.zone_name)
  if (bin.rack_code)      parts.push(bin.rack_code)
  parts.push(bin.code)
  return parts.join(' › ')
}

// ─── Constants ───────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fef3c7', color: '#92400e', label: 'Chờ duyệt' },
  processing: { bg: '#dbeafe', color: '#1e40af', label: 'Đang thực hiện' },
  done:       { bg: '#dcfce7', color: '#166534', label: 'Hoàn tất' },
  rejected:   { bg: '#fee2e2', color: '#991b1b', label: 'Từ chối' },
  draft:      { bg: '#f3f4f6', color: '#374151', label: 'Nháp' },
}

const TYPE_LABEL: Record<string, string> = {
  import: '📥 Nhập kho', export: '📤 Xuất kho', transfer: '🔄 Chuyển vị trí',
}

// ─── SuggestBinModal ──────────────────────────────────────────

function SuggestBinModal({
  item,
  txId,
  onDone,
  onClose,
}: {
  item: TransactionItem
  txId: string
  onDone: () => void
  onClose: () => void
}) {
  const [bins,    setBins]    = useState<BinOption[]>([])
  const [binId,   setBinId]   = useState(item.suggested_bin_id ?? '')
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error,   setError]   = useState('')

  // Load danh sách bin từ API stock/locations (đã có sẵn, trả về bin list)
  useEffect(() => {
    setFetching(true)
    // Dùng endpoint stock locations để lấy danh sách bin (đã có trong hệ thống)
    // Fallback: gọi trực tiếp warehouses API
    fetch('/api/v1/stock/locations', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then((r) => r.json())
      .then((data) => {
        // Deduplicate bin_id từ stock locations
        const seen = new Set<string>()
        const list: BinOption[] = []
        for (const row of data?.data ?? []) {
          if (row.bin_id && !seen.has(row.bin_id)) {
            seen.add(row.bin_id)
            list.push({
              id:             row.bin_id,
              code:           row.bin_code ?? row.bin_id,
              rack_code:      row.rack_code,
              zone_name:      row.zone_name,
              warehouse_name: row.warehouse_name,
            })
          }
        }
        setBins(list)
      })
      .catch(() => setError('Không thể tải danh sách bin'))
      .finally(() => setFetching(false))
  }, [])

  const filtered = bins.filter((b) =>
    formatBinOption(b).toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async () => {
    if (!binId) { setError('Vui lòng chọn một bin'); return }
    setError('')
    setLoading(true)
    try {
      await transactionApi.suggestBin(txId, item.id, binId)
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const productName = item.product?.name ?? `SP #${item.product_id.slice(0, 6).toUpperCase()}`

  return (
    <div style={modal.overlay}>
      <div style={modal.card}>
        {/* Header */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={modal.title}>📦 Đề xuất bin mới</h3>
          <p style={modal.sub}>
            Sản phẩm: <strong>{productName}</strong>
          </p>
          {item.suggested_bin && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
              Đang đề xuất: <span style={{ color: '#1e40af', fontWeight: 600 }}>
                {formatBinLocation(item.suggested_bin as unknown as BinInfo)}
              </span>
            </p>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Tìm bin (kho, khu, rack, code)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={modal.searchInput}
        />

        {/* Bin list */}
        <div style={modal.listBox}>
          {fetching ? (
            <p style={modal.hint}>Đang tải danh sách bin...</p>
          ) : filtered.length === 0 ? (
            <p style={modal.hint}>Không tìm thấy bin nào</p>
          ) : (
            filtered.map((b) => (
              <label key={b.id} style={modal.binRow(binId === b.id)}>
                <input
                  type="radio"
                  name="bin"
                  value={b.id}
                  checked={binId === b.id}
                  onChange={() => setBinId(b.id)}
                  style={{ accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.83rem', color: binId === b.id ? '#1e3a5f' : '#374151', fontWeight: binId === b.id ? 700 : 400 }}>
                  {formatBinOption(b)}
                </span>
              </label>
            ))
          )}
        </div>

        {error && (
          <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0' }}>⚠️ {error}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button style={modal.btnCancel} onClick={onClose} disabled={loading}>
            Huỷ
          </button>
          <button
            style={modal.btnConfirm(loading || !binId)}
            onClick={handleSave}
            disabled={loading || !binId}
          >
            {loading ? 'Đang lưu...' : '✓ Xác nhận đề xuất'}
          </button>
        </div>
      </div>
    </div>
  )
}

const modal = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: '1rem',
    padding: '1.75rem', maxWidth: '26rem', width: '100%', margin: '1rem',
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex',
    flexDirection: 'column' as const,
  },
  title:  { margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 800 } as React.CSSProperties,
  sub:    { margin: 0, fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  hint:   { color: '#9ca3af', fontSize: '0.83rem', textAlign: 'center' as const, padding: '1rem 0' },
  searchInput: {
    width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box' as const, marginBottom: '0.5rem',
  },
  listBox: {
    border: '1.5px solid #e5e7eb', borderRadius: '0.625rem',
    maxHeight: '14rem', overflowY: 'auto' as const,
    display: 'flex', flexDirection: 'column' as const,
  },
  binRow: (selected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.5rem 0.75rem', cursor: 'pointer',
    background: selected ? '#eff6ff' : 'transparent',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.1s',
  }),
  btnCancel: {
    flex: 1, padding: '0.6rem', background: '#fff', border: '1.5px solid #d1d5db',
    borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    color: '#000',
  } as React.CSSProperties,
  btnConfirm: (disabled: boolean): React.CSSProperties => ({
    flex: 2, padding: '0.6rem',
    background: disabled ? '#93c5fd' : '#2563eb',
    color: '#fff', border: 'none', borderRadius: '0.625rem',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }),
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
                {/* Hiện suggested_bin nếu có — staff xem được */}
                {item.suggested_bin && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                    📍 Bin đề xuất: {formatBinLocation(item.suggested_bin as unknown as BinInfo)}
                  </p>
                )}
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
          <button style={modalStyles.btnCancel} onClick={onClose} disabled={loading}>
            Huỷ
          </button>
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
  title: { margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 800 } as React.CSSProperties,
  sub:   { margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
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
    borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    color: '#000',
  } as React.CSSProperties,
  btnConfirm: (disabled: boolean): React.CSSProperties => ({
    flex: 2, padding: '0.625rem', background: disabled ? '#93c5fd' : '#2563eb',
    color: '#fff', border: 'none', borderRadius: '0.625rem',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }),
}

// ─── Main Page ────────────────────────────────────────────────

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)

  const [tx,      setTx]      = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [showComplete,    setShowComplete]    = useState(false)
  const [suggestingItem,  setSuggestingItem]  = useState<TransactionItem | null>(null)
  const [actionLoading,   setActionLoading]   = useState(false)
  const [applyingItemId, setApplyingItemId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await transactionApi.getById(id)
      setTx(data)
    } catch {
      setError('Không tìm thấy phiếu hoặc đã có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleApprove = async () => {
    if (!tx) return
    setActionLoading(true)
    try {
      await transactionApi.approve(tx.id)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'Không thể duyệt phiếu')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!tx) return
    if (!window.confirm('Xác nhận từ chối phiếu này?')) return
    setActionLoading(true)
    try {
      await transactionApi.reject(tx.id)
      await load()
    } catch {
      alert('Không thể từ chối phiếu')
    } finally {
      setActionLoading(false)
    }
  }
  const handleApplyBin = async (item: TransactionItem) => {
    if (!tx) return
    setApplyingItemId(item.id)
    try {
      await transactionApi.applyBin(tx.id, item.id)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(msg ?? 'Không thể áp dụng bin')
    } finally {
      setApplyingItemId(null)
    }
  }

  const isManagerOrAdmin = role === 'admin' || role === 'manager'
  const canApproveReject = isManagerOrAdmin && tx?.status === 'pending'
  const canComplete      = isManagerOrAdmin && tx?.status === 'processing'
  const canSuggestBin =
  isManagerOrAdmin &&
  tx?.status === 'pending'

  // ─── Loading / Error ─────────────────────────────────────

  if (loading) {
    return <div style={s.page}><div style={s.centerMsg}>Đang tải phiếu...</div></div>
  }

  if (error || !tx) {
    return (
      <div style={s.page}>
        <div style={s.centerMsg}>
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>⚠️ {error || 'Không có dữ liệu'}</p>
          <button style={s.btnBack} onClick={() => navigate('/transactions')}>
            ← Quay lại danh sách
          </button>
        </div>
      </div>
    )
  }

  const st = STATUS_STYLE[tx.status] ?? STATUS_STYLE.draft

  // ─── Render ───────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <button style={s.btnBack} onClick={() => navigate('/transactions')}>
              ← Quay lại
            </button>
            <h1 style={s.title}>
              <span style={s.codeText}>{tx.code}</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={s.typeChip}>{TYPE_LABEL[tx.type] ?? tx.type}</span>
              <span style={s.badge(st.bg, st.color)}>{st.label}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {canApproveReject && (
              <>
                <button style={s.btnReject} onClick={handleReject} disabled={actionLoading}>
                  Từ chối
                </button>
                <button style={s.btnApprove(actionLoading)} onClick={handleApprove} disabled={actionLoading}>
                  {actionLoading ? 'Đang xử lý...' : '✓ Duyệt phiếu'}
                </button>
              </>
            )}
            {canComplete && (
              <button style={s.btnComplete} onClick={() => setShowComplete(true)} disabled={actionLoading}>
                ✓ Hoàn tất phiếu
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* Left column */}
        <div style={s.colMain}>

          {/* Thông tin chung */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Thông tin phiếu</h2>
            <div style={s.infoGrid}>
              <InfoRow label="Mã phiếu"    value={<span style={s.codeText}>{tx.code}</span>} />
              <InfoRow label="Loại"         value={TYPE_LABEL[tx.type] ?? tx.type} />
              <InfoRow label="Trạng thái"   value={<span style={s.badge(st.bg, st.color)}>{st.label}</span>} />
              <InfoRow label="Ngày tạo"     value={formatDate(tx.created_at)} />
              {tx.approved_at  && <InfoRow label="Ngày duyệt"    value={formatDate(tx.approved_at)} />}
              {tx.completed_at && <InfoRow label="Ngày hoàn tất" value={formatDate(tx.completed_at)} />}
              {tx.note && <InfoRow label="Ghi chú" value={tx.note} />}
            </div>
          </div>

          {/* Danh sách sản phẩm */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ ...s.cardTitle, margin: 0 }}>Sản phẩm ({tx.items.length})</h2>
              {canSuggestBin && (
                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic' }}>
                  Nếu bin đề xuất không đủ hàng, bấm "Đổi bin" để chọn vị trí khác
                </span>
              )}
            </div>

            {tx.items.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Không có sản phẩm.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tx.items.map((item, idx) => (
                  <div key={item.id} style={s.itemCard}>
                    <div style={s.itemIndex}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <p style={s.itemName}>{item.product?.name ?? '—'}</p>
                          <p style={s.itemSku}>SKU: {item.product?.sku ?? '—'}</p>
                        </div>
                        {/* Nút đổi bin — manager/admin, pending hoặc processing, hiện chỉ khi có suggested_bin*/}
                        {canSuggestBin && item.suggested_bin && (
                          <button
                            style={s.btnSuggestBin}
                              onClick={() => setSuggestingItem(item)}
                          >
                            📦 Đổi bin
                          </button>
                        )}
                      </div>

                      <div style={s.itemMeta}>
                        <MetaChip label="Yêu cầu" value={`${item.quantity_requested} ${item.product?.unit ?? ''}`} color="#3b82f6" />
                        {item.quantity_actual > 0 && (
                          <MetaChip label="Thực tế" value={`${item.quantity_actual} ${item.product?.unit ?? ''}`} color="#16a34a" />
                        )}
                        {item.from_bin && (
                          <MetaChip label="Xuất từ" value={formatBinLocation(item.from_bin)} color="#f59e0b" />
                        )}
                        {item.to_bin && (
                          <MetaChip label="Nhập vào" value={formatBinLocation(item.to_bin)} color="#8b5cf6" />
                        )}
                        {item.scan_method && (
                          <MetaChip label="Scan" value={item.scan_method} color="#6b7280" />
                        )}
                      </div>

                      {/* Suggested bin — hiện nổi bật nếu có */}
                      {item.suggested_bin && (
  <div style={s.suggestedBinBadge}>
    <span style={{ fontSize: '0.75rem' }}>📍</span>
    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e40af' }}>
      Bin đề xuất:
    </span>
    <span style={{ fontSize: '0.78rem', color: '#1e3a5f', fontFamily: 'monospace', fontWeight: 700 }}>
      {formatBinLocation(item.suggested_bin as unknown as BinInfo)}
    </span>
    {canSuggestBin && (
      <>
        {/* Áp dụng luôn bin đề xuất thành from_bin */}
        <button
          style={{
            ...s.btnChangeSuggestion,
            background: '#16a34a',
          }}
          onClick={() => handleApplyBin(item)}
          disabled={applyingItemId === item.id}
        >
          {applyingItemId === item.id ? '...' : '✓ Dùng bin này'}
        </button>
        {/* Chọn bin khác */}
        <button
          style={s.btnChangeSuggestion}
          onClick={() => setSuggestingItem(item)}
          disabled={applyingItemId === item.id}
        >
          Đổi
        </button>
      </>
    )}
  </div>
)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={s.colSide}>
          <div style={s.card}>
            <h2 style={s.cardTitle}>Người liên quan</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <PersonCard label="Người tạo" user={tx.created_by} />
              {tx.approved_by && <PersonCard label="Người duyệt" user={tx.approved_by} />}
            </div>
          </div>

          {/* Panel thống kê bin đề xuất nếu có */}
          {tx.items.some((i) => i.suggested_bin) && (
            <div style={{ ...s.card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <h2 style={{ ...s.cardTitle, color: '#1e40af' }}>📦 Bin đã đề xuất</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tx.items.filter((i) => i.suggested_bin).map((item) => (
                  <div key={item.id} style={{ fontSize: '0.8rem' }}>
                    <span style={{ color: '#6b7280' }}>{item.product?.name ?? '—'}: </span>
                    <span style={{ color: '#1e3a5f', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatBinLocation(item.suggested_bin as unknown as BinInfo)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Complete Modal */}
      {showComplete && (
        <CompleteModal
          tx={tx}
          onDone={() => { setShowComplete(false); load() }}
          onClose={() => setShowComplete(false)}
        />
      )}

      {/* Suggest Bin Modal */}
      {suggestingItem && (
        <SuggestBinModal
          item={suggestingItem}
          txId={tx.id}
          onDone={() => { setSuggestingItem(null); load() }}
          onClose={() => setSuggestingItem(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ minWidth: '7rem', fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.875rem', color: '#111827' }}>{value}</span>
    </div>
  )
}

function MetaChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.2rem 0.5rem', borderRadius: '0.375rem',
      background: color + '18', fontSize: '0.75rem',
    }}>
      <span style={{ color: '#9ca3af', fontWeight: 600 }}>{label}:</span>
      <span style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </span>
  )
}

function PersonCard({ label, user }: { label: string; user: { full_name: string; username: string; role: string } }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <div style={{
        width: '2.5rem', height: '2.5rem', borderRadius: '50%',
        background: '#1e3a5f', color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '1rem', flexShrink: 0,
      }}>
        {user.full_name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{user.full_name}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>@{user.username} · {user.role}</p>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Styles ───────────────────────────────────────────────────

const s = {
  page:     { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:   { padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', background: '#fff' } as React.CSSProperties,
  body:     { padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '1fr 18rem', gap: '1.25rem', alignItems: 'start' } as React.CSSProperties,
  colMain:  { display: 'flex', flexDirection: 'column', gap: '1.25rem' } as React.CSSProperties,
  colSide:  { display: 'flex', flexDirection: 'column', gap: '1.25rem' } as React.CSSProperties,

  card:      { background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', padding: '1.25rem 1.5rem' } as React.CSSProperties,
  cardTitle: { margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties,
  infoGrid:  { display: 'flex', flexDirection: 'column' as const },

  title:    { margin: '0.5rem 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  codeText: { fontFamily: 'monospace', fontWeight: 800, color: '#1e3a5f', fontSize: '1.1rem' } as React.CSSProperties,
  typeChip: { fontSize: '0.875rem', color: '#374151', fontWeight: 600 } as React.CSSProperties,

  badge: (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0.2rem 0.75rem', borderRadius: '999px',
    background: bg, color, fontSize: '0.75rem', fontWeight: 700,
  }),

  itemCard:  { display: 'flex', gap: '0.875rem', padding: '0.875rem 1rem', background: '#f9fafb', borderRadius: '0.625rem', border: '1px solid #e5e7eb' } as React.CSSProperties,
  itemIndex: { width: '1.5rem', height: '1.5rem', borderRadius: '50%', background: '#1e3a5f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0, marginTop: '0.125rem' } as React.CSSProperties,
  itemName:  { margin: '0 0 0.125rem', fontWeight: 700, fontSize: '0.9rem', color: '#111827' } as React.CSSProperties,
  itemSku:   { margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' } as React.CSSProperties,
  itemMeta:  { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' as const, marginTop: '0.25rem' },

  suggestedBinBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    marginTop: '0.5rem', padding: '0.3rem 0.625rem',
    background: '#dbeafe', borderRadius: '0.375rem', flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  btnSuggestBin: {
    padding: '0.25rem 0.625rem', background: '#fff', border: '1.5px solid #93c5fd',
    borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
    color: '#1e40af', fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  btnChangeSuggestion: {
    padding: '0.15rem 0.5rem', background: '#1e40af', border: 'none',
    borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
    color: '#fff', fontFamily: 'inherit',
  } as React.CSSProperties,

  btnBack:    { padding: '0.35rem 0.75rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', color: '#374151', marginBottom: '0.5rem' } as React.CSSProperties,
  btnApprove: (disabled: boolean): React.CSSProperties => ({ padding: '0.5rem 1.25rem', background: disabled ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }),
  btnReject:  { padding: '0.5rem 1.25rem', background: '#fff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnComplete:{ padding: '0.5rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,

  centerMsg: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: '40vh', fontSize: '0.9rem', color: '#6b7280' },
}
