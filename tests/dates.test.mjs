import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays, addYears, cycleEnd, gaps, day} from '../scripts/dates.mjs';

test('calendar deadlines include day 30; anniversary handles leap day', () => {
  assert.equal(addDays('2026-02-18', 30), '2026-03-20');
  assert.equal(addYears('2024-02-29', 2), '2026-02-28');
  assert.equal(cycleEnd('2026-05-01'), '2027-04-30');
  assert.throws(() => day('2026-02-30'));
});
test('gap union covers overlaps, part-time and ongoing entries', () => {
  const entries = [
    {from_date: '2020-07-01', to_date: '2023-06-30'},
    {from_date: '2022-01-01', to_date: '2023-07-01', hours_per_week: '8'},
    {from_date: '2023-08-01', to_date: ''}
  ];
  assert.deepEqual(gaps(entries, '2020-06-30', '2026-03-16'), [{from:'2023-07-02',to:'2023-07-31',days:30}]);
  entries[2].from_date = '2023-07-31';
  assert.deepEqual(gaps(entries, '2020-06-30', '2026-03-16'), []);
});
