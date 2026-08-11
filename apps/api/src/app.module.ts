import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { ZoneScopeGuard } from './common/guards/zone-scope.guard';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ZonesModule } from './zones/zones.module';
import { CategoriesModule } from './categories/categories.module';
import { UnitsModule } from './units/units.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { InventoryModule } from './inventory/inventory.module';
import { TransfersModule } from './transfers/transfers.module';
import { RequisitionsModule } from './requisitions/requisitions.module';
import { StockCountsModule } from './stock-counts/stock-counts.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    DatabaseModule,
    PermissionsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    ZonesModule,
    CategoriesModule,
    UnitsModule,
    SuppliersModule,
    IngredientsModule,
    StockMovementsModule,
    InventoryModule,
    TransfersModule,
    RequisitionsModule,
    StockCountsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: ZoneScopeGuard },
  ],
})
export class AppModule {}
