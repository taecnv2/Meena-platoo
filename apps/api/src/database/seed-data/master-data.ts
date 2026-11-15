import type { UnitType } from '../../units/schemas/unit.schema';

/**
 * Starter categories/units matching the restaurant's stock lists. Upserted with $setOnInsert
 * only, so names/factors edited later in the UI are never overwritten by a re-seed.
 */
export const CATEGORY_SEEDS = [
  { code: 'FRESH', name: 'ของสด' },
  { code: 'SEAFOOD', name: 'อาหารทะเล' },
  { code: 'MEAT', name: 'เนื้อสัตว์' },
  { code: 'CURRY_PASTE', name: 'เครื่องแกง' },
  { code: 'PROCESSED', name: 'ของแปรรูป' },
  { code: 'PORTION', name: 'Portion' },
  { code: 'DRY_GOODS', name: 'เครื่องปรุงและของแห้ง' },
  { code: 'VEGETABLE', name: 'ผัก' },
  { code: 'BEVERAGE', name: 'เครื่องดื่ม' },
  { code: 'ALCOHOL', name: 'เครื่องดื่มแอลกอฮอล์' },
  { code: 'WINE', name: 'ไวน์' },
  { code: 'ICE_CREAM', name: 'ไอศกรีม' },
  { code: 'SUPPLIES', name: 'ของใช้ในร้าน' },
  { code: 'PACKAGING', name: 'แพ็คเกจ' },
  { code: 'STAFF', name: 'ของพนักงาน' },
  { code: 'OTHER', name: 'อื่นๆ' },
] as const satisfies ReadonlyArray<{ code: string; name: string }>;

export type CategorySeedCode = (typeof CATEGORY_SEEDS)[number]['code'];

export const UNIT_SEEDS = [
  { code: 'KG', name: 'กิโลกรัม', type: 'WEIGHT', conversionFactor: 1 },
  { code: 'G', name: 'กรัม', type: 'WEIGHT', conversionFactor: 0.001 },
  { code: 'L', name: 'ลิตร', type: 'VOLUME', conversionFactor: 1 },
  { code: 'ML', name: 'มิลลิลิตร', type: 'VOLUME', conversionFactor: 0.001 },
  { code: 'PCS', name: 'ชิ้น', type: 'COUNT', conversionFactor: 1 },
  { code: 'FISH', name: 'ตัว', type: 'COUNT', conversionFactor: 1 },
  { code: 'BAG', name: 'ถุง', type: 'COUNT', conversionFactor: 1 },
  { code: 'CASE', name: 'ลัง', type: 'COUNT', conversionFactor: 1 },
  { code: 'PACK', name: 'แพ็ค', type: 'COUNT', conversionFactor: 1 },
  { code: 'BOX', name: 'กล่อง', type: 'COUNT', conversionFactor: 1 },
  { code: 'BOTTLE', name: 'ขวด', type: 'COUNT', conversionFactor: 1 },
  { code: 'CAN', name: 'กระป๋อง', type: 'COUNT', conversionFactor: 1 },
  { code: 'SHEET', name: 'แผ่น', type: 'COUNT', conversionFactor: 1 },
  { code: 'BASKET', name: 'เข่ง', type: 'COUNT', conversionFactor: 1 },
  { code: 'PORTION', name: 'ที่', type: 'COUNT', conversionFactor: 1 },
  { code: 'PKT', name: 'ห่อ', type: 'COUNT', conversionFactor: 1 },
  { code: 'SACHET', name: 'ซอง', type: 'COUNT', conversionFactor: 1 },
  { code: 'ROLL', name: 'ม้วน', type: 'COUNT', conversionFactor: 1 },
  { code: 'JAR', name: 'กระปุก', type: 'COUNT', conversionFactor: 1 },
  { code: 'SACK', name: 'กระสอบ', type: 'COUNT', conversionFactor: 1 },
  { code: 'CUP', name: 'ถ้วย', type: 'COUNT', conversionFactor: 1 },
  { code: 'EGG', name: 'ฟอง', type: 'COUNT', conversionFactor: 1 },
  { code: 'EGG_TRAY', name: 'แผง', type: 'COUNT', conversionFactor: 1 },
] as const satisfies ReadonlyArray<{
  code: string;
  name: string;
  type: UnitType;
  conversionFactor: number;
}>;

export type UnitSeedCode = (typeof UNIT_SEEDS)[number]['code'];
