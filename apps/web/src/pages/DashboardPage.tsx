import { useQuery } from '@tanstack/react-query'
import {
  Wallet,
  AlertTriangle,
  PackageX,
  ClipboardList,
  Clock,
  Trophy,
  CheckCircle2,
  ArrowLeftRight,
  ClipboardCheck,
} from 'lucide-react'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { StatCard } from '@/components/StatCard'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { LoadingState } from '@/components/LoadingState'
import { formatCurrency, formatNumber } from '@/utils/format'
import { STOCK_COUNT_STATUS_LABEL } from '@/constants/labels'
import type { StockCountStatus } from '@/types/entities'

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'owner'],
    queryFn: dashboardApi.ownerSummary,
  })

  if (isLoading || !data) {
    return <LoadingState />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">ภาพรวม</h1>
        <p className="text-sm text-text-secondary">สรุปข้อมูลสต๊อกและการดำเนินงานของร้าน Meena Platoo</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="มูลค่าสต๊อก" value={formatCurrency(data.inventory.stockValue)} icon={Wallet} />
        <StatCard
          label="ของใกล้หมด"
          value={`${formatNumber(data.inventory.lowStockCount)} รายการ`}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="ของหมดสต๊อก"
          value={`${formatNumber(data.inventory.outOfStockCount)} รายการ`}
          icon={PackageX}
          tone="danger"
        />
        <StatCard label="เบิกวันนี้" value={`${formatNumber(data.requisition.requestsToday)} ครั้ง`} icon={ClipboardList} />
        <StatCard
          label="รออนุมัติ"
          value={`${formatNumber(data.requisition.pendingRequests)} รายการ`}
          icon={Clock}
          tone="warning"
        />
        <StatCard label="เบิกเดือนนี้" value={`${formatNumber(data.requisition.requestsThisMonth)} ครั้ง`} icon={ClipboardList} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            <span className="font-medium text-text-primary">Zone ที่เบิกมากที่สุด (เดือนนี้)</span>
          </CardHeader>
          <CardBody>
            {data.requisition.topRequestingZone ? (
              <div className="flex items-center justify-between">
                <span className="text-text-primary">{data.requisition.topRequestingZone.zoneName}</span>
                <span className="font-semibold text-primary">{data.requisition.topRequestingZone.count} ครั้ง</span>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">ยังไม่มีข้อมูลการเบิกในเดือนนี้</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary" />
            <span className="font-medium text-text-primary">สถานะการตรวจนับสต๊อก</span>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {Object.entries(data.operations.stockCountStatus).length === 0 ? (
              <p className="text-sm text-text-secondary">ยังไม่มีรายการตรวจนับสต๊อก</p>
            ) : (
              (Object.entries(data.operations.stockCountStatus) as Array<[string, number]>).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{STOCK_COUNT_STATUS_LABEL[status as StockCountStatus] ?? status}</span>
                  <span className="font-medium text-text-primary">{count}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="รออนุมัติทั้งหมด" value={`${formatNumber(data.operations.pendingApprovals)} รายการ`} icon={CheckCircle2} />
        <StatCard label="การโอนที่รอดำเนินการ" value={`${formatNumber(data.operations.pendingTransfers)} รายการ`} icon={ArrowLeftRight} />
      </div>
    </div>
  )
}
