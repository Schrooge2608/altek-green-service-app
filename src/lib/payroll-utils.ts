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
 * Calculates the start and end dates for the custom Altek Green payroll cycle.
 * Cutoff: Second-to-last Thursday of the target month.
 * Start: Friday immediately following the previous month's cutoff.
 * 
 * @param selectedPeriod String in 'YYYY-MM' format
 */
export function getPayrollPeriod(selectedPeriod: string) {
  if (!selectedPeriod || !selectedPeriod.includes('-')) {
    const now = new Date();
    return { periodStart: startOfDay(now), periodEnd: endOfDay(now) };
  }

  const [year, month] = selectedPeriod.split('-').map(Number);
  
  // Target month date object (1st of the month)
  const targetMonth = new Date(year, month - 1, 1);
  
  // Period End: Second-to-last Thursday of this month
  const periodEnd = getSecondToLastThursday(targetMonth);
  
  // Period Start: Friday following the previous month's second-to-last Thursday
  const previousMonth = new Date(year, month - 2, 1);
  const prevCutoff = getSecondToLastThursday(previousMonth);
  const periodStart = addDays(prevCutoff, 1);
  
  return { periodStart, periodEnd };
}

/**
 * Returns the default selected month for payroll based on rollover logic.
 * If the current date is past the second-to-last Thursday of the month (midnight rollover),
 * it returns the next month.
 * 
 * @param systemDate The date to evaluate (defaults to now)
 */
export function getDefaultPayrollMonth(systemDate: Date = new Date()): string {
  const currentMonthCutoff = getSecondToLastThursday(systemDate);
  const rolloverTime = endOfDay(currentMonthCutoff); // 23:59:59.999 local time

  if (systemDate > rolloverTime) {
    const nextMonth = addMonths(systemDate, 1);
    return format(nextMonth, 'yyyy-MM');
  }

  return format(systemDate, 'yyyy-MM');
}
