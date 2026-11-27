'use strict';

const LoomScenarios = (() => {
  const day = 86400000;

  function proportion(input) {
    if (String(input).trim() === '') return null;
    const value = Number(input);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  }

  // This is a counterfactual quantity in units of flights, not a count of passengers.
  function quantity(observed, percent) {
    return observed === null || percent === null ? null : Math.round(observed * percent / 100);
  }

  function variation(current, reference, comparable) {
    if (current === null || reference === null) return null;
    const difference = current - reference;
    return { difference, percent: comparable && reference > 0 ? difference / reference * 100 : null };
  }

  // Fixed transfer function shared by all dates and emotions. At 8,000
  // equivalents the effect reaches half its fixed ceiling of 90%.
  function intensity(equivalents) {
    const weight = Math.sqrt(equivalents / 8000);
    return .90 * weight / (1 + weight);
  }

  function compare(current, reference, percent) {
    if (current?.observed == null || reference?.observed == null || percent === null) return null;
    const sameCoverage = current.covered === current.slots && reference.covered === reference.slots
      && current.slots === reference.slots;
    const normalized = !sameCoverage && current.type !== 'hour' && reference.type !== 'hour';
    if ((!sameCoverage && !normalized) || !current.covered || !reference.covered) return null;
    const a = normalized ? current.observed * percent / 100 / current.covered : quantity(current.observed, percent);
    const b = normalized ? reference.observed * percent / 100 / reference.covered : quantity(reference.observed, percent);
    return { current: a, reference: b, normalized, ...variation(a, b, true) };
  }

  // Group UTC days into at most twelve chronological bars. A missing day stays
  // unavailable; it contributes neither flights nor a fabricated zero.
  function series(timeline, period, percent) {
    if (!timeline?.length || period.type === 'hour') return [];
    const start = Date.parse(period.start);
    const end = Date.parse(period.end) + (period.type === 'day' ? 3 * day : 0);
    const first = period.type === 'day' ? start - 3 * day : start;
    const step = Math.ceil((end - first) / day / 12) * day;
    const buckets = Array.from({ length: Math.ceil((end - first) / step) }, (_, index) => {
      const from = first + index * step;
      return { start: from, days: Math.min(step, end - from) / day, coverage: 0, observed: 0 };
    });
    for (const [date, count] of timeline) {
      const stamp = Date.parse(date + 'T00:00:00Z');
      if (stamp < first || stamp >= end) continue;
      const bucket = buckets[Math.floor((stamp - first) / step)];
      bucket.observed += count;
      bucket.coverage++;
    }
    return buckets.map(bucket => ({ ...bucket,
      quantity: bucket.coverage ? quantity(bucket.observed, percent) : null }));
  }

  return { proportion, quantity, variation, intensity, compare, series };
})();
if (typeof module !== 'undefined') module.exports = LoomScenarios;
