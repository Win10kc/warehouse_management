import { useStockStore } from '../store/stockStore'
import { useSocket, type AlertPayload } from '../hooks/useSocket'
import { useState } from 'react'

// Thông báo product_request hiển thị riêng — không lưu vào stockStore
type ProductRequestNotif = {
  id: string
  message: string
}

export default function AlertBadge() {
  const { alerts, addAlert, setQuantity, dismissAlert } = useStockStore()
  const [prNotifs, setPrNotifs] = useState<ProductRequestNotif[]>([])

  const handleAlert = (payload: AlertPayload) => {
    // Nếu có message và không có product_id thực → đây là product_request alert
    if (payload.message && !payload.product_id) {
      const notif: ProductRequestNotif = {
        id: Date.now().toString(),
        message: payload.message,
      }
      setPrNotifs((prev) => [...prev, notif])
      // Tự động dismiss sau 8 giây
      setTimeout(() => {
        setPrNotifs((prev) => prev.filter((n) => n.id !== notif.id))
      }, 8000)
    } else {
      // Stock alert bình thường
      addAlert(payload)
    }
  }

  useSocket({
    onStockUpdate: setQuantity,
    onAlert: handleAlert,
  })

  const hasAny = alerts.length > 0 || prNotifs.length > 0
  if (!hasAny) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        maxWidth: '22rem',
      }}
    >
      {/* Product request notifications — màu xanh dương */}
      {prNotifs.map((notif) => (
        <div
          key={notif.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            borderRadius: '0.75rem',
            background: '#1e3a5f',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            animation: 'slideIn 0.25s ease',
            color: '#fff',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>📋</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>
              Báo cáo sản phẩm mới
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
              {notif.message}
            </p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', opacity: 0.65 }}>
              Vào trang SP mới để xử lý
            </p>
          </div>
          <button
            onClick={() => setPrNotifs((prev) => prev.filter((n) => n.id !== notif.id))}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0, flexShrink: 0,
            }}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Stock alerts — màu vàng/đỏ như cũ */}
      {alerts.map((alert) => {
        const isCritical = alert.level === 'critical'
        return (
          <div
            key={alert.product_id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              background: isCritical ? '#991b1b' : '#92400e',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              animation: 'slideIn 0.25s ease',
              color: '#fff',
            }}
          >
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>
              {isCritical ? '🚨' : '⚠️'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontWeight: 700, fontSize: '0.875rem',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {alert.product_name || 'Cảnh báo tồn kho'}
              </p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                Tồn kho: <strong>{alert.current_quantity}</strong>
                {' '}/ Tối thiểu: {alert.min_stock}
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                {isCritical ? 'Cần nhập hàng khẩn cấp' : 'Sắp hết hàng'}
              </p>
            </div>
            <button
              onClick={() => dismissAlert(alert.product_id)}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0, flexShrink: 0,
              }}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        )
      })}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(1rem); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}