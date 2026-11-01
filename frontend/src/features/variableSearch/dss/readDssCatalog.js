// SCRUM-159: read the variables (time series) stored in an HEC-DSS version 7 file,
// entirely on the user's machine.
//
// A DSS file can be hundreds of MB, so nothing here loads the whole file. Every read is a
// small blob.slice(start, end), which the browser serves straight from disk.
//
// The layout below comes from HEC's open-source heclib (MIT license):
// https://github.com/HydrologicEngineeringCenter/hec-dss/tree/main/heclib/heclib_c/src
//   - zinit.c ............... word positions in the file header, bins and info blocks
//   - zcatalogInternal.c .... how the pathname bins are walked
//   - ztsInternalHeaderUnpack.c, ztsDisaggregate.c, ztsRegRepeatUncompress.c ... time-series records
//
// The short version:
//   - The file is little-endian and addressed in 8-byte "words": word N starts at byte N * 8.
//   - It starts with "ZDSS"; the version text (for example "7-JA") starts at byte 16.
//   - Every record's pathname /A/B/C/D/E/F/ sits in a "bin". Bins are grouped into blocks, and
//     the word right after a block holds the address of the next block (0 = no more blocks).
//   - A bin entry points at the record's "info block", which points at the record's
//     "internal header" (units, data type, ...) and its stored values.
//   - A time series is split into one record per time block (a decade of monthly values, a year
//     of daily values, ...). The D part is the block's start date, e.g. 01JAN1920.

const WORD = 8;
const DAY_MS = 86400000;
const JULIAN_DAY_ZERO_MS = Date.UTC(1899, 11, 31); // DSS counts days from 31DEC1899 (day 1 = 01JAN1900)
const MONTHS = 'JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC';

// File header word positions (zdssFileKeys in zinit.c).
const FILE_SIZE = 5;
const BINS_PER_BLOCK = 21;
const BIN_SIZE = 23;
const FIRST_BIN = 24;

// Word positions inside one bin entry (zdssBinKeys). Some words hold two 4-byte ints.
const BIN_STATUS = 1;
const BIN_PATH_LENGTH = 2; // low int: characters, high int: words
const BIN_INFO_ADDRESS = 3;
const BIN_DATA_TYPE = 4; // low int
const BIN_DATES = 6; // low int: first day, high int: last day (time series only)
const BIN_PATH = 7;
const RECORD_STATUS_ALIAS = 2; // statuses above this are deleted / renamed records

// Word positions in a record's info block (zdssInfoKeys).
const INFO_FLAG = -97534;
const INFO_FIRST_VALUE = 9; // low int: day, high int: seconds into that day
const INFO_LAST_VALUE = 10;
const INFO_HEADER_ADDRESS = 13; // the time-series internal header
const INFO_HEADER_INTS = 14;
const INFO_HEADER2_ADDRESS = 15; // the repeat-compression bits
const INFO_HEADER2_INTS = 16;
const INFO_VALUES_ADDRESS = 19;
const INFO_VALUES_INTS = 20;
const INFO_NUMBER_STORED = 26;
const INFO_READ_WORDS = 128; // info block + pathname + (usually) the internal header right after it

// 4-byte int positions in a time series' internal header (INT_HEAD_* in zStructAllocation.h).
const HEAD_TIME_OFFSET = 2;
const HEAD_BLOCK_START = 4; // position of the first stored value inside its time block
const HEAD_VALUES_INTS = 6;
const HEAD_VALUE_SIZE = 7; // 1 = float, 2 = double
const HEAD_COMPRESSION = 9; // 0 = none, 1 = repeat bits in header2, 2 = every value the same
const HEAD_UNITS = 17; // units, data type and time zone follow as '\0'-separated text

// Record types (zdataTypeDescriptions.h): float and double versions of each.
const REGULAR_SERIES = [100, 105];
const IRREGULAR_SERIES = [110, 115];

// Values DSS stores in place of "no value" (zisMissing in zmissingFlag.c).
const MISSING_VALUES = [-901, -902, -3.4028234663852886e38];

const ERROR_MESSAGES = {
  'not-dss': 'This file is not an HEC-DSS file.',
  'unsupported-version': 'Only HEC-DSS version 7 files are supported.',
  corrupt: 'The DSS file is damaged or incomplete.',
};

/** Thrown when a file can't be read as DSS 7. `code` is 'not-dss', 'unsupported-version' or 'corrupt'. */
export class DssFormatError extends Error {
  constructor(code, options) {
    super(ERROR_MESSAGES[code], options);
    this.name = 'DssFormatError';
    this.code = code;
  }
}

/**
 * List every time series in a DSS 7 file, one entry per series (its D-part blocks are merged).
 *
 * @param {Blob} blob  the File the user picked (any Blob works)
 * @returns {Promise<Array<{ a: string, b: string, c: string, e: string, f: string,
 *   units: string, dataType: string, startMonth: string, endMonth: string }>>}
 *   startMonth / endMonth are 'YYYY-MM' of the first and last stored value
 * @throws {DssFormatError}
 */
export async function readDssCatalog(blob) {
  return withDssErrors(async () => {
    // Remember each series' earliest and latest block; only those two records need reading.
    const seriesByKey = new Map();
    for (const entry of await readEntries(blob)) {
      const series = seriesByKey.get(entry.key);
      if (!series) {
        seriesByKey.set(entry.key, { first: entry, last: entry });
      } else {
        if (entry.firstDay < series.first.firstDay) series.first = entry;
        if (entry.lastDay > series.last.lastDay) series.last = entry;
      }
    }

    // The reads don't depend on each other, so let them all run at once.
    return Promise.all([...seriesByKey.values()].map(async ({ first, last }) => {
      const record = await readRecord(blob, first);
      const lastInfo = last === first ? record.info : (await readRecord(blob, last)).info;
      return {
        a: first.a,
        b: first.b,
        c: first.c,
        e: first.e,
        f: first.f,
        units: record.units,
        dataType: record.dataType,
        startMonth: infoDate(record.info, INFO_FIRST_VALUE).slice(0, 7),
        endMonth: infoDate(lastInfo, INFO_LAST_VALUE).slice(0, 7),
      };
    }));
  });
}

/**
 * Read every stored value of one regular time series, across all of its D-part blocks.
 *
 * @param {Blob} blob
 * @param {{ a: string, b: string, c: string, e: string, f: string }} parts  as returned by readDssCatalog
 * @returns {Promise<Array<{ date: string, value: number }>>} in date order; date is 'YYYY-MM-DD' of
 *   the value's own DSS timestamp (monthly PER-AVER values are stamped at the end of the month).
 *   Missing values are skipped. Resolves [] for an unknown series, an irregular series, or an
 *   interval this reader doesn't handle (weekly, semi-month, tri-month).
 * @throws {DssFormatError}
 */
export async function readDssSeries(blob, { a, b, c, e, f }) {
  return withDssErrors(async () => {
    const key = seriesKey(a, b, c, e, f);
    const records = (await readEntries(blob))
      .filter((entry) => entry.key === key && entry.regular)
      .sort((left, right) => left.firstDay - right.firstDay);
    const step = parseInterval(e);
    if (!records.length || !step) return [];

    const points = [];
    for (const entry of records) {
      const record = await readRecord(blob, entry);
      const values = await readValues(blob, record);
      const blockStart = parseBlockDate(entry.d);
      const firstPosition = record.header.getInt32(HEAD_BLOCK_START * 4, true);
      const offsetSeconds = record.header.getInt32(HEAD_TIME_OFFSET * 4, true);
      values.forEach((value, index) => {
        if (MISSING_VALUES.includes(value)) return;
        const time = valueTime(blockStart, step, firstPosition + index, offsetSeconds);
        points.push({ date: toDssDate(time), value });
      });
    }
    return points;
  });
}

// Turn anything unexpected (reading past the end, a bad DataView offset, ...) into 'corrupt'.
async function withDssErrors(work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DssFormatError) throw error;
    throw new DssFormatError('corrupt', { cause: error });
  }
}

// Read `words` 8-byte words starting at word `address`.
async function readWords(blob, address, words) {
  const start = address * WORD;
  const end = start + words * WORD;
  if (!(address >= 0 && words >= 0 && end <= blob.size)) throw new DssFormatError('corrupt');
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

// One whole word. Addresses fit easily in a JS number, so no BigInt needed.
function word(view, index) {
  return view.getUint32(index * WORD, true) + view.getInt32(index * WORD + 4, true) * 2 ** 32;
}

// heclib often packs two 4-byte ints into one word (its i8toi4).
function lowInt(view, index) {
  return view.getInt32(index * WORD, true);
}

function highInt(view, index) {
  return view.getInt32(index * WORD + 4, true);
}

const latin1 = new TextDecoder('latin1');

function text(view, byteOffset, length) {
  return latin1.decode(new Uint8Array(view.buffer, view.byteOffset + byteOffset, length));
}

function seriesKey(a, b, c, e, f) {
  // DSS pathnames are case-insensitive.
  return [a, b, c, e, f].join('/').toUpperCase();
}

/**
 * Check the file header, then walk every pathname bin and return the time-series records.
 * Each entry: { a, b, c, d, e, f, key, regular, infoAddress, firstDay, lastDay }.
 */
async function readEntries(blob) {
  const head = new DataView(await blob.slice(0, 1024).arrayBuffer());
  if (head.byteLength < 4 || text(head, 0, 4) !== 'ZDSS') throw new DssFormatError('not-dss');
  // Same check as heclib's zgetFileVersion: the version text's first character.
  if (head.byteLength > 16 && text(head, 16, 1) !== '7') throw new DssFormatError('unsupported-version');
  if (head.byteLength < (FIRST_BIN + 1) * WORD) throw new DssFormatError('corrupt');

  // The header records where the file ends; a shorter file was cut off (for example, a partial copy).
  if ((word(head, FILE_SIZE) + 1) * WORD > blob.size) throw new DssFormatError('corrupt');

  const binsPerBlock = word(head, BINS_PER_BLOCK);
  const binSize = word(head, BIN_SIZE);
  if (!(binsPerBlock > 0 && binSize > BIN_PATH + 2)) throw new DssFormatError('corrupt');

  const entries = [];
  const visitedBlocks = new Set();
  let block = word(head, FIRST_BIN);
  while (block !== 0) {
    // A block that points back at an earlier one would loop forever.
    if (visitedBlocks.has(block)) throw new DssFormatError('corrupt');
    visitedBlocks.add(block);

    // One read per block: all of its bins plus the next-block address after them.
    const view = await readWords(blob, block, binsPerBlock * binSize + 1);
    for (let bin = 0; bin < binsPerBlock; bin += 1) {
      const binStart = bin * binSize;
      // Bins are filled in order, so the first empty one means there are no more pathnames.
      if (word(view, binStart) === 0) return entries;

      // Entries sit back to back; a zero hash ends the bin. The last 2 words are reserved.
      let position = binStart;
      while (position < binStart + binSize - 2 && word(view, position) !== 0) {
        const pathChars = lowInt(view, position + BIN_PATH_LENGTH);
        const pathWords = highInt(view, position + BIN_PATH_LENGTH);
        if (pathChars < 1 || pathChars > pathWords * WORD || position + BIN_PATH + pathWords > binStart + binSize) {
          throw new DssFormatError('corrupt');
        }

        const dataType = lowInt(view, position + BIN_DATA_TYPE);
        const regular = REGULAR_SERIES.includes(dataType);
        const status = lowInt(view, position + BIN_STATUS);
        if (status <= RECORD_STATUS_ALIAS && (regular || IRREGULAR_SERIES.includes(dataType))) {
          const parts = text(view, (position + BIN_PATH) * WORD, pathChars).split('/');
          if (parts.length !== 8) throw new DssFormatError('corrupt');
          const [, a, b, c, d, e, f] = parts;
          entries.push({
            a, b, c, d, e, f,
            key: seriesKey(a, b, c, e, f),
            regular,
            infoAddress: word(view, position + BIN_INFO_ADDRESS),
            firstDay: lowInt(view, position + BIN_DATES),
            lastDay: highInt(view, position + BIN_DATES),
          });
        }
        position += BIN_PATH + pathWords;
      }
    }
    block = word(view, binsPerBlock * binSize);
  }
  return entries;
}

// Read a record's info block and time-series internal header (units, data type, layout).
async function readRecord(blob, entry) {
  const wordsLeft = Math.floor(blob.size / WORD) - entry.infoAddress;
  const info = await readWords(blob, entry.infoAddress, Math.min(INFO_READ_WORDS, wordsLeft));
  if (info.byteLength < (INFO_NUMBER_STORED + 1) * WORD || word(info, 0) !== INFO_FLAG) {
    throw new DssFormatError('corrupt');
  }

  // heclib writes the internal header right after the info block, so it's usually already in `info`.
  const headerAddress = word(info, INFO_HEADER_ADDRESS);
  const headerInts = word(info, INFO_HEADER_INTS);
  if (headerInts <= HEAD_UNITS) throw new DssFormatError('corrupt');
  const headerWords = Math.ceil(headerInts / 2);
  const offset = headerAddress - entry.infoAddress;
  const header = offset >= 0 && (offset + headerWords) * WORD <= info.byteLength
    ? new DataView(info.buffer, info.byteOffset + offset * WORD, headerInts * 4)
    : await readWords(blob, headerAddress, headerWords);

  // The text starts at int 18 when int 17 is padding (0 or 4 spaces), or at int 17 in older records.
  const padding = header.getInt32(HEAD_UNITS * 4, true);
  const textStart = padding === 0 || padding === 0x20202020 ? HEAD_UNITS + 1 : HEAD_UNITS;
  const [units = '', dataType = ''] = text(header, textStart * 4, (headerInts - textStart) * 4)
    .split('\0')
    .map((part) => part.trim());

  return { info, header, units, dataType };
}

// Unpack a regular series record's stored values (one per position, missing markers included).
async function readValues(blob, { info, header }) {
  const count = word(info, INFO_NUMBER_STORED);
  const valueSize = header.getInt32(HEAD_VALUE_SIZE * 4, true);
  const compression = header.getInt32(HEAD_COMPRESSION * 4, true);
  if (header.getInt32(HEAD_VALUES_INTS * 4, true) === 0) return []; // nothing but missing values
  if (valueSize !== 1 && valueSize !== 2) throw new DssFormatError('corrupt');

  const data = await readWords(blob, word(info, INFO_VALUES_ADDRESS), Math.ceil(word(info, INFO_VALUES_INTS) / 2));
  const stored = (index) => (valueSize === 1 ? data.getFloat32(index * 4, true) : data.getFloat64(index * 8, true));
  if (compression === 0) return Array.from({ length: count }, (_, index) => stored(index));
  if (compression === 2) return Array(count).fill(stored(0));
  if (compression !== 1) throw new DssFormatError('corrupt');

  // Repeat compression: bit i of header2 (32 bits per int, lowest bit first) is 1 when value i
  // repeats value i - 1; otherwise the next stored value is used.
  const bits = await readWords(blob, word(info, INFO_HEADER2_ADDRESS), Math.ceil(word(info, INFO_HEADER2_INTS) / 2));
  const values = [];
  let next = 0;
  for (let index = 0; index < count; index += 1) {
    const repeat = index > 0 && (bits.getInt32((index >> 5) * 4, true) >>> (index & 31)) & 1;
    values.push(repeat ? values[index - 1] : stored(next++));
  }
  return values;
}

// The E part names the interval: 1MON / 1Month, 1DAY / 1Day, 15MIN / 15Minute, 1HOUR, 1YEAR, ...
// Returns { seconds } or { months } per interval, or null if this reader doesn't handle it.
function parseInterval(e) {
  const match = /^(\d+)(SEC|MIN|HOUR|DAY|MON|YEAR)/i.exec(e);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'MON') return { months: amount };
  if (unit === 'YEAR') return { months: amount * 12 };
  return { seconds: amount * { SEC: 1, MIN: 60, HOUR: 3600, DAY: 86400 }[unit] };
}

// The D part of a regular series is its block's start date, e.g. 01JAN1920 (midnight, UTC).
function parseBlockDate(d) {
  const match = /^(\d{1,2})([A-Z]{3})(\d{4})$/i.exec(d);
  const month = match ? MONTHS.indexOf(match[2].toUpperCase()) : -1;
  if (month < 0 || month % 3) throw new DssFormatError('corrupt');
  return { year: Number(match[3]), month: month / 3, day: Number(match[1]) };
}

// Time (UTC ms) of the value at `position` inside a block. Values are normally stamped at the end
// of their interval, so position 0 is one interval after the block starts. A time offset instead
// stamps each value that many seconds after its interval starts (e.g. daily readings at 08:00).
function valueTime({ year, month, day }, step, position, offsetSeconds) {
  const intervals = offsetSeconds > 0 ? position : position + 1;
  const start = step.months
    ? Date.UTC(year, month + intervals * step.months, day)
    : Date.UTC(year, month, day) + intervals * step.seconds * 1000;
  return start + (offsetSeconds > 0 ? offsetSeconds * 1000 : 0);
}

// Date of the first / last stored value from an info block (day number + seconds into that day).
function infoDate(info, index) {
  return toDssDate(JULIAN_DAY_ZERO_MS + lowInt(info, index) * DAY_MS + highInt(info, index) * 1000);
}

// DSS stamps the end of a day as 24:00 of that day, so an exact midnight belongs to the day before.
function toDssDate(time) {
  return new Date(time % DAY_MS === 0 ? time - DAY_MS : time).toISOString().slice(0, 10);
}
