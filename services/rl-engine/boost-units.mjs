export const BOOST_RAW_MAX = 255;
export const BOOST_PERCENT_MAX = 100;

export function boostRawToPercent(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(BOOST_PERCENT_MAX, Math.max(0, (value / BOOST_RAW_MAX) * BOOST_PERCENT_MAX));
}

export function boostDeltaRawToPercent(value) {
  if (!Number.isFinite(value)) return null;
  return (value / BOOST_RAW_MAX) * BOOST_PERCENT_MAX;
}
