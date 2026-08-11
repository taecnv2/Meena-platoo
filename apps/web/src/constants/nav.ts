import { PERMISSIONS, type PermissionCode } from './permissions'

export interface NavItem {
  label: string
  path: string
  permission: PermissionCode
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_STANDALONE: NavItem = { label: 'ภาพรวม', path: '/dashboard', permission: PERMISSIONS.DASHBOARD_READ }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'สต๊อกสินค้า',
    items: [
      { label: 'สต๊อกคงเหลือ', path: '/inventory/balances', permission: PERMISSIONS.INVENTORY_READ },
      { label: 'รับสินค้า', path: '/inventory/stock-in', permission: PERMISSIONS.INVENTORY_CREATE },
      { label: 'จ่ายสินค้า', path: '/inventory/stock-out', permission: PERMISSIONS.INVENTORY_CREATE },
      { label: 'โอนสินค้า', path: '/inventory/transfers', permission: PERMISSIONS.TRANSFER_READ },
      { label: 'ปรับปรุงสต๊อก', path: '/inventory/adjust', permission: PERMISSIONS.INVENTORY_ADJUST },
      { label: 'ตรวจนับสต๊อก', path: '/stock-counts', permission: PERMISSIONS.STOCK_COUNT_READ },
      { label: 'ประวัติการเคลื่อนไหว', path: '/inventory/movements', permission: PERMISSIONS.INVENTORY_READ },
    ],
  },
  {
    label: 'ใบเบิกสินค้า',
    items: [
      { label: 'รายการใบเบิก', path: '/requisitions', permission: PERMISSIONS.REQUISITION_READ },
      { label: 'สร้างใบเบิก', path: '/requisitions/new', permission: PERMISSIONS.REQUISITION_CREATE },
    ],
  },
  {
    label: 'ข้อมูลพื้นฐาน',
    items: [
      { label: 'วัตถุดิบ', path: '/master-data/ingredients', permission: PERMISSIONS.INGREDIENTS_READ },
      { label: 'หมวดหมู่', path: '/master-data/categories', permission: PERMISSIONS.CATEGORIES_READ },
      { label: 'หน่วยนับ', path: '/master-data/units', permission: PERMISSIONS.UNITS_READ },
      { label: 'Supplier', path: '/master-data/suppliers', permission: PERMISSIONS.SUPPLIERS_READ },
      { label: 'Zone', path: '/master-data/zones', permission: PERMISSIONS.ZONES_READ },
    ],
  },
  {
    label: 'จัดการระบบ',
    items: [
      { label: 'ผู้ใช้งาน', path: '/management/users', permission: PERMISSIONS.USERS_READ },
      { label: 'บทบาท', path: '/management/roles', permission: PERMISSIONS.ROLES_READ },
    ],
  },
]

/** First nav destination this user actually has permission to see -- used to redirect after login. */
export function getDefaultRouteForUser(user: { isSuperScope: boolean; permissions: string[] }): string {
  const has = (permission: PermissionCode) => user.isSuperScope || user.permissions.includes(permission)
  if (has(NAV_STANDALONE.permission)) {
    return NAV_STANDALONE.path
  }
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => has(candidate.permission))
    if (item) {
      return item.path
    }
  }
  return '/dashboard'
}
