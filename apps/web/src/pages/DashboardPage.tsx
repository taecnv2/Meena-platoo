import { useState } from 'react'
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
  ShoppingCart,
  CalendarClock,
  Trash2,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardApi } from '@/api/endpoints/dashboard'
import { StatCard } from '@/components/StatCard'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { LoadingState } from '@/components/LoadingState'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { formatCurrency, formatNumber } from '@/utils/format'
import { getPresetRange, type DateRangeValue } from '@/utils/dateRange'
import { STOCK_COUNT_STATUS_LABEL } from '@/constants/labels'
import { STOCK_COUNT_STATUSES, type StockCountStatus } from '@/types/entities'

const STOCK_COUNT_STATUS_COLOR: Record<StockCountStatus, string> = {
  PENDING_APPROVAL: '#d97706',
  APPROVED: '#16a34a',
  CANCELLED: '#94a3b8',
}

export function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetRange('thisMonth'))

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'owner', dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      dashboardApi.ownerSummary({
        dateFrom: dateRange.dateFrom ?? undefined,
        dateTo: dateRange.dateTo ?? undefined,
      }),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-primary-light/40 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">ภาพรวม</h1>
          <p className="text-sm text-text-secondary">สรุปข้อมูลสต๊อกและการดำเนินงานของร้าน Meena Platoo</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} className="max-w-lg" />
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
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
            <StatCard
              label="คำขอเบิก (ช่วงที่เลือก)"
              value={`${formatNumber(data.requisition.requestsInRange)} ครั้ง`}
              icon={ClipboardList}
            />
            <StatCard
              label="รออนุมัติ"
              value={`${formatNumber(data.requisition.pendingRequests)} รายการ`}
              icon={Clock}
              tone="warning"
            />
            <StatCard label="คำขอเบิกวันนี้" value={`${formatNumber(data.requisition.today)} ครั้ง`} icon={CalendarClock} />
            <StatCard label="คำขอเบิกเดือนนี้" value={`${formatNumber(data.requisition.thisMonth)} ครั้ง`} icon={ClipboardList} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="ยอดจัดซื้อวันนี้" value={formatCurrency(data.purchasing.today)} icon={ShoppingCart} />
            <StatCard
              label="ยอดจัดซื้อเดือนนี้"
              value={formatCurrency(data.purchasing.thisMonth)}
              icon={ShoppingCart}
              trend={{ value: data.purchasing.changePercent, label: 'เทียบเดือนก่อน' }}
            />
            <StatCard label="ของเสียวันนี้" value={formatCurrency(data.waste.today)} icon={Trash2} tone="danger" />
            <StatCard
              label="ของเสียเดือนนี้"
              value={formatCurrency(data.waste.thisMonth)}
              icon={Trash2}
              tone="danger"
              trend={{ value: data.waste.changePercent, label: 'เทียบเดือนก่อน' }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <span className="font-medium text-text-primary">Zone ที่เบิกมากที่สุด (ช่วงที่เลือก)</span>
              </CardHeader>
              <CardBody>
                {data.requisition.topRequestingZone ? (
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary">{data.requisition.topRequestingZone.zoneName}</span>
                    <span className="font-semibold text-primary">{data.requisition.topRequestingZone.count} ครั้ง</span>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">ยังไม่มีข้อมูลการเบิกในช่วงที่เลือก</p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-primary" />
                <span className="font-medium text-text-primary">สถานะการตรวจนับสต๊อก (ช่วงที่เลือก)</span>
              </CardHeader>
              <CardBody>
                {Object.keys(data.operations.stockCountStatus).length === 0 ? (
                  <p className="text-sm text-text-secondary">ยังไม่มีรายการตรวจนับสต๊อกในช่วงที่เลือก</p>
                ) : (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={STOCK_COUNT_STATUSES.map((status) => ({
                          status,
                          label: STOCK_COUNT_STATUS_LABEL[status],
                          count: data.operations.stockCountStatus[status] ?? 0,
                        }))}
                        layout="vertical"
                        margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                      >
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <Tooltip formatter={(value) => [`${value} รายการ`, '']} labelFormatter={() => ''} />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                          {STOCK_COUNT_STATUSES.map((status) => (
                            <Cell key={status} fill={STOCK_COUNT_STATUS_COLOR[status]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="รออนุมัติทั้งหมด" value={`${formatNumber(data.operations.pendingApprovals)} รายการ`} icon={CheckCircle2} />
            <StatCard label="การโอนที่รอดำเนินการ" value={`${formatNumber(data.operations.pendingTransfers)} รายการ`} icon={ArrowLeftRight} />
          </div>
        </>
      )}
    </div>
  )
}
