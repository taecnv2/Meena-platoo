import type {
  MovementType,
  PurchaseOrderStatus,
  RequisitionStatus,
  StockCountStatus,
  TransferStatus,
  ZoneType,
  UnitType,
} from '@/types/entities'

export const REQUISITION_STATUS_LABEL: Record<RequisitionStatus, string> = {
  DRAFT: 'ร่าง',
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  PARTIALLY_FULFILLED: 'จ่ายบางส่วน',
  FULFILLED: 'จ่ายครบแล้ว',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
}

export const REQUISITION_STATUS_COLOR: Record<RequisitionStatus, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  DRAFT: 'gray',
  PENDING: 'warning',
  APPROVED: 'info',
  PARTIALLY_FULFILLED: 'warning',
  FULFILLED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'gray',
}

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'ร่าง',
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  PARTIALLY_RECEIVED: 'รับสินค้าบางส่วน',
  RECEIVED: 'รับสินค้าครบแล้ว',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
}

export const PURCHASE_ORDER_STATUS_COLOR: Record<PurchaseOrderStatus, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  DRAFT: 'gray',
  PENDING: 'warning',
  APPROVED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'gray',
}

export const STOCK_COUNT_STATUS_LABEL: Record<StockCountStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  CANCELLED: 'ยกเลิก',
}

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  PENDING: 'รอดำเนินการ',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
}

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  STOCK_IN: 'รับสินค้า',
  STOCK_OUT: 'จ่ายสินค้า',
  TRANSFER_IN: 'รับโอน',
  TRANSFER_OUT: 'โอนออก',
  ADJUSTMENT_IN: 'ปรับเพิ่ม',
  ADJUSTMENT_OUT: 'ปรับลด',
  WASTE: 'ของเสีย',
  AUTO_DEDUCTION: 'หักอัตโนมัติ',
}

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  KITCHEN: 'ครัว',
  FRONT_OF_HOUSE: 'หน้าร้าน',
  STORAGE: 'คลังสินค้า',
  COLD_STORAGE: 'ห้องเย็น',
  OTHER: 'อื่นๆ',
}

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  WEIGHT: 'น้ำหนัก',
  VOLUME: 'ปริมาตร',
  COUNT: 'นับจำนวน',
  OTHER: 'อื่นๆ',
}
