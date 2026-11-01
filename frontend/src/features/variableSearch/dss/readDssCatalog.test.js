import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDssCatalog, readDssSeries } from './readDssCatalog.js';

// calsim_sample.dss was written by HEC's official `hecdss` library, and calsim_sample.json is what
// that same library read back from it. See fixtures/make_fixtures.py for how both were made.
const fixtureBytes = readFileSync(`${import.meta.dirname}/fixtures/calsim_sample.dss`);
const expected = JSON.parse(readFileSync(`${import.meta.dirname}/fixtures/calsim_sample.json`, 'utf8'));

const fixture = () => new Blob([fixtureBytes]);
const pathKey = ({ a, b, c, e, f }) => [a, b, c, e, f].join('/');
const sortByPath = (list) => [...list].sort((left, right) => pathKey(left).localeCompare(pathKey(right)));
const findSeries = (b, c) => expected.series.find((series) => series.b === b && series.c === c);

// A copy of the fixture with some bytes changed.
function patchedFixture(patch) {
  const bytes = new Uint8Array(fixtureBytes);
  patch(bytes, new DataView(bytes.buffer));
  return new Blob([bytes]);
}

describe('readDssCatalog (SCRUM-159)', () => {
  it('lists every time series with the units, type and dates the official library reports', async () => {
    const wanted = expected.series.map(({ a, b, c, e, f, units, dataType, startMonth, endMonth }) => (
      { a, b, c, e, f, units, dataType, startMonth, endMonth }
    ));

    expect(sortByPath(await readDssCatalog(fixture()))).toEqual(sortByPath(wanted));
  });

  it('merges the D-part blocks of a series and skips records that are not time series', async () => {
    const catalog = await readDssCatalog(fixture());

    // The library stores Shasta storage as 4 decade records, plus a paired-data and a text record.
    expect(expected.records.filter((record) => record.path.includes('/S_SHSTA/STORAGE/'))).toHaveLength(4);
    expect(expected.records.map((record) => record.recordType)).toEqual(expect.arrayContaining([205, 300]));

    expect(catalog.filter((series) => series.b === 'S_SHSTA')).toEqual([
      { a: 'CALSIM', b: 'S_SHSTA', c: 'STORAGE', e: '1Month', f: 'L2020A', units: 'TAF', dataType: 'PER-AVER', startMonth: '1921-10', endMonth: '1951-09' },
    ]);
    expect(catalog.map((series) => series.c)).not.toContain('STORAGE-AREA');
    expect(catalog.map((series) => series.b)).not.toContain('README');
  });
});

describe('readDssSeries (SCRUM-159)', () => {
  it('reads every stored value of each regular series exactly as the official library does', async () => {
    const regular = expected.series.filter((series) => series.regular);
    expect(regular.length).toBeGreaterThan(5);

    for (const series of regular) {
      expect(await readDssSeries(fixture(), series), pathKey(series)).toEqual(series.points);
    }
  });

  it('stamps monthly values at the end of the month and spans every decade block', async () => {
    const storage = await readDssSeries(fixture(), findSeries('S_SHSTA', 'STORAGE'));

    expect(storage).toHaveLength(360);
    expect(storage[0].date).toBe('1921-10-31');
    expect(storage[1].date).toBe('1921-11-30');
    expect(storage.at(-1).date).toBe('1951-09-30');
  });

  it('reads the water-year type as whole numbers 1-5', async () => {
    const yearTypes = await readDssSeries(fixture(), findSeries('WYT_SAC_', 'WATERYEARTYPE'));

    expect(yearTypes).toHaveLength(360);
    expect(new Set(yearTypes.map((point) => point.value))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('skips missing values', async () => {
    const shortage = await readDssSeries(fixture(), findSeries('DEL_SAC_NOD', 'DELIVERY-SHORTAGE'));

    // 24 months were written; 3 leading and 3 interior ones were missing markers.
    expect(shortage).toHaveLength(18);
    expect(shortage[0].date).toBe('1922-01-31');
  });

  it('resolves [] for irregular series and series that are not in the file', async () => {
    // Irregular series appear in the catalog, but reading their values isn't supported yet.
    expect(await readDssSeries(fixture(), findSeries('GAGE_KESWICK', 'FLOW-GAGE'))).toEqual([]);
    expect(await readDssSeries(fixture(), { a: 'CALSIM', b: 'NOPE', c: 'STORAGE', e: '1Month', f: 'L2020A' })).toEqual([]);
  });
});

describe('DSS format errors', () => {
  it("rejects files that aren't DSS with 'not-dss'", async () => {
    let seed = 7;
    const randomBytes = Uint8Array.from({ length: 4096 }, () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) & 0xff);

    await expect(readDssCatalog(new Blob([randomBytes]))).rejects.toMatchObject({ name: 'DssFormatError', code: 'not-dss' });
    await expect(readDssCatalog(new Blob([]))).rejects.toMatchObject({ code: 'not-dss' });
  });

  it("rejects other DSS versions with 'unsupported-version'", async () => {
    // hecdss can't write a DSS 6 file, so patch the version text at byte 16 from "7" to "6".
    // make_fixtures.py checked that the official library then reports version 6.
    expect(expected.fileVersion).toMatchObject({ fixture: 7, versionByte16Patched6: 6 });
    const version6 = patchedFixture((bytes) => { bytes[16] = '6'.charCodeAt(0); });

    await expect(readDssCatalog(version6)).rejects.toMatchObject({ code: 'unsupported-version' });
  });

  it("rejects truncated or scrambled files with 'corrupt'", async () => {
    const truncated = new Blob([fixtureBytes.subarray(0, fixtureBytes.length / 2)]);
    const scrambledBins = patchedFixture((bytes, view) => {
      const firstBin = view.getUint32(24 * 8, true); // file header word 24: address of the first bin
      bytes.fill(0xff, firstBin * 8, firstBin * 8 + 64);
    });

    await expect(readDssCatalog(truncated)).rejects.toMatchObject({ code: 'corrupt' });
    await expect(readDssCatalog(scrambledBins)).rejects.toMatchObject({ code: 'corrupt' });
    await expect(readDssCatalog(null)).rejects.toMatchObject({ code: 'corrupt' });
  });

  it('readDssSeries reports errors the same way', async () => {
    const storage = findSeries('S_SHSTA', 'STORAGE');

    await expect(readDssSeries(new Blob(['hello']), storage)).rejects.toMatchObject({ code: 'not-dss' });
    await expect(readDssSeries(new Blob([fixtureBytes.subarray(0, 4000)]), storage)).rejects.toMatchObject({ code: 'corrupt' });
  });
});
