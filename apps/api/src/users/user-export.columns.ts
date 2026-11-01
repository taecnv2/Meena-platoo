import type { ExportColumn } from '../export/export-column.interface';
import type { SafeUser } from './users.service';

const STATUS_LABEL: Record<SafeUser['status'], string> = {
  ACTIVE: 'ใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
};

/** Transliterated from apps/web/src/pages/management/UsersPage.tsx's `columns` array. */
export function buildUserExportColumns(
  roleMap: Map<string, string>,
  zoneMap: Map<string, string>,
): Array<ExportColumn<SafeUser>> {
  return [
    { key: 'username', header: 'ชื่อผู้ใช้งาน', value: (row) => row.username },
    { key: 'name', header: 'ชื่อ-นามสกุล', value: (row) => row.name },
    { key: 'email', header: 'อีเมล', value: (row) => row.email },
    {
      key: 'role',
      header: 'บทบาท',
      value: (row) => roleMap.get(row.roleId.toString()) ?? '-',
    },
    {
      key: 'zones',
      header: 'Zone',
      value: (row) =>
        row.zoneIds
          .map((id) => zoneMap.get(id.toString()))
          .filter(Boolean)
          .join(', ') || 'ทั้งหมด',
    },
    {
      key: 'status',
      header: 'สถานะ',
      value: (row) => STATUS_LABEL[row.status],
    },
  ];
}
