/* A 95% confidence interval for the mean of a handful of readings, by Student's t.

   What it says: if the knee was held at one angle and the readings scatter around it at random, the mean of the
   readings lies within this interval of that angle 95 times in 100.
   What it does not say: that the camera is right. A camera set off to one side, or a landmark the model places
   a little off the joint, moves every reading the same way, and no interval worked out from the readings
   themselves can see that. It describes how steady a reading is, not how accurate.
   Readings a thirtieth of a second apart are also not independent, so on live video the interval is narrower
   than a true 95% interval and is shown only as a steadiness band (trendCI95 below). The pictures of a recovery
   check are taken half a second apart and each is measured on its own, which is much closer to what the
   interval assumes. */

// Two-sided 95% points of Student's t for 1 to 30 degrees of freedom.
const T95 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
/* Beyond the table, the Cornish-Fisher expansion of the t quantile about the normal one. At 31 degrees of freedom
   it is already right to four decimal places, and it tends to 1.960 as the table of a textbook does. */
const Z = 1.959964;
const G1 = (Z ** 3 + Z) / 4, G2 = (5 * Z ** 5 + 16 * Z ** 3 + 3 * Z) / 96, G3 = (3 * Z ** 7 + 19 * Z ** 5 + 17 * Z ** 3 - 15 * Z) / 384;
export function t95(df) {
  if (!Number.isInteger(df) || df < 1) return NaN;
  return df <= 30 ? T95[df] : Z + G1 / df + G2 / df ** 2 + G3 / df ** 3;
}

/* values: numbers. Returns null with fewer than three finite values: two readings give an interval too wide to
   mean anything. The standard deviation is the sample one (n - 1). */
export function meanCI95(values) {
  const v = (values || []).filter(Number.isFinite), n = v.length;
  if (n < 3) return null;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const halfWidth = t95(n - 1) * sd / Math.sqrt(n);
  return { mean, sd, n, halfWidth, low: mean - halfWidth, high: mean + halfWidth };
}

/* The same question for a reading that is changing: how steady is it about its own trend? A knee that is moving gives
   readings that differ because the knee moved, and an interval worked out about their plain mean would show the
   movement, not the steadiness. Here a straight line is fitted through the readings by least squares and the
   interval is worked out from what is left over (n - 2 degrees of freedom). For a still knee it is the interval
   above to within a degree of freedom; for a smoothly moving one it stays as narrow as the readings are clean.
   times and values run together, in any unit of time. Returns null with fewer than four readings. */
export function trendCI95(times, values) {
  const pairs = (values || []).map((v, i) => [times?.[i], v]).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v)), n = pairs.length;
  if (n < 4) return null;
  const mt = pairs.reduce((a, p) => a + p[0], 0) / n, mv = pairs.reduce((a, p) => a + p[1], 0) / n;
  const stt = pairs.reduce((a, p) => a + (p[0] - mt) ** 2, 0), stv = pairs.reduce((a, p) => a + (p[0] - mt) * (p[1] - mv), 0);
  const slope = stt > 0 ? stv / stt : 0, df = stt > 0 ? n - 2 : n - 1;
  const sd = Math.sqrt(pairs.reduce((a, p) => a + (p[1] - mv - slope * (p[0] - mt)) ** 2, 0) / df);
  const halfWidth = t95(df) * sd / Math.sqrt(n);
  return { mean: mv, slope, sd, n, halfWidth, low: mv - halfWidth, high: mv + halfWidth };
}

/* The interval in words, in degrees of knee bend. Whole degrees, unless the interval is so narrow that both ends
   would read the same, when one decimal place is kept so the two ends still differ. This angle cannot be
   negative (0 means straight), so an end that falls below 0 is written as 0. */
export function intervalText(ci) {
  if (!ci || !Number.isFinite(ci.low) || !Number.isFinite(ci.high)) return '';
  const low = Math.max(0, ci.low), high = Math.max(0, ci.high);
  const places = Math.round(low) === Math.round(high) ? 1 : 0;
  return `${low.toFixed(places)}° to ${high.toFixed(places)}°`;
}
