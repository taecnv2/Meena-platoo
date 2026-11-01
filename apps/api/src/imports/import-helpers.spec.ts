import {
  codeFromName,
  guessUnitType,
  normalizeKey,
  splitTags,
} from './import-helpers';

describe('import helpers', () => {
  it('normalizes keys case/space-insensitively', () => {
    expect(normalizeKey('  Bangera   4/6 ')).toBe('bangera 4/6');
    expect(normalizeKey(undefined)).toBe('');
  });

  it('guesses weight/volume scale for well-known units, count otherwise', () => {
    expect(guessUnitType('กก.')).toEqual({
      type: 'WEIGHT',
      conversionFactor: 1,
    });
    expect(guessUnitType('กรัม')).toEqual({
      type: 'WEIGHT',
      conversionFactor: 0.001,
    });
    expect(guessUnitType('ml')).toEqual({
      type: 'VOLUME',
      conversionFactor: 0.001,
    });
    expect(guessUnitType('ลัง')).toEqual({
      type: 'COUNT',
      conversionFactor: 1,
    });
  });

  it('builds codes from names and splits tags', () => {
    expect(codeFromName('big bag')).toBe('BIG_BAG');
    expect(codeFromName('ถุง')).toBe('ถุง');
    expect(splitTags('portion, พนักงาน ,portion')).toEqual([
      'portion',
      'พนักงาน',
    ]);
  });
});
