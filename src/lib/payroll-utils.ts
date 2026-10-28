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

/**
 * Payroll cycle for Altek Green time & attendance.
 * Every month runs from the 18th of the previous month to the 17th of the
 * target month (inclusive), regardless of weekday.
 * e.g. '2026-10' => 2026-09-18 to 2026-10-17; '2026-11' => 2026-10-18 to 2026-11-17.
 *
 * @param selectedPeriod String in 'YYYY-MM' format
 */
export function getPayrollPeriod(selectedPeriod: string) {
  if (!selectedPeriod || !selectedPeriod.includes('-')) {
    const now = new Date();
    return { periodStart: startOfDay(now), periodEnd: endOfDay(now) };
  }

  const [year, month] = selectedPeriod.split('-').map(Number);

  const periodEnd = startOfDay(new Date(year, month - 1, 17));
  const periodStart = startOfDay(new Date(year, month - 2, 18));

  return { periodStart, periodEnd };
}

/**
 * Returns the default selected payroll month.
 * Once the 17th has passed (from the 18th onward), the next month's cycle is selected.
 *
 * @param systemDate The date to evaluate (defaults to now)
 */
export function getDefaultPayrollMonth(systemDate: Date = new Date()): string {
  if (systemDate.getDate() >= 18) {
    return format(addMonths(new Date(systemDate.getFullYear(), systemDate.getMonth(), 1), 1), 'yyyy-MM');
  }
  return format(systemDate, 'yyyy-MM');
}