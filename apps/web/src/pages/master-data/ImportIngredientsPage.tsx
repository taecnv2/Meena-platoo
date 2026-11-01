import { useState, type ChangeEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Info, RotateCcw, Upload } from 'lucide-react'
import { importsApi } from '@/api/endpoints/imports'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/Button'
import { Card, CardBody, CardHeader } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExcelExportButton } from '@/components/ExcelExportButton'
import { LoadingState } from '@/components/LoadingState'
import { useToast } from '@/components/Toast'
import { buildTemplateSheet, INGREDIENT_IMPORT_COLUMNS, mapSheetToImportRows, type MappedImport } from '@/features/import/ingredientImportColumns'
import { ImportColumnGuide } from '@/features/import/components/ImportColumnGuide'
import { ImportResultView } from '@/features/import/components/ImportResultView'
import { findBlockingRowIssues, MAX_IMPORT_ROWS } from '@/features/import/components/validateImportRows'
import { formatNumber } from '@/utils/format'
import type { ExcelColumn } from '@/utils/excel'
import { readSpreadsheet } from '@/utils/excel'
import type { ImportIngredientRow, ImportResult } from '@/types/entities'

type TemplateRow = Array<string | number>

const TEMPLATE_ROWS: TemplateRow[] = buildTemplateSheet().slice(1)
const TEMPLATE_COLUMNS: Array<ExcelColumn<TemplateRow>> = INGREDIENT_IMPORT_COLUMNS.map((column, index) => ({
  header: column.header,
  value: (row) => (row[index] === '' ? null : row[index]),
  width: 20,
}))

/** Query keys whose data an import can change (ingredients, auto-created categories/units, opening balances). */
const AFFECTED_QUERY_KEYS = [['ingredients'], ['categories'], ['units'], ['inventory'], ['stock-movements'], ['reports'], ['dashboard']]

function StepHeading({ step, title, description }: { step: number; title: string; description?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white" aria-hidden>
        {step}
      </span>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold text-text-primary">
          <span className="sr-only">ขั้นตอนที่ {step}: </span>
          {title}
        </h2>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : Info
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'flex items-start gap-2 rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-red-800'
          : 'flex items-start gap-2 rounded-lg border border-info bg-info-light px-4 py-3 text-sm text-sky-900'
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
    </div>
  )
}

export function ImportIngredientsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [fileName, setFileName] = useState<string | null>(null)
  const [mapped, setMapped] = useState<MappedImport | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [rowIssues, setRowIssues] = useState<string[]>([])
  const [isReading, setIsReading] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null)

  const previewMutation = useMutation({
    mutationFn: (rows: ImportIngredientRow[]) => importsApi.ingredients(rows, true),
  })
  const commitMutation = useMutation({
    mutationFn: (rows: ImportIngredientRow[]) => importsApi.ingredients(rows, false),
  })

  const preview = previewMutation.data ?? null
  const importableCount = preview ? preview.summary.create + preview.summary.update : 0

  const resetAll = () => {
    setFileName(null)
    setMapped(null)
    setFileError(null)
    setRowIssues([])
    setFinalResult(null)
    previewMutation.reset()
    commitMutation.reset()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clear the input so picking the same (edited) file again still fires onChange.
    event.target.value = ''
    if (!file) {
      return
    }
    resetAll()
    setFileName(file.name)

    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setFileError('รองรับเฉพาะไฟล์ .xlsx หรือ .csv เท่านั้น (ถ้าเป็น .xls ให้บันทึกเป็น .xlsx ก่อน)')
      return
    }

    setIsReading(true)
    let result: MappedImport
    try {
      result = mapSheetToImportRows(await readSpreadsheet(file))
    } catch {
      setFileError('อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) หรือ CSV ที่ถูกต้อง')
      return
    } finally {
      setIsReading(false)
    }
    setMapped(result)

    if (result.missingRequired.length > 0) {
      return
    }
    if (result.rows.length === 0) {
      setFileError('ไม่พบข้อมูลในไฟล์ (มีแต่แถวหัวตาราง)')
      return
    }
    if (result.rows.length > MAX_IMPORT_ROWS) {
      setFileError(
        `ไฟล์มี ${formatNumber(result.rows.length)} แถว นำเข้าได้ครั้งละไม่เกิน ${formatNumber(MAX_IMPORT_ROWS)} แถว กรุณาแบ่งไฟล์`,
      )
      return
    }
    const issues = findBlockingRowIssues(result.rows)
    setRowIssues(issues)
    if (issues.length > 0) {
      return
    }
    previewMutation.mutate(result.rows)
  }

  const handleConfirm = async () => {
    if (!mapped) {
      return
    }
    try {
      const result = await commitMutation.mutateAsync(mapped.rows)
      setFinalResult(result)
      setIsConfirmOpen(false)
      const { create, update, error } = result.summary
      toast.show(
        'success',
        `นำเข้าสำเร็จ: สร้างใหม่ ${formatNumber(create)} อัปเดต ${formatNumber(update)} รายการ${
          error > 0 ? ` (ข้าม ${formatNumber(error)} แถวที่มีปัญหา)` : ''
        }`,
      )
      await Promise.all(AFFECTED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    } catch (error) {
      setIsConfirmOpen(false)
      toast.show('error', getErrorMessage(error))
    }
  }

  const confirmMessage = preview
    ? [
        `นำเข้า ${formatNumber(importableCount)} รายการ (สร้างใหม่ ${formatNumber(preview.summary.create)} / อัปเดต ${formatNumber(preview.summary.update)})`,
        preview.summary.openingBalances > 0
          ? `และตั้งยอดยกมา ${formatNumber(preview.summary.openingBalances)} รายการ (สต๊อกของ Zone นั้นจะถูกตั้งเป็นตัวเลขในไฟล์)`
          : '',
        preview.summary.error > 0 ? `แถวที่มีปัญหา ${formatNumber(preview.summary.error)} แถวจะถูกข้าม ไม่นำเข้า` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  const canPreview = mapped !== null && mapped.missingRequired.length === 0 && !fileError && rowIssues.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">นำเข้าวัตถุดิบจาก Excel</h1>
        <p className="text-sm text-text-secondary">
          เพิ่มหรืออัปเดตวัตถุดิบหลายรายการพร้อมกันจากไฟล์ Excel และตั้งยอดยกมาได้ในครั้งเดียว ระบบจะให้ตรวจสอบก่อนบันทึกจริงเสมอ
        </p>
      </div>

      <Card>
        <CardHeader>
          <StepHeading
            step={1}
            title="ดาวน์โหลดไฟล์ตัวอย่าง"
            description="กรอกข้อมูลตามหัวคอลัมน์ในไฟล์ตัวอย่าง (แถวแรกคือหัวคอลัมน์ ห้ามแก้ชื่อ) ลบแถวตัวอย่างออกก่อนนำเข้า"
          />
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            <p>
              วัตถุดิบที่มีอยู่แล้วจะถูก<strong className="text-text-primary">อัปเดต</strong> โดยจับคู่จาก
              <strong className="text-text-primary"> รหัส</strong> หรือจาก<strong className="text-text-primary"> ชื่อ</strong>{' '}
              เมื่อเว้นรหัสว่างไว้ ส่วนที่ไม่พบจะ<strong className="text-text-primary">สร้างใหม่</strong>
            </p>
            <p>หมวดหมู่และหน่วยที่ยังไม่มีในระบบ จะถูกสร้างให้อัตโนมัติ</p>
          </div>
          <div>
            <ExcelExportButton fileName="ไฟล์ตัวอย่างนำเข้าวัตถุดิบ" columns={TEMPLATE_COLUMNS} rows={TEMPLATE_ROWS} label="ดาวน์โหลดไฟล์ตัวอย่าง" />
          </div>
          <ImportColumnGuide />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <StepHeading step={2} title="เลือกไฟล์" description="รองรับไฟล์ .xlsx และ .csv (อ่านเฉพาะชีตแรก)" />
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ingredient-import-file" className="text-sm font-medium text-text-primary">
              ไฟล์วัตถุดิบ
            </label>
            <input
              id="ingredient-import-file"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(event) => void handleFileChange(event)}
              disabled={isReading || previewMutation.isPending || commitMutation.isPending}
              className="block w-full rounded-lg border border-border bg-white text-sm text-text-secondary file:mr-3 file:h-11 file:cursor-pointer file:border-0 file:bg-primary file:px-4 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover disabled:opacity-50"
            />
          </div>

          {fileName && mapped ? (
            <p className="text-sm text-text-secondary">
              ไฟล์ <span className="font-medium text-text-primary">{fileName}</span> พบข้อมูล {formatNumber(mapped.rows.length)} แถว
            </p>
          ) : null}

          {isReading ? <LoadingState label="กำลังอ่านไฟล์..." /> : null}

          {fileError ? <Notice tone="error">{fileError}</Notice> : null}

          {mapped && mapped.missingRequired.length > 0 ? (
            <Notice tone="error">
              ไม่พบคอลัมน์ที่จำเป็น: <strong>{mapped.missingRequired.join(', ')}</strong> กรุณาใช้หัวคอลัมน์ตามไฟล์ตัวอย่าง
            </Notice>
          ) : null}

          {mapped && mapped.ignoredHeaders.length > 0 ? (
            <Notice tone="info">
              คอลัมน์ที่ระบบไม่รู้จักและจะไม่ถูกนำเข้า: {mapped.ignoredHeaders.join(', ')}
            </Notice>
          ) : null}

          {rowIssues.length > 0 ? (
            <Notice tone="error">
              <p className="font-medium">พบข้อมูลที่ไม่ถูกต้อง กรุณาแก้ไขในไฟล์แล้วเลือกไฟล์ใหม่</p>
              <ul className="mt-1 list-disc pl-5">
                {rowIssues.slice(0, 20).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              {rowIssues.length > 20 ? <p className="mt-1">และอีก {formatNumber(rowIssues.length - 20)} รายการ</p> : null}
            </Notice>
          ) : null}
        </CardBody>
      </Card>

      {finalResult ? (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <StepHeading step={4} title="ผลการนำเข้า" description="บันทึกข้อมูลเรียบร้อยแล้ว แถวที่มีปัญหาถูกข้ามไป" />
            <Button variant="secondary" size="sm" onClick={resetAll}>
              <RotateCcw className="size-4" aria-hidden /> นำเข้าไฟล์ใหม่
            </Button>
          </CardHeader>
          <CardBody>
            <ImportResultView result={finalResult} />
          </CardBody>
        </Card>
      ) : canPreview ? (
        <Card>
          <CardHeader>
            <StepHeading
              step={3}
              title="ตรวจสอบก่อนนำเข้า"
              description="ยังไม่มีการบันทึกข้อมูล ตรวจสอบผลด้านล่าง แล้วกด ยืนยันนำเข้า"
            />
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {previewMutation.isPending ? <LoadingState label="กำลังตรวจสอบข้อมูล..." /> : null}

            {previewMutation.isError ? (
              <Notice tone="error">
                <p>ตรวจสอบข้อมูลไม่สำเร็จ: {getErrorMessage(previewMutation.error)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => mapped && previewMutation.mutate(mapped.rows)}
                >
                  <RotateCcw className="size-4" aria-hidden /> ลองใหม่
                </Button>
              </Notice>
            ) : null}

            {preview ? (
              <>
                <ImportResultView result={preview} />
                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-text-secondary">
                    {importableCount > 0
                      ? `พร้อมนำเข้า ${formatNumber(importableCount)} รายการ${
                          preview.summary.error > 0 ? ` (ข้าม ${formatNumber(preview.summary.error)} แถวที่มีปัญหา)` : ''
                        }`
                      : 'ไม่มีรายการที่นำเข้าได้ กรุณาแก้ไขไฟล์แล้วเลือกไฟล์ใหม่'}
                  </p>
                  <Button onClick={() => setIsConfirmOpen(true)} disabled={importableCount === 0}>
                    <Upload className="size-4" aria-hidden /> ยืนยันนำเข้า
                  </Button>
                </div>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="ยืนยันนำเข้าวัตถุดิบ"
        message={confirmMessage}
        confirmLabel="ยืนยันนำเข้า"
        isLoading={commitMutation.isPending}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  )
}
