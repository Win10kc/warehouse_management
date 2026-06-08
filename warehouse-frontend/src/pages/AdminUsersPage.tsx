import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'

// ─── Types ────────────────────────────────────────────────────

interface User {
  id:         string
  username:   string
  full_name:  string
  role:       string
  is_active:  boolean
  created_at: string
}

const ROLE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  admin:     { label: 'Admin',    color: '#7c3aed', bg: '#ede9fe' },
  manager:   { label: 'Manager', color: '#0369a1', bg: '#e0f2fe' },
  warehouse: { label: 'Nhân viên', color: '#374151', bg: '#f3f4f6' },
}

const emptyForm = { username: '', password: '', full_name: '', role: 'warehouse' }

// ─── Page ─────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<User[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editUser,  setEditUser]  = useState<User | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const token = useAuthStore((s) => s.token)
  const currentUserId = token
    ? (() => { try { return JSON.parse(atob(token.split('.')[1])).user_id } catch { return '' } })()
    : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users', { params: { page: 1, limit: 50 } })
      const data = res.data.data
      setUsers(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditUser(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      if (editUser) {
        const payload: Record<string, string> = { full_name: form.full_name, role: form.role }
        if (form.password) payload.password = form.password
        await api.put(`/admin/users/${editUser.id}`, payload)
      } else {
        await api.post('/admin/users', form)
      }
      setShowModal(false)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Có lỗi xảy ra')
    } finally { setSaving(false) }
  }

  const handleToggle = async (u: User) => {
    const action = u.is_active ? 'disable' : 'enable'
    const confirm_msg = u.is_active
      ? `Vô hiệu hóa tài khoản "${u.username}"?`
      : `Kích hoạt lại tài khoản "${u.username}"?`
    if (!window.confirm(confirm_msg)) return
    try {
      await api.put(`/admin/users/${u.id}/${action}`)
      load()
    } catch { /* silent */ }
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Quản lý tài khoản</h1>
          <p style={s.subtitle}>{total} tài khoản trong hệ thống</p>
        </div>
        <button style={s.btnCreate} onClick={openCreate}>+ Tạo tài khoản</button>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}>Đang tải...</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Tên đăng nhập</th>
                <th style={s.th}>Họ tên</th>
                <th style={s.th}>Vai trò</th>
                <th style={s.th}>Trạng thái</th>
                <th style={s.th}>Ngày tạo</th>
                <th style={s.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => {
                const rl = ROLE_LABEL[u.role] ?? ROLE_LABEL.warehouse
                return (
                  <tr key={u.id} style={s.tr(idx % 2 === 1)}>
                    <td style={s.td}>
                      <span style={s.mono}>@{u.username}</span>
                    </td>
                    <td style={s.td}>{u.full_name}</td>
                    <td style={s.td}>
                      <span style={s.badge(rl.bg, rl.color)}>{rl.label}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(
                        u.is_active ? '#dcfce7' : '#f3f4f6',
                        u.is_active ? '#166534' : '#9ca3af',
                      )}>
                        {u.is_active ? 'Hoạt động' : 'Đã tắt'}
                      </span>
                    </td>
                    <td style={s.td}>
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button style={s.btnEdit} onClick={() => openEdit(u)}>Sửa</button>
                        {u.id !== currentUserId && (
                          <button
                            style={u.is_active ? s.btnDisable : s.btnEnable}
                            onClick={() => handleToggle(u)}
                          >
                            {u.is_active ? 'Tắt' : 'Bật'}
                          </button>
                       )}
                    </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={ms.overlay}>
          <div style={ms.card}>
            <h3 style={ms.title}>
              {editUser ? `Sửa tài khoản @${editUser.username}` : 'Tạo tài khoản mới'}
            </h3>

            {!editUser && (
              <label style={ms.label}>
                Tên đăng nhập
                <input
                  style={ms.input}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="vd: staff2"
                />
              </label>
            )}

            <label style={ms.label}>
              Họ và tên
              <input
                style={ms.input}
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Nguyễn Văn A"
              />
            </label>

            <label style={ms.label}>
              Vai trò
              <select
                style={ms.input}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="warehouse">Nhân viên kho</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label style={ms.label}>
              {editUser ? 'Mật khẩu mới (để trống = không đổi)' : 'Mật khẩu'}
              <input
                style={ms.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editUser ? '••••••' : 'Tối thiểu 6 ký tự'}
              />
            </label>

            {error && <p style={ms.error}>⚠️ {error}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button style={ms.btnCancel} onClick={() => setShowModal(false)} disabled={saving}>
                Huỷ
              </button>
              <button style={ms.btnConfirm(saving)} onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : (editUser ? 'Lưu thay đổi' : 'Tạo tài khoản')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const s = {
  page:     { minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans','Segoe UI',sans-serif" } as React.CSSProperties,
  header:   { padding: '2rem', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  title:    { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  subtitle: { margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' } as React.CSSProperties,
  btnCreate:{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' } as React.CSSProperties,
  tableWrap:{ margin: '1.5rem 2rem', background: '#fff', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', overflow: 'hidden' } as React.CSSProperties,
  table:    { width: '100%', borderCollapse: 'collapse' as const },
  thead:    { background: '#f9fafb' },
  th:       { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  tr:       (odd: boolean): React.CSSProperties => ({ background: odd ? '#fafafa' : '#fff' }),
  td:       { padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  mono:     { fontFamily: 'monospace', fontWeight: 700, color: '#111827' } as React.CSSProperties,
  badge:    (bg: string, color: string): React.CSSProperties => ({ display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '999px', background: bg, color, fontSize: '0.75rem', fontWeight: 700 }),
  btnEdit:  { padding: '0.3rem 0.75rem', background: '#fff', color: '#2563eb', border: '1.5px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnDisable:{ padding: '0.3rem 0.75rem', background: '#fff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnEnable: { padding: '0.3rem 0.75rem', background: '#fff', color: '#16a34a', border: '1.5px solid #86efac', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  center:   { padding: '3rem', textAlign: 'center' as const, color: '#6b7280' },
}

const ms = {
  overlay:  { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  card:     { background: '#fff', borderRadius: '1rem', padding: '1.75rem', maxWidth: '26rem', width: '100%', margin: '1rem', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' as const, gap: '0.875rem' },
  title:    { margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' } as React.CSSProperties,
  label:    { display: 'flex', flexDirection: 'column' as const, gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  input:    { padding: '0.5rem 0.75rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', color: '#111827', background: '#fff' } as React.CSSProperties,
  error:    { color: '#dc2626', fontSize: '0.8rem', margin: 0 } as React.CSSProperties,
  btnCancel:{ flex: 1, padding: '0.625rem', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' } as React.CSSProperties,
  btnConfirm:(disabled: boolean): React.CSSProperties => ({ flex: 2, padding: '0.625rem', background: disabled ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }),
}