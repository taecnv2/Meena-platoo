import type { ExportColumn } from '../export/export-column.interface';
import type { Role } from './schemas/role.schema';

const STATUS_LABEL: Record<Role['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

/** Transliterated from apps/web/src/pages/management/RolesPage.tsx's `columns` array, with the
 * permission list spelled out in full (not just a count) since export is meant to be a complete
 * data dump, not a screen-width-constrained table. */
export function buildRoleExportColumns(
  permissionNameMap: Map<string, string>,
): Array<ExportColumn<Role>> {
  return [
    { key: 'name', header: 'ชื่อบทบาท', value: (row) => row.name },
    {
      key: 'description',
      header: 'คำอธิบาย',
      value: (row) => row.description || '-',
    },
    {
      key: 'permissionCount',
      header: 'จำนวนสิทธิ์',
      value: (row) => row.permissions.length,
      align: 'right',
    },
    {
      key: 'permissions',
      header: 'รายการสิทธิ์',
      value: (row) =>
        row.permissions
          .map((code) => permissionNameMap.get(code) ?? code)
          .join(', ') || '-',
    },
    {
      key: 'status',
      header: 'สถานะ',
      value: (row) => STATUS_LABEL[row.status],
    },
  ];
}
