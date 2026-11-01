// UTC calendar arithmetic. All business clocks are supplied by the export.
export function day(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}`);
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value) throw new Error(`Invalid date: ${value}`);
  return d;
}
export const iso = value => value.toISOString().slice(0, 10);
export function addDays(value, count) { const d = day(value); d.setUTCDate(d.getUTCDate() + count); return iso(d); }
export function addYears(value, count) {
  const d = day(value), month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + count);
  if (d.getUTCMonth() !== month) d.setUTCDate(0);
  return iso(d);
}
export const inclusiveDays = (start, end) => (day(end) - day(start)) / 86400000 + 1;
export const cycleEnd = start => addDays(addYears(start, 1), -1);

// Union every covering interval: training, overlaps and part-time work all count.
export function gaps(entries, schoolEnd, asOf) {
  let cursor = addDays(schoolEnd, 1);
  const result = [];
  const intervals = entries.map(e => [e.from_date, e.to_date || asOf])
    .filter(([start, end]) => start <= asOf && end >= cursor).sort(([a], [b]) => a.localeCompare(b));
  for (const [start, end] of intervals) {
    day(start); day(end);
    if (end < start) throw new Error(`Reversed history interval: ${start} to ${end}`);
    if (start > cursor && inclusiveDays(cursor, addDays(start, -1)) >= 30)
      result.push({from: cursor, to: addDays(start, -1), days: inclusiveDays(cursor, addDays(start, -1))});
    if (end >= cursor) cursor = addDays(end, 1);
  }
  if (cursor <= asOf && inclusiveDays(cursor, asOf) >= 30)
    result.push({from: cursor, to: asOf, days: inclusiveDays(cursor, asOf)});
  return result;
}
