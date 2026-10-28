import { lastDayOfMonth, subDays, addDays, getDay, format, startOfDay, endOfDay, addMonths } from 'date-fns';

/**
 * Returns the second-to-last Thursday of a given month.
 */
export function getSecondToLastThursday(date: Date): Date {
  let current = lastDayOfMonth(date);
  
  // 1. Find the absolute last Thursday of the month (Day 4)
  while (getDay(current) !== 4) {
    current = subDays(current, 1);
  }
  
  // 2. Subtract 7 days to get the second-to-last Thursday
  return startOfDay(subDays(current, 7));
}

/** First payroll month that uses the new fixed cycle (ends on the 17th). */
const NEW_CYCLE_FIRST_MONTH = { year: 2026, month: 10 };

function isOnOrAfterNewCycle(year: number, month: number): boolean {
  return year > NEW_CYCLE_FIRST_MONTH.year || (year === NEW_CYCLE_FIRST_MONTH.year && month >= NEW_CYCLE_FIRST_MONTH.month);
}

/**
 * Calculates the start and end dates for the Altek Green payroll cycle.
 *
 * Legacy cycles (before October 2026): cutoff is the second-to-last Thursday of the
 * target month; start is the Friday after the previous month's cutoff.
 *
 * From the October 2026 cycle onward: every cycle ends on the 17th of the target month
 * and the next cycle starts on the 18th (regardless of weekday).
 *  - October 2026 still starts on its legacy start (18 Sep) and ends 17 Oct.
 *  - November 2026 => 18 Oct to 17 Nov, and so on.
 *
 * @param selectedPeriod String in 'YYYY-MM' format
 */
export function getPayrollPeriod(selectedPeriod: string) {
  if (!selectedPeriod || !selectedPeriod.includes('-')) {
    const now = new Date();
    return { periodStart: startOfDay(now), periodEnd: endOfDay(now) };
  }

  const [year, month] = selectedPeriod.split('-').map(Number);

  // Legacy start: Friday following the previous month's second-to-last Thursday
  const prevCutoff = getSecondToLastThursday(new Date(year, month - 2, 1));
  const legacyStart = addDays(prevCutoff, 1);

  if (!isOnOrAfterNewCycle(year, month)) {
    return { periodStart: legacyStart, periodEnd: getSecondToLastThursday(new Date(year, month - 1, 1)) };
  }

  const periodEnd = startOfDay(new Date(year, month - 1, 17));
  const isFirstNewCycle = year === NEW_CYCLE_FIRST_MONTH.year && month === NEW_CYCLE_FIRST_MONTH.month;
  const periodStart = isFirstNewCycle ? legacyStart : startOfDay(new Date(year, month - 2, 18));

  return { periodStart, periodEnd };
}

/**
 * Returns the default selected payroll month.
 * Before 18 Oct 2026 the legacy rollover applies (past the second-to-last Thursday => next month).
 * From 18 Oct 2026 onward, the 18th of a month rolls over to the next month's cycle.
 *
 * @param systemDate The date to evaluate (defaults to now)
 */
export function getDefaultPayrollMonth(systemDate: Date = new Date()): string {
  const newRuleStart = new Date(2026, 9, 18);
  if (systemDate >= newRuleStart) {
    if (systemDate.getDate() >= 18) {
      return format(addMonths(new Date(systemDate.getFullYear(), systemDate.getMonth(), 1), 1), 'yyyy-MM');
    }
    return format(systemDate, 'yyyy-MM');
  }

  const currentMonthCutoff = getSecondToLastThursday(systemDate);
  if (systemDate > endOfDay(currentMonthCutoff)) {
    return format(addMonths(systemDate, 1), 'yyyy-MM');
  }
  return format(systemDate, 'yyyy-MM');
}