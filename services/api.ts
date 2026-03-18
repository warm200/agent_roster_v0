import axios, { AxiosError } from 'axios'
import type { AxiosRequestConfig } from 'axios'

const serverBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export const api = axios.create({
  baseURL: typeof window === 'undefined' ? serverBaseUrl : '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

function normalizeApiErrorMessage(
  error: AxiosError<{ detail?: unknown; error?: unknown; message?: unknown }>,
) {
  const payload = error.response?.data
  const candidates = [
    payload?.error,
    payload?.message,
    payload?.detail,
    error.message,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed.length > 0 && trimmed !== '[object Object]') {
        return trimmed
      }
    }

    if (candidate && typeof candidate === 'object') {
      const nested = candidate as { detail?: unknown; message?: unknown }
      for (const value of [nested.message, nested.detail]) {
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed.length > 0 && trimmed !== '[object Object]') {
            return trimmed
          }
        }
      }
    }
  }

  return 'Unexpected API request failure'
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: unknown; error?: unknown; message?: unknown }>) => {
    return Promise.reject(new Error(normalizeApiErrorMessage(error)))
  },
)

export async function getJson<T>(url: string, config?: AxiosRequestConfig) {
  const response = await api.get<T>(url, config)
  return response.data
}

export async function postJson<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  const response = await api.post<TResponse>(url, body, config)
  return response.data
}

export async function putJson<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  const response = await api.put<TResponse>(url, body, config)
  return response.data
}

export async function patchJson<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  const response = await api.patch<TResponse>(url, body, config)
  return response.data
}

export async function deleteJson<TResponse>(url: string, config?: AxiosRequestConfig) {
  const response = await api.delete<TResponse>(url, config)
  return response.data
}
