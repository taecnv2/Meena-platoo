import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Boxes,
  Package,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  History,
  FileText,
  ListChecks,
  FilePlus,
  ShoppingCart,
  Trash2,
  Database,
  Wheat,
  Tags,
  Ruler,
  Truck,
  MapPin,
  Settings,
  Users,
  ShieldCheck,
  History as AuditHistory,
  BarChart3,
  MapPinned,
  ClipboardList,
  GitCompareArrows,
  Wallet,
} from 'lucide-react'
import { PERMISSIONS, type PermissionCode } from './permissions'

export interface NavItem {
  label: string
  path: string
  permission: PermissionCode
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

export const NAV_STANDALONE: NavItem = {
  label: 'ภาพรวม',
  path: '/dashboard',
  permission: PERMISSIONS.DASHBOARD_READ,
  icon: LayoutDashboard,
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'สต๊อกสินค้า',
    icon: Boxes,
    items: [
      { label: 'สต๊อกคงเหลือ', path: '/inventory/balances', permission: PERMISSIONS.INVENTORY_READ, icon: Package },
      { label: 'รับสินค้า', path: '/inventory/stock-in', permission: PERMISSIONS.INVENTORY_CREATE, icon: PackagePlus },
      { label: 'จ่ายสินค้า', path: '/inventory/stock-out', permission: PERMISSIONS.INVENTORY_CREATE, icon: PackageMinus },
      { label: 'โอนสินค้า', path: '/inventory/transfers', permission: PERMISSIONS.TRANSFER_READ, icon: ArrowLeftRight },
      { label: 'ปรับปรุงสต๊อก', path: '/inventory/adjust', permission: PERMISSIONS.INVENTORY_ADJUST, icon: SlidersHorizontal },
      { label: 'ตรวจนับสต๊อก', path: '/stock-counts', permission: PERMISSIONS.STOCK_COUNT_READ, icon: ClipboardCheck },
      { label: 'ประวัติการเคลื่อนไหว', path: '/inventory/movements', permission: PERMISSIONS.INVENTORY_READ, icon: History },
    ],
  },
  {
    label: 'ใบเบิกสินค้า',
    icon: FileText,
    items: [
      { label: 'รายการใบเบิก', path: '/requisitions', permission: PERMISSIONS.REQUISITION_READ, icon: ListChecks },
      { label: 'สร้างใบเบิก', path: '/requisitions/new', permission: PERMISSIONS.REQUISITION_CREATE, icon: FilePlus },
    ],
  },
  {
    label: 'จัดซื้อ',
    icon: ShoppingCart,
    items: [
      { label: 'ใบสั่งซื้อ', path: '/purchasing', permission: PERMISSIONS.PURCHASING_READ, icon: ListChecks },
      { label: 'สร้างใบสั่งซื้อ', path: '/purchasing/new', permission: PERMISSIONS.PURCHASING_CREATE, icon: FilePlus },
    ],
  },
  {
    label: 'ของเสีย',
    icon: Trash2,
    items: [{ label: 'รายการของเสีย', path: '/waste', permission: PERMISSIONS.WASTE_READ, icon: Trash2 }],
  },
  {
    label: 'รายงาน',
    icon: BarChart3,
    items: [
      { label: 'รายงานสต๊อก', path: '/reports/inventory', permission: PERMISSIONS.REPORTS_READ, icon: Wheat },
      { label: 'รายงานตาม Zone', path: '/reports/zone', permission: PERMISSIONS.REPORTS_READ, icon: MapPinned },
      { label: 'รายงานใบเบิกสินค้า', path: '/reports/requisition', permission: PERMISSIONS.REPORTS_READ, icon: ClipboardList },
      { label: 'รายงานจัดซื้อ', path: '/reports/purchase', permission: PERMISSIONS.REPORTS_READ, icon: ShoppingCart },
      { label: 'รายงานของเสีย', path: '/reports/waste', permission: PERMISSIONS.REPORTS_READ, icon: Trash2 },
      { label: 'รายงานต้นทุน', path: '/reports/cost', permission: PERMISSIONS.REPORTS_READ, icon: Wallet },
      { label: 'รายงานเปรียบเทียบ', path: '/reports/comparison', permission: PERMISSIONS.REPORTS_READ, icon: GitCompareArrows },
    ],
  },
  {
    label: 'ข้อมูลพื้นฐาน',
    icon: Database,
    items: [
      { label: 'วัตถุดิบ', path: '/master-data/ingredients', permission: PERMISSIONS.INGREDIENTS_READ, icon: Wheat },
      { label: 'หมวดหมู่', path: '/master-data/categories', permission: PERMISSIONS.CATEGORIES_READ, icon: Tags },
      { label: 'หน่วยนับ', path: '/master-data/units', permission: PERMISSIONS.UNITS_READ, icon: Ruler },
      { label: 'Supplier', path: '/master-data/suppliers', permission: PERMISSIONS.SUPPLIERS_READ, icon: Truck },
      { label: 'Zone', path: '/master-data/zones', permission: PERMISSIONS.ZONES_READ, icon: MapPin },
    ],
  },
  {
    label: 'จัดการระบบ',
    icon: Settings,
    items: [
      { label: 'ผู้ใช้งาน', path: '/management/users', permission: PERMISSIONS.USERS_READ, icon: Users },
      { label: 'บทบาท', path: '/management/roles', permission: PERMISSIONS.ROLES_READ, icon: ShieldCheck },
      { label: 'ประวัติการใช้งาน', path: '/management/audit-logs', permission: PERMISSIONS.AUDIT_READ, icon: AuditHistory },
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
