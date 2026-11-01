import { Badge } from '@/components/Badge'
import { INGREDIENT_IMPORT_COLUMNS, type ImportField } from '../ingredientImportColumns'

const COLUMN_MEANING: Record<ImportField, string> = {
  code: 'ใช้จับคู่กับวัตถุดิบที่มีอยู่แล้ว ถ้าเว้นว่างระบบจะจับคู่ด้วยชื่อ หรือสร้างรหัสให้อัตโนมัติ',
  name: 'ชื่อวัตถุดิบ / สินค้า',
  category: 'ชื่อหรือรหัสหมวดหมู่ ถ้ายังไม่มีในระบบ จะสร้างให้อัตโนมัติ',
  baseUnit: 'หน่วยที่ใช้นับสต๊อก เช่น ขวด, ถุง, กิโลกรัม ถ้ายังไม่มีจะสร้างให้อัตโนมัติ (เปลี่ยนหน่วยหลักของวัตถุดิบเดิมไม่ได้)',
  packUnit: 'หน่วยใหญ่ (ไม่บังคับ) เช่น ลัง, แพ็ค ใช้คู่กับ "จำนวนต่อแพ็ค"',
  packFactor: '1 หน่วยแพ็คมีกี่หน่วยหลัก เช่น หน่วยแพ็ค = ลัง, จำนวนต่อแพ็ค = 12 หมายถึง "1 ลัง = 12 ขวด"',
  minimumStock: 'จำนวนขั้นต่ำ (หน่วยหลัก) ต่ำกว่านี้ระบบจะแจ้งเตือนว่าใกล้หมด',
  maximumStock: 'จำนวนสูงสุดที่ควรเก็บ (หน่วยหลัก)',
  defaultCost: 'ราคาทุนต่อ 1 หน่วยหลัก (บาท)',
  tags: 'คำค้นหา/กลุ่มเพิ่มเติม คั่นด้วยจุลภาค (,) เช่น portion',
  consignmentOwner: 'ชื่อเจ้าของ ถ้าเป็นสินค้าฝากขาย (เว้นว่างถ้าเป็นของร้าน)',
  description: 'รายละเอียด / หมายเหตุ',
  zone: 'ชื่อหรือรหัส Zone ที่จะตั้งยอดยกมา (ต้องระบุเมื่อกรอกยอดยกมา)',
  openingQuantity:
    'ตั้งสต๊อกของ Zone นั้นให้เท่ากับตัวเลขนี้ (หน่วยหลัก) ไม่ใช่บวกเพิ่ม ต้องระบุ "Zone ยอดยกมา" ด้วย',
}

/** Compact reference of the template's columns, in template order. */
export function ImportColumnGuide() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">คำอธิบายคอลัมน์ในไฟล์นำเข้า</caption>
        <thead className="bg-slate-50 text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              หัวคอลัมน์
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              จำเป็น
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              ความหมาย
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {INGREDIENT_IMPORT_COLUMNS.map((column) => (
            <tr key={column.field}>
              <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium text-text-primary">
                {column.header}
              </th>
              <td className="px-3 py-2">
                {column.required ? <Badge color="danger">ต้องกรอก</Badge> : <span className="text-text-secondary">ไม่บังคับ</span>}
              </td>
              <td className="px-3 py-2 text-text-secondary">{COLUMN_MEANING[column.field]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
