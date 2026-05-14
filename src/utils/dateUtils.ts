import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

/**
 * BRT Timezone offset (UTC-3). 
 * This is the standard for most of Brazil's industrial regions.
 */
const BRT_OFFSET = -3 * 60 * 60 * 1000;

/**
 * Returns the current date shifted to Brazil Time (BRT).
 */
export const getNowBRT = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + BRT_OFFSET);
};

/**
 * Returns the start of the day in Brazil Time.
 */
export const getStartOfTodayBRT = () => startOfDay(getNowBRT());

/**
 * Returns the end of the day in Brazil Time.
 */
export const getEndOfTodayBRT = () => endOfDay(getNowBRT());

/**
 * Formats a Date or Timestamp to a standard string 'yyyy-MM-dd' in BRT.
 */
export const formatDateBRT = (date: Date | Timestamp | any) => {
  if (!date) return '';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return format(new Date(utc + BRT_OFFSET), 'yyyy-MM-dd');
};

/**
 * Formats a Date or Timestamp to a readable string 'dd/MM/yyyy' in BRT.
 */
export const formatDisplayDateBRT = (date: Date | Timestamp | any) => {
  if (!date) return '';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return format(new Date(utc + BRT_OFFSET), 'dd/MM/yyyy');
};

/**
 * Returns the range for the current month in BRT.
 */
export const getCurrentMonthRangeBRT = () => {
  const now = getNowBRT();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now)
  };
};

/**
 * Returns the range for the last N days in BRT.
 */
export const getLastDaysRangeBRT = (days: number) => {
  const now = getNowBRT();
  return {
    start: startOfDay(subDays(now, days - 1)),
    end: endOfDay(now)
  };
};

/**
 * A safe formatter that handles null/undefined and provides a fallback.
 */
export const formatDateSafe = (date: any, formatStr: string = 'dd/MM/yyyy') => {
  if (!date) return '-';
  try {
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '-';
    // Use the standard display format if none provided
    return format(d, formatStr);
  } catch (e) {
    return '-';
  }
};
