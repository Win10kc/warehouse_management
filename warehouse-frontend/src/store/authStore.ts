import { create } from 'zustand'

function parseJwtPayload(token: string): { role: string; exp: number } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { role: payload.role ?? '', exp: payload.exp ?? 0 }
  } catch {
    return null
  }
}

function loadToken(): { token: string | null; role: string } {
  const raw = localStorage.getItem('token')
  if (!raw) return { token: null, role: '' }

  const payload = parseJwtPayload(raw)
  if (!payload) {
    localStorage.removeItem('token')
    return { token: null, role: '' }
  }

  // Kiểm tra hết hạn (exp là unix seconds)
  if (payload.exp > 0 && payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('token')
    return { token: null, role: '' }
  }

  return { token: raw, role: payload.role }
}

interface AuthState {
  token: string | null
  role:  string
  setToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => {
  const { token, role } = loadToken()
  return {
    token,
    role,
    setToken: (token) => {
      localStorage.setItem('token', token)
      const payload = parseJwtPayload(token)
      set({ token, role: payload?.role ?? '' })
    },
    logout: () => {
      localStorage.removeItem('token')
      set({ token: null, role: '' })
    },
  }
})