import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'vitest';
import { resolveActiveSchedules, isScheduleSelection } from '../src/domain/schedule-selection.ts';
import systemMap from '../src/data/system-map.json' with { type: 'json' };

test('every runtime event belongs to the synthetic sample network', () => {
  const ids = new Set(['a', 'b'].flatMap(line => {
    const geo = JSON.parse(readFileSync(`src/data/line-${line}.geojson`, 'utf8'));
    assert.equal(geo.sampleData, true);
    return geo.features.filter((f: { geometry: { type: string } }) => f.geometry.type === 'Point').map((f: { properties: { id: string } }) => f.properties.id);
  }));
  assert.equal(systemMap.sampleData, true);
  for (const route of systemMap.routes) for (const station of route.stations) assert.ok(ids.has(station.id));
  for (const file of readdirSync('src/data/runtime')) {
    const data = JSON.parse(readFileSync(`src/data/runtime/${file}`, 'utf8'));
    assert.match(file, /^l[ab]-[a-z-]+\.json$/);
    for (const trip of data.trips) assert.ok(trip.tripId.startsWith(file.slice(0, -5).toUpperCase() + '-'));
    for (const trip of data.trips) for (const event of trip.events) assert.ok(ids.has(event.locationId), `${file}: ${event.locationId}`);
  }
});

test('new synthetic schedules switch at exact demo boundaries and retain manual overrides', () => {
  for (const [at, a, b] of [
    ['2030-01-31T23:59:59+08:00', 'LA-NEXT', 'LB-WEEKDAY-NEXT'],
    ['2030-02-01T00:00:00+08:00', 'LA-EXPANDED', 'LB-WEEKDAY-NEXT'],
    ['2030-03-01T00:00:00+08:00', 'LA-SPECIAL', 'LB-SPECIAL'],
    ['2030-03-07T23:59:59+08:00', 'LA-SPECIAL', 'LB-SPECIAL'],
    ['2030-03-08T00:00:00+08:00', 'LA-EXPANDED', 'LB-WEEKDAY-NEXT'],
  ]) {
    const active = resolveActiveSchedules('auto', new Date(at!));
    assert.equal(active.lineA, a);
    assert.equal(active.lineB, b);
  }
  const manual = { mode: 'manual', lineA: 'LA-BASE', lineB: 'LB-SPECIAL' } as const;
  assert.equal(isScheduleSelection(manual), true);
  assert.equal(isScheduleSelection({ ...manual, lineA: 'unknown' }), false);
  const active = resolveActiveSchedules(manual, new Date('2030-03-02T12:00:00+08:00'));
  assert.equal(active.lineA, manual.lineA);
  assert.equal(active.lineB, manual.lineB);
});
