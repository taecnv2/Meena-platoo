import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { notificationsApi } from '@/api/endpoints/notifications'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
  })
  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(),
    enabled: isOpen,
  })

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
    ])

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id)
    await invalidate()
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    await invalidate()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative rounded-lg p-2 text-text-secondary hover:bg-slate-100"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="size-5" />
        {unreadCount && unreadCount.count > 0 ? (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-medium text-white">
            {unreadCount.count > 9 ? '9+' : unreadCount.count}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-text-primary">การแจ้งเตือน</span>
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => void handleMarkAllRead()}>
                อ่านทั้งหมด
              </button>
            </div>
            {(notifications ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">ไม่มีการแจ้งเตือน</p>
            ) : (
              <div className="divide-y divide-border">
                {(notifications ?? []).map((notification) => (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => void handleMarkRead(notification._id)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-slate-50',
                      !notification.isRead && 'bg-primary-light/40',
                    )}
                  >
                    <span className="text-sm font-medium text-text-primary">{notification.title}</span>
                    <span className="text-xs text-text-secondary">{notification.message}</span>
                    <span className="text-xs text-text-secondary">{formatDateTime(notification.createdAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
