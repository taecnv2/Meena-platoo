import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { useAuth } from '@/features/auth/AuthContext'
import { AuthLayout } from '@/layouts/AuthLayout'
import { LoadingState } from '@/components/LoadingState'
import { PERMISSIONS } from '@/constants/permissions'
import { getDefaultRouteForUser } from '@/constants/nav'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { IngredientsPage } from '@/pages/master-data/IngredientsPage'
import { CategoriesPage } from '@/pages/master-data/CategoriesPage'
import { UnitsPage } from '@/pages/master-data/UnitsPage'
import { SuppliersPage } from '@/pages/master-data/SuppliersPage'
import { ZonesPage } from '@/pages/master-data/ZonesPage'
import { StockBalancePage } from '@/pages/inventory/StockBalancePage'
import { StockInPage } from '@/pages/inventory/StockInPage'
import { StockOutPage } from '@/pages/inventory/StockOutPage'
import { AdjustmentPage } from '@/pages/inventory/AdjustmentPage'
import { TransfersPage } from '@/pages/inventory/TransfersPage'
import { MovementsPage } from '@/pages/inventory/MovementsPage'
import { StockCountsPage } from '@/pages/stock-counts/StockCountsPage'
import { RequisitionsListPage } from '@/pages/requisitions/RequisitionsListPage'
import { CreateRequisitionPage } from '@/pages/requisitions/CreateRequisitionPage'
import { RequisitionDetailPage } from '@/pages/requisitions/RequisitionDetailPage'
import { PurchaseOrdersListPage } from '@/pages/purchasing/PurchaseOrdersListPage'
import { CreatePurchaseOrderPage } from '@/pages/purchasing/CreatePurchaseOrderPage'
import { PurchaseOrderDetailPage } from '@/pages/purchasing/PurchaseOrderDetailPage'
import { UsersPage } from '@/pages/management/UsersPage'
import { RolesPage } from '@/pages/management/RolesPage'

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />

      <Route element={<ProtectedRoute permission={PERMISSIONS.DASHBOARD_READ} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute permission={PERMISSIONS.INVENTORY_READ} />}>
        <Route path="/inventory/balances" element={<StockBalancePage />} />
        <Route path="/inventory/movements" element={<MovementsPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.INVENTORY_CREATE} />}>
        <Route path="/inventory/stock-in" element={<StockInPage />} />
        <Route path="/inventory/stock-out" element={<StockOutPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.INVENTORY_ADJUST} />}>
        <Route path="/inventory/adjust" element={<AdjustmentPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.TRANSFER_READ} />}>
        <Route path="/inventory/transfers" element={<TransfersPage />} />
      </Route>

      <Route element={<ProtectedRoute permission={PERMISSIONS.STOCK_COUNT_READ} />}>
        <Route path="/stock-counts" element={<StockCountsPage />} />
      </Route>

      <Route element={<ProtectedRoute permission={PERMISSIONS.REQUISITION_READ} />}>
        <Route path="/requisitions" element={<RequisitionsListPage />} />
        <Route path="/requisitions/:id" element={<RequisitionDetailPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.REQUISITION_CREATE} />}>
        <Route path="/requisitions/new" element={<CreateRequisitionPage />} />
      </Route>

      <Route element={<ProtectedRoute permission={PERMISSIONS.PURCHASING_READ} />}>
        <Route path="/purchasing" element={<PurchaseOrdersListPage />} />
        <Route path="/purchasing/:id" element={<PurchaseOrderDetailPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.PURCHASING_CREATE} />}>
        <Route path="/purchasing/new" element={<CreatePurchaseOrderPage />} />
      </Route>

      <Route element={<ProtectedRoute permission={PERMISSIONS.INGREDIENTS_READ} />}>
        <Route path="/master-data/ingredients" element={<IngredientsPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.CATEGORIES_READ} />}>
        <Route path="/master-data/categories" element={<CategoriesPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.UNITS_READ} />}>
        <Route path="/master-data/units" element={<UnitsPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.SUPPLIERS_READ} />}>
        <Route path="/master-data/suppliers" element={<SuppliersPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.ZONES_READ} />}>
        <Route path="/master-data/zones" element={<ZonesPage />} />
      </Route>

      <Route element={<ProtectedRoute permission={PERMISSIONS.USERS_READ} />}>
        <Route path="/management/users" element={<UsersPage />} />
      </Route>
      <Route element={<ProtectedRoute permission={PERMISSIONS.ROLES_READ} />}>
        <Route path="/management/roles" element={<RolesPage />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route element={<ProtectedRoute />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

function RootRedirect() {
  const { user, isLoading, isAuthenticated } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState />
      </div>
    )
  }
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={getDefaultRouteForUser(user)} replace />
}
