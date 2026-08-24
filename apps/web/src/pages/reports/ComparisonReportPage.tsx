import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/endpoints/reports'
import { StatCard } from '@/components/StatCard'
import { Select } from '@/components/Select'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { LoadingState } from '@/components/LoadingState'
import { COMPARISON_METRIC_LABEL, COMPARISON_PERIOD_LABEL } from '@/constants/labels'
import { formatCurrency, formatDate } from '@/utils/format'
import type { DateRangeValue } from '@/utils/dateRange'
import { COMPARISON_PERIOD_TYPES, type ComparisonPeriodType } from '@/types/entities'

export function ComparisonReportPage() {
  const [periodType, setPeriodType] = useState<ComparisonPeriodType>('THIS_MONTH_VS_LAST_MONTH')
  const [customRange, setCustomRange] = useState<DateRangeValue>({ dateFrom: null, dateTo: null })

  const isCustom = periodType === 'CUSTOM'
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'comparison', periodType, customRange.dateFrom, customRange.dateTo],
    queryFn: () =>
      reportsApi.comparison(periodType, customRange.dateFrom ?? undefined, customRange.dateTo ?? undefined),
    enabled: !isCustom || Boolean(customRange.dateFrom && customRange.dateTo),
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">รายงานเปรียบเทียบ</h1>
        <p className="text-sm text-text-secondary">เปรียบเทียบตัวชี้วัดสำคัญระหว่างช่วงเวลาปัจจุบันและช่วงก่อนหน้า</p>
      </div>

      <div className="max-w-xs">
        <Select
          label="ช่วงเวลา"
          options={COMPARISON_PERIOD_TYPES.map((type) => ({ value: type, label: COMPARISON_PERIOD_LABEL[type] }))}
          value={periodType}
          onChange={(event) => setPeriodType(event.target.value as ComparisonPeriodType)}
        />
      </div>

      {isCustom ? <DateRangeFilter value={customRange} onChange={setCustomRange} className="max-w-lg" /> : null}

      {isLoading || !data ? (
        isCustom && !(customRange.dateFrom && customRange.dateTo) ? (
          <p className="text-sm text-text-secondary">กรุณาเลือกช่วงวันที่</p>
        ) : (
          <LoadingState />
        )
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            ปัจจุบัน {formatDate(data.current.from)} – {formatDate(data.current.to)} เทียบกับ {formatDate(data.previous.from)} –{' '}
            {formatDate(data.previous.to)}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.metrics.map((row) => (
              <StatCard
                key={row.metric}
                label={COMPARISON_METRIC_LABEL[row.metric]}
                value={formatCurrency(row.currentValue)}
                trend={{ value: row.percentageChange, label: `เทียบกับ ${formatCurrency(row.previousValue)}` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
