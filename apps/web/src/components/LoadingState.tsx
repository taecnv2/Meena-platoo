export function LoadingState({ label = 'กำลังโหลดข้อมูล...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}
