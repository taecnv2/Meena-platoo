export type Status = 'ACTIVE' | 'INACTIVE'

export interface Permission {
  _id: string
  code: string
  name: string
  module: string
  description: string
  status: Status
}

export interface Role {
  _id: string
  name: string
  description: string
  permissions: string[]
  allZoneAccess: boolean
  status: Status
}

export interface UserAccount {
  _id: string
  username: string
  email: string
  name: string
  roleId: string
  zoneIds: string[]
  status: Status
  lastLoginAt: string | null
}

export const ZONE_TYPES = ['KITCHEN', 'FRONT_OF_HOUSE', 'STORAGE', 'COLD_STORAGE', 'OTHER'] as const
export type ZoneType = (typeof ZONE_TYPES)[number]

export interface Zone {
  _id: string
  name: string
  code: string
  type: ZoneType
  description: string
  status: Status
  /** Goods from suppliers may be received straight into this zone (WAREHOUSE always can). */
  allowReceiving?: boolean
}

export interface Category {
  _id: string
  code: string
  name: string
  description: string
  status: Status
}

export const UNIT_TYPES = ['WEIGHT', 'VOLUME', 'COUNT', 'OTHER'] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export interface Unit {
  _id: string
  code: string
  name: string
  type: UnitType
  conversionFactor: number
  status: Status
}

export interface Supplier {
  _id: string
  code: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  status: Status
}

/** 1 `unitId` = `factor` x the ingredient's base unit (e.g. 1 ลัง = 12 ขวด). */
export interface IngredientUnitConversion {
  unitId: string
  factor: number
}

export interface Ingredient {
  _id: string
  code: string
  name: string
  categoryId: string
  baseUnitId: string
  minimumStock: number
  maximumStock: number
  defaultCost: number
  description: string
  status: Status
  unitConversions?: IngredientUnitConversion[]
  tags?: string[]
  /** Third-party owner of consignment stock (e.g. "ไวน์พี่มี่"); null/undefined = restaurant-owned. */
  consignmentOwner?: string | null
}

export interface ZoneStock {
  _id: string
  ingredientId: string
  zoneId: string
  quantity: number
  updatedAt: string
}

export const MOVEMENT_TYPES = [
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'WASTE',
  'AUTO_DEDUCTION',
  'PRODUCTION_IN',
  'PRODUCTION_OUT',
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const STOCK_OUT_REASONS = ['KITCHEN_USE', 'SALE', 'STAFF_MEAL', 'COMPLIMENTARY', 'OTHER'] as const
export type StockOutReason = (typeof STOCK_OUT_REASONS)[number]

export interface StockMovement {
  _id: string
  ingredientId: string
  zoneId: string
  quantity: number
  unit: string
  movementType: MovementType
  referenceType: string
  referenceId: string | null
  unitCost: number
  totalCost: number
  performedBy: string
  reason: string | null
  remark: string | null
  /** What was keyed in before conversion to the base unit (e.g. 2 CASE). */
  inputQuantity?: number | null
  inputUnit?: string | null
  /** Optional measured weight in kg. */
  weight?: number | null
  supplierId?: string | null
  invoiceNo?: string | null
  createdAt: string
}

export const TRANSFER_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const
export type TransferStatus = (typeof TRANSFER_STATUSES)[number]

export interface TransferItem {
  ingredientId: string
  quantity: number
  unit: string
}

export interface Transfer {
  _id: string
  fromZoneId: string
  toZoneId: string
  status: TransferStatus
  items: TransferItem[]
  requisitionId: string | null
  performedBy: string
  completedAt: string | null
  createdAt: string
}

export const REQUISITION_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'REJECTED',
  'CANCELLED',
] as const
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number]

export interface RequisitionItem {
  ingredientId: string
  requestedQuantity: number
  approvedQuantity: number
  fulfilledQuantity: number
  unit: string
  unitCost: number
}

export interface Requisition {
  _id: string
  code: string
  fromZoneId: string
  toZoneId: string
  status: RequisitionStatus
  items: RequisitionItem[]
  requestedBy: string
  approvedBy: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  cancelledBy: string | null
  approvedAt: string | null
  fulfilledAt: string | null
  createdAt: string
}

export const STOCK_COUNT_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'] as const
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number]

export interface StockCountItem {
  ingredientId: string
  expectedQuantity: number
  actualQuantity: number
  difference: number
  unit: string
}

export interface StockCount {
  _id: string
  code: string
  zoneId: string
  status: StockCountStatus
  items: StockCountItem[]
  countedBy: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
}

export interface DashboardSummary {
  inventory: {
    stockValue: number
    lowStockCount: number
    outOfStockCount: number
  }
  purchasing: {
    today: number
    thisMonth: number
    changePercent: number
  }
  requisition: {
    today: number
    thisMonth: number
    requestsInRange: number
    pendingRequests: number
    topRequestingZone: { zoneId: string; zoneName: string; count: number } | null
  }
  waste: {
    today: number
    thisMonth: number
    changePercent: number
  }
  operations: {
    pendingApprovals: number
    pendingTransfers: number
    stockCountStatus: Record<string, number>
  }
}

export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

/** Quantities and unitCost are in the line's own unit (`unit`, e.g. ลัง); conversionFactor maps it to the base unit. */
export interface PurchaseOrderItem {
  ingredientId: string
  orderedQuantity: number
  receivedQuantity: number
  unit: string
  unitId?: string | null
  conversionFactor?: number
  unitCost: number
}

export interface PurchaseOrder {
  _id: string
  code: string
  supplierId: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  deliveryZoneId: string
  createdBy: string
  approvedBy: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  cancelledBy: string | null
  approvedAt: string | null
  completedAt: string | null
  remark: string | null
  createdAt: string
}

export const WASTE_REASONS = [
  'EXPIRED',
  'SPOILED',
  'DAMAGED',
  'OVER_PREPARED',
  'WRONG_PREPARATION',
  'CUSTOMER_RETURN',
  'OTHER',
] as const
export type WasteReason = (typeof WASTE_REASONS)[number]

export const WASTE_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const
export type WasteStatus = (typeof WASTE_STATUSES)[number]

export interface Waste {
  _id: string
  code: string
  zoneId: string
  ingredientId: string
  quantity: number
  unit: string
  reason: WasteReason
  unitCost: number
  status: WasteStatus
  reportedBy: string
  approvedBy: string | null
  approvedAt: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  remark: string | null
  createdAt: string
}

export const AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_UPDATED',
  'ROLE_CHANGED',
  'PERMISSION_CHANGED',
  'ZONE_CREATED',
  'INGREDIENT_UPDATED',
  'REQUISITION_APPROVED',
  'TRANSFER_COMPLETED',
  'STOCK_ADJUSTED',
  'PURCHASE_RECEIVED',
  'WASTE_CREATED',
  'INGREDIENTS_IMPORTED',
  'PRODUCTION_CREATED',
  'DATA_EXPORTED',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditLog {
  _id: string
  userId: string
  action: AuditAction
  entity: string
  entityId: string | null
  before: unknown
  after: unknown
  remark: string | null
  createdAt: string
}

export const NOTIFICATION_TYPES = [
  'REQUISITION_APPROVED',
  'REQUISITION_REJECTED',
  'PURCHASE_APPROVED',
  'PURCHASE_REJECTED',
  'WASTE_APPROVED',
  'WASTE_REJECTED',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface AppNotification {
  _id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  entity: string | null
  entityId: string | null
  isRead: boolean
  createdAt: string
}

export interface ZoneReportRow {
  zoneId: string
  zoneName: string
  stockQuantity: number
  stockValue: number
  usageQuantity: number
  usageValue: number
  transfersIn: number
  transfersOut: number
  requisitionCount: number
  requisitionValue: number
}

export interface RequisitionReportIngredientRow {
  ingredientId: string
  ingredientName: string
  quantity: number
  value: number
}

export interface RequisitionReportZoneRow {
  zoneId: string
  zoneName: string
  count: number
  value: number
}

export interface RequisitionReportUserRow {
  userId: string
  username: string
  count: number
  value: number
}

export interface RequisitionReport {
  numberOfRequests: number
  requestedItems: number
  totalRequestedValue: number
  averageRequestsPerDay: number
  topRequestedIngredients: RequisitionReportIngredientRow[]
  requestsByZone: RequisitionReportZoneRow[]
  requestsByUser: RequisitionReportUserRow[]
  trend: Array<{ date: string; count: number }>
}

export const COMPARISON_PERIOD_TYPES = [
  'TODAY_VS_YESTERDAY',
  'THIS_WEEK_VS_LAST_WEEK',
  'THIS_MONTH_VS_LAST_MONTH',
  'THIS_YEAR_VS_LAST_YEAR',
  'CUSTOM',
] as const
export type ComparisonPeriodType = (typeof COMPARISON_PERIOD_TYPES)[number]

export const COMPARISON_METRICS = [
  'STOCK_VALUE',
  'PURCHASE',
  'STOCK_USAGE',
  'REQUISITION',
  'WASTE',
  'TRANSFER',
  'ADJUSTMENT',
  'COST',
] as const
export type ComparisonMetric = (typeof COMPARISON_METRICS)[number]

export interface ComparisonReport {
  current: { from: string; to: string }
  previous: { from: string; to: string }
  metrics: Array<{
    metric: ComparisonMetric
    currentValue: number
    previousValue: number
    difference: number
    percentageChange: number
  }>
}

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL'

export interface InventoryReportRow {
  ingredientId: string
  ingredientName: string
  unit: string
  totalQuantity: number
  totalValue: number
  minimumStock: number
  maximumStock: number
  stockStatus: StockStatus
  movementInQuantity: number
  movementInValue: number
  movementOutQuantity: number
  movementOutValue: number
}

export interface PurchaseReportSupplierRow {
  supplierId: string
  supplierName: string
  count: number
  value: number
}

export interface PurchaseReportIngredientRow {
  ingredientId: string
  ingredientName: string
  quantity: number
  value: number
}

export interface PurchaseReport {
  totals: {
    numberOfOrders: number
    totalOrderedValue: number
    totalReceivedValue: number
  }
  bySupplier: PurchaseReportSupplierRow[]
  byIngredient: PurchaseReportIngredientRow[]
  trend: Array<{ date: string; value: number }>
}

export interface WasteReportReasonRow {
  reason: WasteReason
  quantity: number
  value: number
}

export interface WasteReportZoneRow {
  zoneId: string
  zoneName: string
  quantity: number
  value: number
}

export interface WasteReportIngredientRow {
  ingredientId: string
  ingredientName: string
  quantity: number
  value: number
}

export interface WasteReport {
  totals: {
    numberOfRecords: number
    totalQuantity: number
    totalValue: number
    pendingCount: number
  }
  byReason: WasteReportReasonRow[]
  byZone: WasteReportZoneRow[]
  byIngredient: WasteReportIngredientRow[]
  trend: Array<{ date: string; value: number }>
}

export interface CostReportIngredientRow {
  ingredientId: string
  ingredientName: string
  cost: number
}

export interface CostReportZoneRow {
  zoneId: string
  zoneName: string
  cost: number
}

export interface CostReport {
  totalCost: number
  byIngredient: CostReportIngredientRow[]
  byZone: CostReportZoneRow[]
  byMovementType: Array<{ movementType: MovementType; cost: number }>
  trend: Array<{ date: string; cost: number }>
}

export interface ProductionLine {
  ingredientId: string
  /** Base-unit quantity. */
  quantity: number
  unit: string
  inputQuantity: number
  inputUnit: string
  portionWeight: number | null
  /** Cost per base unit. */
  unitCost: number
  totalCost: number
}

export interface ProductionBatch {
  _id: string
  code: string
  zoneId: string
  input: ProductionLine
  outputs: ProductionLine[]
  wasteQuantity: number | null
  yieldPercent: number | null
  totalCost: number
  performedBy: string
  remark: string | null
  createdAt: string
}

export interface LedgerDay {
  in: number
  out: number
  closing: number
}

export interface LedgerRow {
  ingredientId: string
  code: string
  name: string
  categoryName: string
  unit: string
  opening: number
  totalIn: number
  totalOut: number
  closing: number
  /** Aligned with LedgerReport.days. */
  days: LedgerDay[]
}

export interface LedgerReport {
  zoneId: string | null
  dateFrom: string
  dateTo: string
  days: string[]
  rows: LedgerRow[]
}

export interface SupplierStatementLine {
  date: string
  ingredientCode: string
  ingredientName: string
  quantity: number
  unit: string
  unitCost: number
  amount: number
  invoiceNo: string | null
  reference: string
  zoneName: string
}

export interface SupplierStatement {
  supplier: Pick<Supplier, '_id' | 'code' | 'name' | 'contactName' | 'phone' | 'address'>
  dateFrom: string | null
  dateTo: string | null
  lines: SupplierStatementLine[]
  totalAmount: number
}

/** opening + received - sold - otherOut = balance (all zones, transfers excluded). */
export interface ConsignmentItemRow {
  ingredientId: string
  code: string
  name: string
  unit: string
  opening: number
  received: number
  sold: number
  soldValue: number
  otherOut: number
  balance: number
  balanceValue: number
}

export interface ConsignmentOwnerReport {
  owner: string
  items: ConsignmentItemRow[]
  totalSoldValue: number
  totalBalanceValue: number
}

/** One spreadsheet row mapped to the import API's field names. */
export interface ImportIngredientRow {
  /** Original sheet row (header = 1) so messages point at the right line even after blank rows are dropped. */
  rowNumber?: number
  code?: string
  name: string
  category: string
  baseUnit: string
  packUnit?: string
  packFactor?: number
  minimumStock?: number
  maximumStock?: number
  defaultCost?: number
  tags?: string
  consignmentOwner?: string
  description?: string
  zone?: string
  openingQuantity?: number
}

export type ImportRowAction = 'CREATE' | 'UPDATE' | 'ERROR'

export interface ImportRowResult {
  rowNumber: number
  code: string | null
  name: string
  action: ImportRowAction
  messages: string[]
}

export interface ImportResult {
  dryRun: boolean
  summary: {
    total: number
    create: number
    update: number
    error: number
    openingBalances: number
    newCategories: string[]
    newUnits: string[]
  }
  rows: ImportRowResult[]
}
