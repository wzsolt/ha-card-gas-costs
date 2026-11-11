const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

export function numeric(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Represent calendar dates as UTC dates for date arithmetic only. Resolve each
// local midnight separately because its UTC offset can differ from today's.
export function calendar(zone, now) {
  const dateFormat = new Intl.DateTimeFormat("en", {
    timeZone: zone, year: "numeric", month: "numeric", day: "numeric",
  });
  const clockFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  function localDate(time) {
    const parts = dateFormat.formatToParts(time);
    const part = (name) => Number(parts.find(({ type }) => type === name).value);
    return Date.UTC(part("year"), part("month") - 1, part("day"));
  }
  function midnight(date) {
    // Find the first instant of the local date, including dates whose clock
    // jumps at midnight. The search window covers all current UTC offsets.
    let low = date - 26 * hour;
    let high = date + 26 * hour;
    while (high - low > 1) {
      const middle = Math.floor((high + low) / 2);
      if (localDate(middle) < date) low = middle;
      else high = middle;
    }
    return high;
  }
  const today = localDate(now);
  const start = midnight(today);
  const end = midnight(today + day);
  const hourly = [];
  let previousClockMinute;
  for (let time = start; time < end; time += minute) {
    const label = clockFormat.format(time);
    const clockMinute = Number(label.slice(0, 2)) * 60 + Number(label.slice(3));
    if (time === start || clockMinute % 60 === 0 || clockMinute !== previousClockMinute + 1) {
      if (hourly.length) hourly.at(-1).end = time;
      hourly.push({ start: time, end, label, partial: false });
    }
    previousClockMinute = clockMinute;
  }
  const counts = new Map();
  for (const { label } of hourly) counts.set(label, (counts.get(label) ?? 0) + 1);
  for (const bucket of hourly) {
    bucket.repeated = counts.get(bucket.label) > 1;
    bucket.partial = bucket.start <= now && now < bucket.end;
  }
  return { now, today, start, hourly, localDate, midnight };
}

function hourlyValues(buckets, rows, now) {
  const samples = rows.map((row) => ({
    time: (row.lc ?? row.lu) * 1000,
    value: numeric(row.s),
  })).filter(({ time }) => Number.isFinite(time) && time <= now)
    .sort((a, b) => a.time - b.time);

  let index = 0;
  let previous = null;
  return buckets.map((bucket) => {
    while (index < samples.length && samples[index].time < bucket.start) {
      previous = samples[index++].value;
    }
    if (bucket.start > now) return { ...bucket, value: null };
    let value = previous === null ? null : 0;
    while (index < samples.length && samples[index].time < bucket.end) {
      const next = samples[index++].value;
      if (next === null || previous === null || next < previous) {
        value = null;
      } else if (value !== null) {
        value += next - previous;
      }
      previous = next;
    }
    return { ...bucket, value };
  });
}

export async function fetchHourly(hass, id, dates) {
  const iso = (time) => new Date(time).toISOString();
  const result = await hass.callWS({
    type: "history/history_during_period",
    entity_ids: [id],
    // Recorder labels the synthetic opening state with the request start.
    // Request a second before midnight so it cannot be mistaken for a change.
    start_time: iso(dates.start - 1000),
    end_time: iso(dates.now),
    include_start_time_state: true,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  return hourlyValues(dates.hourly, result[id] ?? [], dates.now);
}

export async function recorderStatistics(hass, id, start, end, period, field) {
  const result = await hass.callWS({
    type: "recorder/statistics_during_period",
    statistic_ids: [id],
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    period,
    types: [field],
  });
  return result[id] ?? [];
}
