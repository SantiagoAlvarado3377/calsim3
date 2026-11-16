// Unit tests for the shared run model (SCRUM-125 / SCRUM-126).
// createRun is a pure function (same input -> same output, no side effects),
// so these tests don't render anything. No jsdom needed; we just call it.
import { describe, expect, it } from 'vitest';
import { createRun, RUN_STATUS } from './runModel.js';
 
// A fixed "now" so id and importedAt are predictable in every run of the tests.
// 2026-11-10T08:00:00.000Z -> getTime() = 1794297600000
const FIXED_NOW = new Date('2026-11-10T08:00:00.000Z');
 
// A stand-in for the browser File. createRun only reads .name, so a plain object
// is enough and keeps the test independent of jsdom.
const fakeFile = { name: 'scenario_2026.dss' };
 
describe('RUN_STATUS', () => {
  it('has exactly the three statuses the database allows', () => {
    // If someone adds a status here, the database schema (SCRUM-127) must allow it too.
    expect(Object.values(RUN_STATUS).sort()).toEqual(['failed', 'processing', 'ready']);
  });
 
  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(RUN_STATUS)).toBe(true);
  });
});
 
describe('createRun', () => {
  it('returns every field of the shared run shape with the right defaults', () => {
    const run = createRun({
      name: 'Scenario 2026',
      description: 'Wet year test',
      file: fakeFile,
      now: FIXED_NOW,
    });
 
    // toEqual checks the whole object, so a missing OR extra field fails the test.
    expect(run).toEqual({
      id: `run-${FIXED_NOW.getTime()}`,
      name: 'Scenario 2026',
      description: 'Wet year test',
      source: 'scenario_2026.dss',
      filePath: null,
      importedAt: '2026-11-10T08:00:00.000Z',
      status: 'ready',
      catalogSummary: null,
      file: fakeFile,
    });
  });
 
  it('trims the name and description', () => {
    const run = createRun({
      name: '   Scenario 2026  ',
      description: '  some notes \n',
      file: fakeFile,
      now: FIXED_NOW,
    });
    expect(run.name).toBe('Scenario 2026');
    expect(run.description).toBe('some notes');
  });
 
  it('turns a missing description into an empty string', () => {
    // Left out entirely
    expect(createRun({ name: 'A', file: fakeFile, now: FIXED_NOW }).description).toBe('');
    // Explicit null / undefined
    expect(createRun({ name: 'A', description: null, file: fakeFile, now: FIXED_NOW }).description).toBe('');
    expect(createRun({ name: 'A', description: undefined, file: fakeFile, now: FIXED_NOW }).description).toBe('');
    // Only spaces -> trimmed to empty
    expect(createRun({ name: 'A', description: '   ', file: fakeFile, now: FIXED_NOW }).description).toBe('');
  });
 
  it('builds id and importedAt from the given now', () => {
    const run = createRun({ name: 'A', file: fakeFile, now: FIXED_NOW });
    expect(run.id).toBe('run-1794297600000');
    expect(run.importedAt).toBe('2026-11-10T08:00:00.000Z');
  });
 
  it('takes source from file.name', () => {
    const run = createRun({ name: 'A', file: { name: 'DCR2023_DV_9.3.1.dss' }, now: FIXED_NOW });
    expect(run.source).toBe('DCR2023_DV_9.3.1.dss');
  });
 
  it('gives new runs status ready (no processing step yet)', () => {
    const run = createRun({ name: 'A', file: fakeFile, now: FIXED_NOW });
    expect(run.status).toBe(RUN_STATUS.READY);
  });
 
  it('keeps the same File object so Variable Search can still read it', () => {
    const run = createRun({ name: 'A', file: fakeFile, now: FIXED_NOW });
    expect(run.file).toBe(fakeFile); // same reference, not a copy
  });
 
  it('uses the real current time when now is not given', () => {
    const before = Date.now();
    const run = createRun({ name: 'A', file: fakeFile });
    const after = Date.now();
    const stamp = Number(run.id.replace('run-', ''));
    // The id's timestamp must fall between the two readings around the call.
    expect(stamp >= before && stamp <= after).toBe(true);
    expect(new Date(run.importedAt).getTime()).toBe(stamp);
  });
});