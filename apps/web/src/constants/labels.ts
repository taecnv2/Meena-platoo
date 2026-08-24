import type {
  AuditAction,
  ComparisonMetric,
  ComparisonPeriodType,
  MovementType,
  PurchaseOrderStatus,
  RequisitionStatus,
  StockCountStatus,
  TransferStatus,
  WasteReason,
  WasteStatus,
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

export const WASTE_REASON_LABEL: Record<WasteReason, string> = {
  EXPIRED: 'หมดอายุ',
  SPOILED: 'เน่าเสีย',
  DAMAGED: 'เสียหาย',
  OVER_PREPARED: 'เตรียมเกินความจำเป็น',
  WRONG_PREPARATION: 'เตรียมผิดพลาด',
  CUSTOMER_RETURN: 'ลูกค้าคืนสินค้า',
  OTHER: 'อื่นๆ',
}

export const WASTE_STATUS_LABEL: Record<WasteStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
}

export const WASTE_STATUS_COLOR: Record<WasteStatus, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export const COMPARISON_PERIOD_LABEL: Record<ComparisonPeriodType, string> = {
  TODAY_VS_YESTERDAY: 'วันนี้ vs เมื่อวาน',
  THIS_WEEK_VS_LAST_WEEK: 'สัปดาห์นี้ vs สัปดาห์ที่แล้ว',
  THIS_MONTH_VS_LAST_MONTH: 'เดือนนี้ vs เดือนที่แล้ว',
  THIS_YEAR_VS_LAST_YEAR: 'ปีนี้ vs ปีที่แล้ว',
  CUSTOM: 'กำหนดเอง',
}

export const COMPARISON_METRIC_LABEL: Record<ComparisonMetric, string> = {
  STOCK_VALUE: 'มูลค่าสต๊อกที่เปลี่ยนแปลง',
  PURCHASE: 'มูลค่าการจัดซื้อ',
  STOCK_USAGE: 'มูลค่าการเบิกใช้',
  REQUISITION: 'มูลค่าการเบิกสินค้า',
  WASTE: 'มูลค่าของเสีย',
  TRANSFER: 'มูลค่าการโอนสินค้า',
  ADJUSTMENT: 'มูลค่าการปรับปรุงสต๊อก',
  COST: 'ต้นทุนที่ใช้ไป',
}

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  USER_CREATED: 'สร้างผู้ใช้งาน',
  USER_UPDATED: 'แก้ไขผู้ใช้งาน',
  ROLE_CHANGED: 'เปลี่ยนแปลงบทบาท',
  PERMISSION_CHANGED: 'เปลี่ยนแปลงสิทธิ์การใช้งาน',
  ZONE_CREATED: 'สร้าง Zone',
  INGREDIENT_UPDATED: 'แก้ไขวัตถุดิบ',
  REQUISITION_APPROVED: 'อนุมัติใบเบิก',
  TRANSFER_COMPLETED: 'โอนสินค้าสำเร็จ',
  STOCK_ADJUSTED: 'ปรับปรุงสต๊อก',
  PURCHASE_RECEIVED: 'รับสินค้าตามใบสั่งซื้อ',
  WASTE_CREATED: 'บันทึกของเสีย',
}
