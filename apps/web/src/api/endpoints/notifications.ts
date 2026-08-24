import { axiosClient } from '../axiosClient'
import type { AppNotification } from '@/types/entities'

export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    axiosClient.get<AppNotification[]>('/notifications', { params: { unreadOnly } }).then((r) => r.data),
  unreadCount: () =>
    axiosClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) =>
    axiosClient.patch<AppNotification>(`/notifications/${id}/read`, {}).then((r) => r.data),
  markAllRead: () =>
    axiosClient.patch<{ success: true }>('/notifications/read-all', {}).then((r) => r.data),
}
