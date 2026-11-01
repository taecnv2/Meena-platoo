import type { UnitType } from '../units/schemas/unit.schema';

/** Case/space-insensitive key used to match names and codes from a spreadsheet. */
export function normalizeKey(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

const WEIGHT_UNITS: Record<string, number> = {
  kg: 1,
  กก: 1,
  'กก.': 1,
  กิโล: 1,
  กิโลกรัม: 1,
  โล: 1,
  g: 0.001,
  กรัม: 0.001,
  'ก.': 0.001,
};

const VOLUME_UNITS: Record<string, number> = {
  l: 1,
  ลิตร: 1,
  ml: 0.001,
  มล: 0.001,
  'มล.': 0.001,
  มิลลิลิตร: 0.001,
};

/** Best guess for a unit created on the fly during import (kg/กรัม/ลิตร scale; everything else is a count). */
export function guessUnitType(name: string): {
  type: UnitType;
  conversionFactor: number;
} {
  const key = normalizeKey(name);
  if (key in WEIGHT_UNITS) {
    return { type: 'WEIGHT', conversionFactor: WEIGHT_UNITS[key] };
  }
  if (key in VOLUME_UNITS) {
    return { type: 'VOLUME', conversionFactor: VOLUME_UNITS[key] };
  }
  return { type: 'COUNT', conversionFactor: 1 };
}

/** A unit/category code from its display name: ASCII names are upper-cased, Thai names are kept as-is. */
export function codeFromName(name: string): string {
  return name.trim().replace(/\s+/g, '_').toUpperCase().slice(0, 40);
}

export function splitTags(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return [
    ...new Set(
      value
        .split(/[,;|]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}
