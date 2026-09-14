/**
 * Personal Travel Goals & Progress Utility Module
 * 100% Local, Offline-First Deterministic Travel Goal Evaluator.
 * Calculates dynamic goal progress from completed trips without modifying historical records.
 */

import { validateTrips } from './insights';

export const GOAL_TYPES = {
  DISTANCE: 'DISTANCE',
  TRIP_COUNT: 'TRIP_COUNT'
};

export const GOAL_PERIODS = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY'
};

export const PROGRESS_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

/**
 * Calculates start-of-period timestamp (Monday 00:00:00 for WEEKLY, 1st day 00:00:00 for MONTHLY).
 * @param {string} period 'WEEKLY' | 'MONTHLY'
 * @param {Date|number} [referenceDate=new Date()] 
 * @returns {number} Timestamp in milliseconds
 */
export function getPeriodStartTimestamp(period, referenceDate = new Date()) {
  const d = new Date(referenceDate);

  if (period === GOAL_PERIODS.WEEKLY) {
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
  }

  // Default: MONTHLY
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return firstDay.getTime();
}

/**
 * Validates goal creation parameters.
 * @param {string} type 'DISTANCE' | 'TRIP_COUNT'
 * @param {number} target Target number (> 0)
 * @param {string} period 'WEEKLY' | 'MONTHLY'
 * @returns {Object} { isValid, reason }
 */
export function validateGoalInput(type, target, period) {
  if (type !== GOAL_TYPES.DISTANCE && type !== GOAL_TYPES.TRIP_COUNT) {
    return { isValid: false, reason: 'Invalid goal type.' };
  }

  if (period !== GOAL_PERIODS.WEEKLY && period !== GOAL_PERIODS.MONTHLY) {
    return { isValid: false, reason: 'Invalid goal period.' };
  }

  const numTarget = parseFloat(target);
  if (isNaN(numTarget) || !isFinite(numTarget) || numTarget <= 0) {
    return { isValid: false, reason: 'Target must be a positive number greater than 0.' };
  }

  return { isValid: true, target: numTarget, reason: 'OK' };
}

/**
 * Calculates dynamic goal progress from completed trip records.
 * @param {Object} goal Goal object { id, type, target, period, createdAt, enabled }
 * @param {Array} trips List of completed trip objects
 * @returns {Object} Progress payload { goal, currentValue, target, percentage, state, periodTripsCount }
 */
export function calculateGoalProgress(goal, trips = []) {
  if (!goal || typeof goal !== 'object' || !goal.target || goal.target <= 0) {
    return {
      goal,
      currentValue: 0,
      target: 0,
      percentage: 0,
      state: PROGRESS_STATES.NOT_STARTED,
      periodTripsCount: 0
    };
  }

  const validTrips = validateTrips(trips);
  const periodStartMs = getPeriodStartTimestamp(goal.period);

  // Filter completed trips strictly within the current goal period
  const periodTrips = validTrips.filter(t => t.startTime >= periodStartMs);

  let currentValue = 0;
  if (goal.type === GOAL_TYPES.DISTANCE) {
    const rawDist = periodTrips.reduce((sum, t) => sum + (t.totalDistance || 0), 0);
    currentValue = Math.round(rawDist * 10) / 10;
  } else {
    currentValue = periodTrips.length;
  }

  const percentage = Math.min(100, Math.max(0, Math.round((currentValue / goal.target) * 100)));

  let state = PROGRESS_STATES.IN_PROGRESS;
  if (currentValue === 0) {
    state = PROGRESS_STATES.NOT_STARTED;
  } else if (percentage >= 100) {
    state = PROGRESS_STATES.COMPLETED;
  }

  return {
    goal,
    currentValue,
    target: goal.target,
    percentage,
    state,
    periodTripsCount: periodTrips.length
  };
}

/**
 * Calculates dynamic progress across all goals.
 * @param {Array} goals List of user goals
 * @param {Array} trips List of completed trips
 * @returns {Array} List of progress objects
 */
export function calculateAllGoalsProgress(goals = [], trips = []) {
  if (!goals || !Array.isArray(goals)) return [];

  return goals
    .filter(g => g && g.enabled !== false)
    .map(g => calculateGoalProgress(g, trips));
}
