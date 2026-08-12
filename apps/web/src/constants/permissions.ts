export const PERMISSIONS = {
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

  STOCK_COUNT_READ: 'stockCount.read',
  STOCK_COUNT_CREATE: 'stockCount.create',
  STOCK_COUNT_APPROVE: 'stockCount.approve',

  PURCHASING_READ: 'purchasing.read',
  PURCHASING_CREATE: 'purchasing.create',
  PURCHASING_APPROVE: 'purchasing.approve',
  PURCHASING_RECEIVE: 'purchasing.receive',

  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DISABLE: 'users.disable',

  ROLES_READ: 'roles.read',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',

  PERMISSIONS_READ: 'permissions.read',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
