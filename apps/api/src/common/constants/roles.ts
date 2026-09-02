import { PERMISSION_CODES, type PermissionCode } from './permissions';

/**
 * The 6 initial roles from plan.md §9-10. Permission sets are copied verbatim from those
 * sections where plan.md enumerates them explicitly. Master-data codes (zones.*, categories.*,
 * units.*, suppliers.*, ingredients.*) and permissions.read are additions (see permissions.ts
 * header) applied with a conservative default: OWNER gets full CRUD; MANAGER gets read + create/
 * update on operational master data (ingredients/categories/units/suppliers) as the operational
 * lead but not zone structure changes; INVENTORY_MANAGER/KITCHEN_STAFF/FRONT_STAFF/VIEWER get
 * read-only access to the reference data they need for dropdowns and display. This is adjustable
 * later without code changes via the data-driven Role Management UI (plan.md §18).
 */
export const ROLE_NAMES = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  KITCHEN_STAFF: 'KITCHEN_STAFF',
  FRONT_STAFF: 'FRONT_STAFF',
  VIEWER: 'VIEWER',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export interface RoleDefinition {
  name: RoleName;
  description: string;
  allZoneAccess: boolean;
  permissions: PermissionCode[];
}

const ALL_PERMISSION_CODES = Object.values(PERMISSION_CODES);

const REFERENCE_DATA_READ: PermissionCode[] = [
  PERMISSION_CODES.ZONES_READ,
  PERMISSION_CODES.CATEGORIES_READ,
  PERMISSION_CODES.UNITS_READ,
  PERMISSION_CODES.INGREDIENTS_READ,
];

/**
 * "Export mirrors read": whichever `.read` codes a role already carries, it automatically
 * gets the corresponding `.export` code too, via `withDerivedExportPermissions` below. This
 * keeps the 6 role literals above untouched -- adding a 14th exportable resource later only
 * needs one line here (plus one in permissions.ts), never per-role edits.
 */
const EXPORT_BY_READ: Partial<Record<PermissionCode, PermissionCode>> = {
  [PERMISSION_CODES.ZONES_READ]: PERMISSION_CODES.ZONES_EXPORT,
  [PERMISSION_CODES.CATEGORIES_READ]: PERMISSION_CODES.CATEGORIES_EXPORT,
  [PERMISSION_CODES.UNITS_READ]: PERMISSION_CODES.UNITS_EXPORT,
  [PERMISSION_CODES.SUPPLIERS_READ]: PERMISSION_CODES.SUPPLIERS_EXPORT,
  [PERMISSION_CODES.INGREDIENTS_READ]: PERMISSION_CODES.INGREDIENTS_EXPORT,
  [PERMISSION_CODES.INVENTORY_READ]: PERMISSION_CODES.INVENTORY_EXPORT,
  [PERMISSION_CODES.REQUISITION_READ]: PERMISSION_CODES.REQUISITION_EXPORT,
  [PERMISSION_CODES.TRANSFER_READ]: PERMISSION_CODES.TRANSFER_EXPORT,
  [PERMISSION_CODES.STOCK_COUNT_READ]: PERMISSION_CODES.STOCK_COUNT_EXPORT,
  [PERMISSION_CODES.USERS_READ]: PERMISSION_CODES.USERS_EXPORT,
  [PERMISSION_CODES.ROLES_READ]: PERMISSION_CODES.ROLES_EXPORT,
  [PERMISSION_CODES.PERMISSIONS_READ]: PERMISSION_CODES.PERMISSIONS_EXPORT,
  [PERMISSION_CODES.REPORTS_READ]: PERMISSION_CODES.REPORTS_EXPORT,
};

function withDerivedExportPermissions(role: RoleDefinition): RoleDefinition {
  const derived = role.permissions
    .map((code) => EXPORT_BY_READ[code])
    .filter((code): code is PermissionCode => Boolean(code))
    .filter((code) => !role.permissions.includes(code));
  return { ...role, permissions: [...role.permissions, ...derived] };
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: ROLE_NAMES.OWNER,
    description: 'เจ้าของกิจการ - เข้าถึงระบบได้ทั้งหมด',
    allZoneAccess: true,
    permissions: ALL_PERMISSION_CODES,
  },
  {
    name: ROLE_NAMES.MANAGER,
    description: 'ผู้จัดการร้าน - ดูแลการดำเนินงานของร้าน',
    allZoneAccess: false,
    permissions: [
      PERMISSION_CODES.DASHBOARD_READ,

      PERMISSION_CODES.INVENTORY_READ,
      PERMISSION_CODES.INVENTORY_ADJUST,
      PERMISSION_CODES.INVENTORY_COUNT,

      PERMISSION_CODES.REQUISITION_READ,
      PERMISSION_CODES.REQUISITION_APPROVE,
      PERMISSION_CODES.REQUISITION_REJECT,
      PERMISSION_CODES.REQUISITION_FULFILL,

      PERMISSION_CODES.TRANSFER_READ,
      PERMISSION_CODES.TRANSFER_APPROVE,
      PERMISSION_CODES.TRANSFER_COMPLETE,

      PERMISSION_CODES.STOCK_COUNT_READ,
      PERMISSION_CODES.STOCK_COUNT_APPROVE,

      PERMISSION_CODES.PURCHASING_READ,
      PERMISSION_CODES.PURCHASING_CREATE,
      PERMISSION_CODES.PURCHASING_APPROVE,
      PERMISSION_CODES.PURCHASING_RECEIVE,

      PERMISSION_CODES.WASTE_READ,
      PERMISSION_CODES.WASTE_APPROVE,

      PERMISSION_CODES.REPORTS_READ,
      PERMISSION_CODES.AUDIT_READ,

      ...REFERENCE_DATA_READ,
      PERMISSION_CODES.SUPPLIERS_READ,
      PERMISSION_CODES.CATEGORIES_CREATE,
      PERMISSION_CODES.CATEGORIES_UPDATE,
      PERMISSION_CODES.UNITS_CREATE,
      PERMISSION_CODES.UNITS_UPDATE,
      PERMISSION_CODES.SUPPLIERS_CREATE,
      PERMISSION_CODES.SUPPLIERS_UPDATE,
      PERMISSION_CODES.INGREDIENTS_CREATE,
      PERMISSION_CODES.INGREDIENTS_UPDATE,
    ],
  },
  {
    name: ROLE_NAMES.INVENTORY_MANAGER,
    description: 'ผู้จัดการสต๊อก - ดูแลการเคลื่อนไหวสต๊อกสินค้า',
    allZoneAccess: false,
    permissions: [
      PERMISSION_CODES.INVENTORY_READ,
      PERMISSION_CODES.INVENTORY_CREATE,
      PERMISSION_CODES.INVENTORY_UPDATE,
      PERMISSION_CODES.INVENTORY_ADJUST,
      PERMISSION_CODES.INVENTORY_COUNT,

      PERMISSION_CODES.STOCK_COUNT_READ,
      PERMISSION_CODES.STOCK_COUNT_CREATE,
      PERMISSION_CODES.STOCK_COUNT_APPROVE,

      PERMISSION_CODES.REQUISITION_READ,
      PERMISSION_CODES.REQUISITION_FULFILL,

      PERMISSION_CODES.TRANSFER_READ,
      PERMISSION_CODES.TRANSFER_CREATE,
      PERMISSION_CODES.TRANSFER_COMPLETE,

      PERMISSION_CODES.PURCHASING_READ,
      PERMISSION_CODES.PURCHASING_RECEIVE,

      PERMISSION_CODES.WASTE_READ,
      PERMISSION_CODES.WASTE_CREATE,

      ...REFERENCE_DATA_READ,
      PERMISSION_CODES.SUPPLIERS_READ,
    ],
  },
  {
    name: ROLE_NAMES.KITCHEN_STAFF,
    description: 'พนักงานครัว - เบิกวัตถุดิบสำหรับโซนครัว',
    allZoneAccess: false,
    permissions: [
      PERMISSION_CODES.INVENTORY_READ,

      PERMISSION_CODES.REQUISITION_READ,
      PERMISSION_CODES.REQUISITION_CREATE,
      PERMISSION_CODES.REQUISITION_CANCEL,

      PERMISSION_CODES.TRANSFER_READ,

      PERMISSION_CODES.WASTE_READ,
      PERMISSION_CODES.WASTE_CREATE,

      ...REFERENCE_DATA_READ,
    ],
  },
  {
    name: ROLE_NAMES.FRONT_STAFF,
    description: 'พนักงานหน้าร้าน - เบิกวัตถุดิบสำหรับโซนหน้าร้าน',
    allZoneAccess: false,
    permissions: [
      PERMISSION_CODES.INVENTORY_READ,

      PERMISSION_CODES.REQUISITION_READ,
      PERMISSION_CODES.REQUISITION_CREATE,
      PERMISSION_CODES.REQUISITION_CANCEL,

      PERMISSION_CODES.TRANSFER_READ,

      PERMISSION_CODES.WASTE_READ,
      PERMISSION_CODES.WASTE_CREATE,

      ...REFERENCE_DATA_READ,
    ],
  },
  {
    name: ROLE_NAMES.VIEWER,
    description: 'ผู้เยี่ยมชม - ดูข้อมูลได้อย่างเดียว',
    allZoneAccess: false,
    permissions: [
      PERMISSION_CODES.DASHBOARD_READ,
      PERMISSION_CODES.INVENTORY_READ,
      PERMISSION_CODES.REPORTS_READ,
      ...REFERENCE_DATA_READ,
    ],
  },
].map(withDerivedExportPermissions);
