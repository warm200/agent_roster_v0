import axios, { AxiosError } from 'axios'

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

export async function getJson<T>(url: string) {
  const response = await api.get<T>(url)
  return response.data
}

export async function postJson<TResponse, TBody = unknown>(url: string, body?: TBody) {
  const response = await api.post<TResponse>(url, body)
  return response.data
}

export async function putJson<TResponse, TBody = unknown>(url: string, body?: TBody) {
  const response = await api.put<TResponse>(url, body)
  return response.data
}

export async function deleteJson<TResponse>(url: string) {
  const response = await api.delete<TResponse>(url)
  return response.data
}
