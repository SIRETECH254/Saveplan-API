import { 
  subDays, 
  subMonths, 
  startOfDay, 
  endOfDay, 
  eachDayOfInterval, 
  eachWeekOfInterval, 
  eachMonthOfInterval,
  format,
  isSameDay,
  isSameWeek,
  isSameMonth
} from 'date-fns';

export type AnalyticsRange = '7d' | '14d' | '28d' | '3m' | '6m' | '1y';

export interface DateInterval {
  start: Date;
  end: Date;
}

export interface AnalyticsPeriod {
  current: DateInterval;
  previous: DateInterval;
  granularity: 'day' | 'week' | 'month';
}

/**
 * Calculates current and previous date intervals based on range string.
 */
export const getAnalyticsPeriods = (range: AnalyticsRange): AnalyticsPeriod => {
  const now = new Date();
  const endOfCurrent = endOfDay(now);
  let startOfCurrent: Date;
  let granularity: 'day' | 'week' | 'month';

  switch (range) {
    case '7d':
      startOfCurrent = startOfDay(subDays(now, 6));
      granularity = 'day';
      break;
    case '14d':
      startOfCurrent = startOfDay(subDays(now, 13));
      granularity = 'day';
      break;
    case '28d':
      startOfCurrent = startOfDay(subDays(now, 27));
      granularity = 'day';
      break;
    case '3m':
      startOfCurrent = startOfDay(subMonths(now, 3));
      granularity = 'week';
      break;
    case '6m':
      startOfCurrent = startOfDay(subMonths(now, 6));
      granularity = 'month';
      break;
    case '1y':
      startOfCurrent = startOfDay(subMonths(now, 12));
      granularity = 'month';
      break;
    default:
      startOfCurrent = startOfDay(subDays(now, 6));
      granularity = 'day';
  }

  const durationInMs = endOfCurrent.getTime() - startOfCurrent.getTime();
  const endOfPrevious = new Date(startOfCurrent.getTime() - 1);
  const startOfPrevious = new Date(endOfPrevious.getTime() - durationInMs);

  return {
    current: { start: startOfCurrent, end: endOfCurrent },
    previous: { start: startOfPrevious, end: endOfPrevious },
    granularity
  };
};

/**
 * Generates a template array of labels based on granularity to ensure no gaps in data.
 */
export const getChartLabels = (interval: DateInterval, granularity: 'day' | 'week' | 'month'): string[] => {
  let dates: Date[];

  if (granularity === 'day') {
    dates = eachDayOfInterval({ start: interval.start, end: interval.end });
    return dates.map(d => format(d, 'MMM dd'));
  } else if (granularity === 'week') {
    dates = eachWeekOfInterval({ start: interval.start, end: interval.end });
    return dates.map((d, i) => `Week ${i + 1}`);
  } else {
    dates = eachMonthOfInterval({ start: interval.start, end: interval.end });
    return dates.map(d => format(d, 'MMM yyyy'));
  }
};

/**
 * Formats a date for grouping based on granularity.
 */
export const getGroupLabel = (date: Date, granularity: 'day' | 'week' | 'month', index?: number): string => {
  if (granularity === 'day') return format(date, 'MMM dd');
  if (granularity === 'week') return `Week ${index !== undefined ? index + 1 : ''}`;
  return format(date, 'MMM yyyy');
};

/**
 * Calculates percentage growth.
 */
export const calculateGrowth = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number(((current - previous) / previous * 100).toFixed(2));
};
