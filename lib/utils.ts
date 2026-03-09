import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Consistent date formatting to avoid hydration mismatches
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()
  return `${month}/${day}/${year}`
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const dateStr = formatDate(d)
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${dateStr}, ${hour12}:${minutes} ${ampm}`
}
