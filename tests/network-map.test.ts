// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { createNetworkMap, isNetworkTrainDisplayable } from '../src/ui/network-map.ts';
import type { TrainState } from '../src/domain/model.ts';
import { parseLineData } from '../src/domain/map-data.ts';
import { buildRoute } from '../src/domain/geometry.ts';

const lines = (['a', 'b'] as const).map(n => parseLineData(JSON.parse(readFileSync(`src/data/line-${n}.geojson`, 'utf8'))));
test('synthetic topology supports station selection, zoom and independent line visibility', () => {
  const container = document.createElement('section');
  let selected = '';
  const controller = createNetworkMap(container, lines, { routes: new Map(lines.map(l => [l.lineId, buildRoute(l)])), onStationSelect: s => { selected = s.id; } });
  assert.equal(container.querySelectorAll('[data-route]').length, 2);
  assert.equal(container.querySelectorAll('.network-station').length, 10);
  assert.equal(container.querySelector('[data-network-station="a-depot"]'), null);
  const station = container.querySelector<SVGGElement>('[data-network-station="a-central"]')!;
  station.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert.equal(selected, 'a-central');
  assert.equal(station.getAttribute('transform'), container.querySelector('[data-station="a-central"]')?.getAttribute('transform'));
  container.querySelector<HTMLButtonElement>('[data-network-zoom="in"]')!.click();
  assert.equal(container.querySelector<HTMLElement>('.network-canvas')?.style.width, '150%');
  controller.setLineVisible('MV-LB', false);
  assert.equal(container.querySelector<SVGElement>('[data-route="line-B"]')?.style.display, 'none');
  assert.equal(container.querySelector<SVGElement>('[data-route="line-A"]')?.style.display, '');
  controller.destroy();
  assert.equal(container.innerHTML, '');
});

test('topology shows passenger trains and excludes depot movements and offline services', () => {
  const container = document.createElement('section');
  const controller = createNetworkMap(container, lines, { routes: new Map(lines.map(l => [l.lineId, buildRoute(l)])) });
  const station = lines[0]!.stations.find(s => s.id === 'a-central')!;
  const base = { circulationId: 'C001', status: 'dwelling' as const, position: station.coordinates, lineId: 'MV-LA' as const, locationId: station.id, passengerService: true };
  const states: TrainState[] = [
    { ...base, vehicleId: 'passenger' },
    { ...base, vehicleId: 'non-revenue', passengerService: false },
    { ...base, vehicleId: 'depot-bound', destinationId: 'a-depot' },
    { ...base, vehicleId: 'offline', status: 'out-of-service' },
  ];
  assert.deepEqual(states.map(state => isNetworkTrainDisplayable(state, new Set(['a-depot']))), [true, false, false, false]);
  controller.update(states);
  assert.equal(container.querySelectorAll('.network-train').length, 1);
  assert.equal(container.querySelector<SVGGElement>('.network-train')?.dataset.vehicleId, 'passenger');
  controller.destroy();
});
