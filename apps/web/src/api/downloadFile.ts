import axios from 'axios'
import { API_URL } from './axiosClient'
import { getAccessToken } from './tokenStore'

/**
 * Binary file download helper, deliberately not routed through `axiosClient` -- that instance
 * unwraps the `{success,data}` JSON envelope and handles 401-refresh-retry, neither of which
 * applies to a `responseType: 'blob'` response. A failed download (e.g. expired token) surfaces
 * as a thrown error for the caller to toast; it does not attempt a token refresh.
 */
export async function downloadFile(path: string, params: Record<string, unknown>): Promise<void> {
  const response = await axios.get(`${API_URL}${path}`, {
    params,
    responseType: 'blob',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
  })

  const filename = parseFilename(response.headers['content-disposition'] as string | undefined) ?? 'export'
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function parseFilename(disposition?: string): string | null {
  if (!disposition) {
    return null
  }
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return match ? match[1] : null
}
