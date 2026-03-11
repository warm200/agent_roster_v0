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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message =
      error.response?.data?.error ??
      error.message ??
      'Unexpected API request failure'

    return Promise.reject(new Error(message))
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
