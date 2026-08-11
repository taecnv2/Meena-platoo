import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, setAccessToken } from './tokenStore'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api'

export const axiosClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

interface Envelope {
  success: true
  data: unknown
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'success' in value && 'data' in value
}

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<Envelope>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
  const data = response.data.data as { accessToken: string }
  setAccessToken(data.accessToken)
  return data.accessToken
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

axiosClient.interceptors.response.use(
  (response) => {
    if (isEnvelope(response.data)) {
      response.data = response.data.data
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined
    const isAuthRoute = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const token = await refreshPromise
        originalRequest.headers.set('Authorization', `Bearer ${token}`)
        return await axiosClient(originalRequest)
      } catch (refreshError) {
        setAccessToken(null)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError as Error)
      }
    }
    return Promise.reject(error)
  },
)
