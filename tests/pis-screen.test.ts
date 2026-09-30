// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { parseLineData } from '../src/domain/map-data.ts';
import { buildRoute } from '../src/domain/geometry.ts';
import { calculateTrainStates } from '../src/domain/train-state.ts';
import { calculateStationArrivals } from '../src/domain/station-arrivals.ts';
import type { DomainTimetable } from '../src/domain/timetable.ts';
import { renderPisStation, renderPisTrain } from '../src/ui/pis-screen.ts';

const line = parseLineData(JSON.parse(readFileSync('src/data/line-b.geojson', 'utf8')));
const station = line.stations.find(s => s.id === 'b-central')!;
test('station PIS keeps the dwelling train until departure and varies detail by display mode', () => {
  const timetable: DomainTimetable = { trips: [{ tripId: 'DEMO-U1', vehicleId: 'V1', circulationId: 'C1', direction: 'up', classification: 'revenue', events: [
    { locationId: station.id, arrival: '10:00:20', departure: '10:00:50' },
    { locationId: 'b-west', arrival: '10:10:00' },
  ] }], circulations: [] };
  const renderAt = (seconds: number, mode: 'A' | 'B') => renderPisStation(station, calculateStationArrivals(36000 + seconds, station.id, timetable), line.stations, mode, 'LB-SPECIAL', new Date('2030-03-02T10:00:00+08:00'));
  assert.match(renderAt(0, 'A'), /即将进站/);
  assert.match(renderAt(20, 'A').replace(/<[^>]+>/gu, ''), /即将发车0分30秒/);
  assert.match(renderAt(20, 'B'), /即将进站/);
  assert.doesNotMatch(renderAt(20, 'B'), /pis-trip|运行图 <b>/);
  assert.doesNotMatch(renderAt(50, 'A'), /DEMO-U1/);
  assert.match(renderAt(20, 'A'), /星河站/);
});

for (const direction of ['up', 'down'] as const) {
  for (const mode of ['A', 'B'] as const) {
    for (const targetId of ['b-central', 'b-garden']) {
      test(`PIS arrival boundary, passed stops and transfers: ${direction}/${mode}/${targetId}`, () => {
        const ids = [...line.stations].reverse().map(s => s.id);
        const ordered = direction === 'up' ? ids : [...ids].reverse();
        const timetable: DomainTimetable = { trips: [{ tripId: 'DEMO01', vehicleId: 'V1', circulationId: 'C1', direction, classification: 'revenue', events: ordered.map((locationId, i) => ({ locationId, arrival: `10:${String(i * 3).padStart(2, '0')}:00`, departure: `10:${String(i * 3).padStart(2, '0')}:45` })) }], circulations: [{ circulationId: 'C1', vehicleId: 'V1', tripIds: ['DEMO01'], connections: [] }] };
        const arrival = 36000 + ordered.indexOf(targetId) * 180;
        for (const remaining of [31, 30, 1, 0, -44, -45]) {
          const seconds = arrival - remaining;
          const state = calculateTrainStates(seconds, timetable, buildRoute(line), line.lineId)[0]!;
          const doc = new DOMParser().parseFromString(renderPisTrain(state, line, timetable, line.stations, mode, seconds, new Set()), 'text/html');
          const target = doc.querySelector(`[data-station-id="${targetId}"]`)!;
          assert.equal(target.classList.contains('is-current'), remaining <= 30 && remaining > -45);
          assert.equal(target.classList.contains('is-past'), remaining === -45);
          assert.equal(doc.querySelectorAll('.pis-route-segment.is-running i').length, remaining > 30 || remaining === -45 ? 3 : 0);
          if (targetId === 'b-central') assert.ok(target.querySelector('.pis-transfer-inner-arrows'));
          else assert.ok(target.querySelector('.pis-stop-dot'));
          assert.equal(doc.querySelectorAll('.pis-train-footer').length, mode === 'A' ? 1 : 0);
        }
      });
    }
  }
}
