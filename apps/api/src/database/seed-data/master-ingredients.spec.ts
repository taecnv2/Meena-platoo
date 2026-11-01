import { CATEGORY_SEEDS, UNIT_SEEDS } from './master-data';
import { MASTER_INGREDIENTS } from './master-ingredients';

const nameKey = (value: string) => value.replace(/\s+/g, '').toLowerCase();

describe('MASTER_INGREDIENTS', () => {
  it('has unique codes and names', () => {
    const codes = MASTER_INGREDIENTS.map((item) => item.code);
    const names = MASTER_INGREDIENTS.map((item) => nameKey(item.name));
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only references seeded categories and units', () => {
    const categories = new Set<string>(CATEGORY_SEEDS.map((c) => c.code));
    const units = new Set<string>(UNIT_SEEDS.map((u) => u.code));
    for (const item of MASTER_INGREDIENTS) {
      expect(categories.has(item.category)).toBe(true);
      expect(units.has(item.unit)).toBe(true);
      for (const pack of item.packs ?? []) {
        expect(units.has(pack.unit)).toBe(true);
      }
    }
  });

  it('has valid pack conversions (positive, not the base unit, no duplicates)', () => {
    for (const item of MASTER_INGREDIENTS) {
      const packUnits = (item.packs ?? []).map((pack) => pack.unit);
      expect(packUnits).not.toContain(item.unit);
      expect(new Set(packUnits).size).toBe(packUnits.length);
      for (const pack of item.packs ?? []) {
        expect(pack.factor).toBeGreaterThan(0);
      }
    }
  });

  it('tags every item with where it is kept', () => {
    const places = ['ห้องสต๊อก', 'ครัว', 'ห้องเย็น', 'หน้าร้าน'];
    for (const item of MASTER_INGREDIENTS) {
      expect(places).toContain(item.tags[0]);
    }
  });
});
