const CURRENT_PERIOD_STATUSES = new Set(['active', 'planned']);

export function isCurrentTherapyPeriod(period) {
  return CURRENT_PERIOD_STATUSES.has(String(period?.status || '').toLowerCase());
}

export function hasTherapyPeriodRecords(child) {
  return Boolean(
    (Array.isArray(child?.periods) && child.periods.length > 0)
      || (Array.isArray(child?.therapyPeriods) && child.therapyPeriods.length > 0)
      || (Array.isArray(child?.currentPeriods) && child.currentPeriods.length > 0)
      || (Array.isArray(child?.activePeriods) && child.activePeriods.length > 0)
  );
}

export function getCurrentTherapyPeriods(child) {
  if (Array.isArray(child?.activePeriods)) return child.activePeriods.filter(isCurrentTherapyPeriod);
  if (Array.isArray(child?.currentPeriods)) return child.currentPeriods.filter(isCurrentTherapyPeriod);
  if (Array.isArray(child?.periods)) return child.periods.filter(isCurrentTherapyPeriod);
  if (Array.isArray(child?.therapyPeriods)) return child.therapyPeriods.filter(isCurrentTherapyPeriod);
  return [];
}

export function getLegacyTherapyPrograms(child) {
  if (Array.isArray(child?.therapyPrograms) && child.therapyPrograms.length > 0) return child.therapyPrograms;
  if (Array.isArray(child?.programs) && child.programs.length > 0) return child.programs;
  return [];
}

export function getCurrentTherapyPrograms(child) {
  const currentPeriods = getCurrentTherapyPeriods(child);
  if (currentPeriods.length > 0) return currentPeriods;
  return hasTherapyPeriodRecords(child) ? [] : getLegacyTherapyPrograms(child);
}
