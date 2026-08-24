/**
 * Canonical permission registry (plan.md §11-12: `resource.action` naming convention).
 * Codes drawn verbatim from plan.md §9-11 where enumerated there. The zones, categories,
 * units, suppliers, ingredients, and permissions.read codes are additions not explicitly
 * listed in plan.md (master data permissions are never enumerated there), added to follow
 * the same resource.action convention so master-data CRUD has a real authorization boundary.
 * The purchasing, waste, reports.read, and audit.read codes are seeded even though their
 * modules are P1 -- they're already referenced by role permission lists in plan.md §9-10.
 */
export const PERMISSION_CODES = {
  DASHBOARD_READ: 'dashboard.read',

  ZONES_READ: 'zones.read',
  ZONES_CREATE: 'zones.create',
  ZONES_UPDATE: 'zones.update',
  ZONES_DISABLE: 'zones.disable',

  CATEGORIES_READ: 'categories.read',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',

  UNITS_READ: 'units.read',
  UNITS_CREATE: 'units.create',
  UNITS_UPDATE: 'units.update',

  SUPPLIERS_READ: 'suppliers.read',
  SUPPLIERS_CREATE: 'suppliers.create',
  SUPPLIERS_UPDATE: 'suppliers.update',

  INGREDIENTS_READ: 'ingredients.read',
  INGREDIENTS_CREATE: 'ingredients.create',
  INGREDIENTS_UPDATE: 'ingredients.update',

  INVENTORY_READ: 'inventory.read',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_COUNT: 'inventory.count',

  REQUISITION_READ: 'requisition.read',
  REQUISITION_CREATE: 'requisition.create',
  REQUISITION_APPROVE: 'requisition.approve',
  REQUISITION_REJECT: 'requisition.reject',
  REQUISITION_FULFILL: 'requisition.fulfill',
  REQUISITION_CANCEL: 'requisition.cancel',

  TRANSFER_READ: 'transfer.read',
  TRANSFER_CREATE: 'transfer.create',
  TRANSFER_APPROVE: 'transfer.approve',
  TRANSFER_COMPLETE: 'transfer.complete',
  TRANSFER_CANCEL: 'transfer.cancel',

  STOCK_COUNT_READ: 'stockCount.read',
  STOCK_COUNT_CREATE: 'stockCount.create',
  STOCK_COUNT_APPROVE: 'stockCount.approve',

  PURCHASING_READ: 'purchasing.read',
  PURCHASING_CREATE: 'purchasing.create',
  PURCHASING_APPROVE: 'purchasing.approve',
  PURCHASING_RECEIVE: 'purchasing.receive',

  WASTE_READ: 'waste.read',
  WASTE_CREATE: 'waste.create',
  WASTE_APPROVE: 'waste.approve',

  REPORTS_READ: 'reports.read',

  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DISABLE: 'users.disable',

  ROLES_READ: 'roles.read',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',

  PERMISSIONS_READ: 'permissions.read',

  AUDIT_READ: 'audit.read',
} as const;

export type PermissionCode =
  (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export interface PermissionRegistryEntry {
  code: PermissionCode;
  name: string;
  module: string;
  description: string;
}

export const PERMISSION_REGISTRY: PermissionRegistryEntry[] = [
  {
    code: PERMISSION_CODES.DASHBOARD_READ,
    name: 'ดูภาพรวม',
    module: 'DASHBOARD',
    description: 'Allows user to view the owner dashboard',
  },

  {
    code: PERMISSION_CODES.ZONES_READ,
    name: 'ดู Zone',
    module: 'ZONE',
    description: 'Allows user to view zones',
  },
  {
    code: PERMISSION_CODES.ZONES_CREATE,
    name: 'สร้าง Zone',
    module: 'ZONE',
    description: 'Allows user to create zones',
  },
  {
    code: PERMISSION_CODES.ZONES_UPDATE,
    name: 'แก้ไข Zone',
    module: 'ZONE',
    description: 'Allows user to update zones',
  },
  {
    code: PERMISSION_CODES.ZONES_DISABLE,
    name: 'ปิดใช้งาน Zone',
    module: 'ZONE',
    description: 'Allows user to disable/enable zones',
  },

  {
    code: PERMISSION_CODES.CATEGORIES_READ,
    name: 'ดูหมวดหมู่',
    module: 'CATEGORY',
    description: 'Allows user to view categories',
  },
  {
    code: PERMISSION_CODES.CATEGORIES_CREATE,
    name: 'สร้างหมวดหมู่',
    module: 'CATEGORY',
    description: 'Allows user to create categories',
  },
  {
    code: PERMISSION_CODES.CATEGORIES_UPDATE,
    name: 'แก้ไขหมวดหมู่',
    module: 'CATEGORY',
    description: 'Allows user to update categories',
  },

  {
    code: PERMISSION_CODES.UNITS_READ,
    name: 'ดูหน่วยนับ',
    module: 'UNIT',
    description: 'Allows user to view units',
  },
  {
    code: PERMISSION_CODES.UNITS_CREATE,
    name: 'สร้างหน่วยนับ',
    module: 'UNIT',
    description: 'Allows user to create units',
  },
  {
    code: PERMISSION_CODES.UNITS_UPDATE,
    name: 'แก้ไขหน่วยนับ',
    module: 'UNIT',
    description: 'Allows user to update units',
  },

  {
    code: PERMISSION_CODES.SUPPLIERS_READ,
    name: 'ดู Supplier',
    module: 'SUPPLIER',
    description: 'Allows user to view suppliers',
  },
  {
    code: PERMISSION_CODES.SUPPLIERS_CREATE,
    name: 'สร้าง Supplier',
    module: 'SUPPLIER',
    description: 'Allows user to create suppliers',
  },
  {
    code: PERMISSION_CODES.SUPPLIERS_UPDATE,
    name: 'แก้ไข Supplier',
    module: 'SUPPLIER',
    description: 'Allows user to update suppliers',
  },

  {
    code: PERMISSION_CODES.INGREDIENTS_READ,
    name: 'ดูวัตถุดิบ',
    module: 'INGREDIENT',
    description: 'Allows user to view ingredients',
  },
  {
    code: PERMISSION_CODES.INGREDIENTS_CREATE,
    name: 'สร้างวัตถุดิบ',
    module: 'INGREDIENT',
    description: 'Allows user to create ingredients',
  },
  {
    code: PERMISSION_CODES.INGREDIENTS_UPDATE,
    name: 'แก้ไขวัตถุดิบ',
    module: 'INGREDIENT',
    description: 'Allows user to update ingredients',
  },

  {
    code: PERMISSION_CODES.INVENTORY_READ,
    name: 'ดูสต๊อกสินค้า',
    module: 'INVENTORY',
    description: 'Allows user to view stock balances',
  },
  {
    code: PERMISSION_CODES.INVENTORY_CREATE,
    name: 'รับ/จ่ายสินค้า',
    module: 'INVENTORY',
    description: 'Allows user to create stock in / stock out movements',
  },
  {
    code: PERMISSION_CODES.INVENTORY_UPDATE,
    name: 'แก้ไขสต๊อกสินค้า',
    module: 'INVENTORY',
    description: 'Allows user to update inventory records',
  },
  {
    code: PERMISSION_CODES.INVENTORY_ADJUST,
    name: 'ปรับปรุงสต๊อก',
    module: 'INVENTORY',
    description: 'Allows user to create stock adjustments',
  },
  {
    code: PERMISSION_CODES.INVENTORY_COUNT,
    name: 'ตรวจนับสต๊อก',
    module: 'INVENTORY',
    description: 'Allows user to perform stock counts',
  },

  {
    code: PERMISSION_CODES.REQUISITION_READ,
    name: 'ดูใบเบิกสินค้า',
    module: 'REQUISITION',
    description: 'Allows user to view requisitions',
  },
  {
    code: PERMISSION_CODES.REQUISITION_CREATE,
    name: 'สร้างใบเบิกสินค้า',
    module: 'REQUISITION',
    description: 'Allows user to create requisitions',
  },
  {
    code: PERMISSION_CODES.REQUISITION_APPROVE,
    name: 'อนุมัติใบเบิกสินค้า',
    module: 'REQUISITION',
    description: 'Allows user to approve requisitions',
  },
  {
    code: PERMISSION_CODES.REQUISITION_REJECT,
    name: 'ปฏิเสธใบเบิกสินค้า',
    module: 'REQUISITION',
    description: 'Allows user to reject requisitions',
  },
  {
    code: PERMISSION_CODES.REQUISITION_FULFILL,
    name: 'จ่ายสินค้าตามใบเบิก',
    module: 'REQUISITION',
    description: 'Allows user to fulfill requisitions',
  },
  {
    code: PERMISSION_CODES.REQUISITION_CANCEL,
    name: 'ยกเลิกใบเบิกสินค้า',
    module: 'REQUISITION',
    description: 'Allows user to cancel requisitions',
  },

  {
    code: PERMISSION_CODES.TRANSFER_READ,
    name: 'ดูการโอนสินค้า',
    module: 'TRANSFER',
    description: 'Allows user to view transfers',
  },
  {
    code: PERMISSION_CODES.TRANSFER_CREATE,
    name: 'สร้างการโอนสินค้า',
    module: 'TRANSFER',
    description: 'Allows user to create direct zone-to-zone transfers',
  },
  {
    code: PERMISSION_CODES.TRANSFER_APPROVE,
    name: 'อนุมัติการโอนสินค้า',
    module: 'TRANSFER',
    description: 'Reserved for a future pending-transfer approval step',
  },
  {
    code: PERMISSION_CODES.TRANSFER_COMPLETE,
    name: 'ยืนยันการโอนสินค้า',
    module: 'TRANSFER',
    description: 'Allows user to complete transfers',
  },
  {
    code: PERMISSION_CODES.TRANSFER_CANCEL,
    name: 'ยกเลิกการโอนสินค้า',
    module: 'TRANSFER',
    description: 'Allows user to cancel transfers',
  },

  {
    code: PERMISSION_CODES.STOCK_COUNT_READ,
    name: 'ดูการตรวจนับสต๊อก',
    module: 'STOCK_COUNT',
    description: 'Allows user to view stock counts',
  },
  {
    code: PERMISSION_CODES.STOCK_COUNT_CREATE,
    name: 'สร้างการตรวจนับสต๊อก',
    module: 'STOCK_COUNT',
    description: 'Allows user to create stock counts',
  },
  {
    code: PERMISSION_CODES.STOCK_COUNT_APPROVE,
    name: 'อนุมัติการตรวจนับสต๊อก',
    module: 'STOCK_COUNT',
    description: 'Allows user to approve stock counts',
  },

  {
    code: PERMISSION_CODES.PURCHASING_READ,
    name: 'ดูการจัดซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to view purchase orders',
  },
  {
    code: PERMISSION_CODES.PURCHASING_CREATE,
    name: 'สร้างใบสั่งซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to create, submit, and cancel purchase orders',
  },
  {
    code: PERMISSION_CODES.PURCHASING_APPROVE,
    name: 'อนุมัติใบสั่งซื้อ',
    module: 'PURCHASING',
    description: 'Allows user to approve or reject purchase orders',
  },
  {
    code: PERMISSION_CODES.PURCHASING_RECEIVE,
    name: 'รับสินค้าตามใบสั่งซื้อ',
    module: 'PURCHASING',
    description:
      'Allows user to receive goods against an approved purchase order',
  },

  {
    code: PERMISSION_CODES.WASTE_READ,
    name: 'ดูของเสีย',
    module: 'WASTE',
    description: 'Allows user to view waste records',
  },
  {
    code: PERMISSION_CODES.WASTE_CREATE,
    name: 'บันทึกของเสีย',
    module: 'WASTE',
    description: 'Allows user to report waste',
  },
  {
    code: PERMISSION_CODES.WASTE_APPROVE,
    name: 'อนุมัติของเสีย',
    module: 'WASTE',
    description: 'Allows user to approve or reject waste records',
  },

  {
    code: PERMISSION_CODES.REPORTS_READ,
    name: 'ดูรายงาน',
    module: 'REPORTS',
    description:
      'Allows user to view zone, requisition, and comparison reports',
  },

  {
    code: PERMISSION_CODES.USERS_READ,
    name: 'ดูผู้ใช้งาน',
    module: 'USER',
    description: 'Allows user to view users',
  },
  {
    code: PERMISSION_CODES.USERS_CREATE,
    name: 'สร้างผู้ใช้งาน',
    module: 'USER',
    description: 'Allows user to create users',
  },
  {
    code: PERMISSION_CODES.USERS_UPDATE,
    name: 'แก้ไขผู้ใช้งาน',
    module: 'USER',
    description: 'Allows user to update users',
  },
  {
    code: PERMISSION_CODES.USERS_DISABLE,
    name: 'ปิดใช้งานผู้ใช้งาน',
    module: 'USER',
    description: 'Allows user to disable users',
  },

  {
    code: PERMISSION_CODES.ROLES_READ,
    name: 'ดูบทบาท',
    module: 'ROLE',
    description: 'Allows user to view roles',
  },
  {
    code: PERMISSION_CODES.ROLES_CREATE,
    name: 'สร้างบทบาท',
    module: 'ROLE',
    description: 'Allows user to create roles',
  },
  {
    code: PERMISSION_CODES.ROLES_UPDATE,
    name: 'แก้ไขบทบาท',
    module: 'ROLE',
    description: 'Allows user to update roles',
  },

  {
    code: PERMISSION_CODES.PERMISSIONS_READ,
    name: 'ดูสิทธิ์การใช้งาน',
    module: 'PERMISSION',
    description: 'Allows user to view the permission registry',
  },

  {
    code: PERMISSION_CODES.AUDIT_READ,
    name: 'ดูประวัติการใช้งาน',
    module: 'AUDIT',
    description: 'Allows user to view the audit log',
  },
];
