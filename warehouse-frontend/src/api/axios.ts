import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

const api = axios.create({
  baseURL: base.endsWith('/api/v1') ? base : `${base}/api/v1`,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api