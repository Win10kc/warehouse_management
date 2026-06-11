import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import TransactionCreatePage from './pages/TransactionCreatePage'
import TransactionListPage from './pages/TransactionListPage'
import AlertBadge from './components/AlertBadge'
import { useAuthStore } from './store/authStore'
import DashboardPage from './pages/DashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import StockLocationsPage from './pages/StockLocationsPage'
import SKUReportPage from './pages/SKUReportPage'
import ProductRequestsPage from './pages/ProductRequestsPage'
import WarehouseManagerPage from './pages/WarehouseManagerPage'
import TransactionDetailPage from './pages/TransactionDetailPage'
import ProductsPage from './pages/ProductsPage'

function PrivateRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: string[]
}) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <Link
      to={to}
      style={{
        color: '#fff',
        textDecoration: 'none',
        padding: '0.3rem 0.625rem',
        borderRadius: '0.375rem',
        fontWeight: isActive ? 700 : 400,
        background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </Link>
  )
}

function NavBar() {
  const { token, role, logout } = useAuthStore()
  const location = useLocation()

  if (!token) return null

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  void location

  return (
    <nav style={{
      background: '#1e3a5f',
      color: '#fff',
      padding: '0 1.5rem',
      height: '2.75rem',
      display: 'flex',
      gap: '0.25rem',
      alignItems: 'center',
      fontSize: '0.875rem',
    }}>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/transactions">Kho phiếu</NavLink>
      <NavLink to="/stock/locations">Vị trí tồn kho</NavLink>
      <NavLink to="/products">📦 Sản phẩm</NavLink>

      {(role === 'admin' || role === 'manager') && (
  <>
    <NavLink to="/transactions/create">➕ Tạo phiếu</NavLink>
    <NavLink to="/reports/sku">Báo cáo SKU</NavLink>
  </>
)}

      {role === 'admin' && (
        <>
          <NavLink to="/admin/users">👥 Tài khoản</NavLink>
          <NavLink to="/admin/product-requests">📋 SP mới</NavLink>
          <NavLink to="/admin/warehouse">🏭 Cấu trúc kho</NavLink>
        </>
      )}

      <span style={{ flex: 1 }} />

      <button
        onClick={handleLogout}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.4)',
          color: '#fff',
          borderRadius: '0.375rem',
          padding: '0.25rem 0.75rem',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontFamily: 'inherit',
        }}
      >
        Đăng xuất
      </button>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AlertBadge />
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/dashboard" element={
          <PrivateRoute><DashboardPage /></PrivateRoute>
        } />
        <Route path="/transactions" element={
          <PrivateRoute><TransactionListPage /></PrivateRoute>
        } />
        <Route path="/transactions/create" element={
          <PrivateRoute><TransactionCreatePage /></PrivateRoute>
        } />
        <Route path="/transactions/:id" element={
          <PrivateRoute><TransactionDetailPage /></PrivateRoute>
        } />
        <Route path="/stock/locations" element={
          <PrivateRoute><StockLocationsPage /></PrivateRoute>
        } />
        <Route path="/products" element={
          <PrivateRoute><ProductsPage /></PrivateRoute>
        } />
        <Route path="/reports/sku" element={
          <PrivateRoute roles={['admin', 'manager']}><SKUReportPage /></PrivateRoute>
        } />
        <Route path="/admin/users" element={
          <PrivateRoute roles={['admin']}><AdminUsersPage /></PrivateRoute>
        } />
        <Route path="/admin/product-requests" element={
          <PrivateRoute roles={['admin']}><ProductRequestsPage /></PrivateRoute>
        } />
        <Route path="/admin/warehouse" element={
          <PrivateRoute roles={['admin']}><WarehouseManagerPage /></PrivateRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}