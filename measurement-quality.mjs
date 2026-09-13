// A display guard, not a clinical accuracy threshold. Positive detections remain
// observable even in a partial recording; poor coverage cannot establish zero.
export const MIN_COUNT_COVERAGE = .8;
export function trackingCoverage(report) {
  const n = report?.metrics?.repetitionTrackingCoverage ?? report?.coverage;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}
export function videoRepetitionCount(report) {
  if (!Array.isArray(report?.reps)) return null;
  return report.reps.length > 0 || trackingCoverage(report) >= MIN_COUNT_COVERAGE ? report.reps.length : null;
}
export function trackingFeedback(report) {
  const reasons = report?.metrics?.rejectionCounts || {};
  const side = ['left', 'right'].includes(report?.config?.side) ? report.config.side + ' ' : '';
  for (const joint of ['ankle', 'knee', 'hip']) {
    if (reasons[joint + ':outside_frame'] > 0) return `Your ${side}${joint} went outside the picture. Adjust the camera so your hip, knee and foot stay visible throughout the movement.`;
  }
  const unclear = ['hip', 'knee', 'ankle'].filter(j => reasons[j + ':low_visibility'] > 0);
  if (unclear.length) return `The camera could not clearly follow your ${side}${unclear.join(' and ')}. Check the selected leg, improve the light and keep the full exercise leg visible.`;
  return 'Keep the selected hip, knee and foot visible throughout the movement, including the return to your starting position.';
}
