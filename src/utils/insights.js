/**
 * Smart Travel Insights & Recommendations Utility Module
 * 100% Local, Offline-First Deterministic Travel Intelligence Engine.
 * Converts existing completed trip data into factual insights without external AI APIs.
 */

import { formatDistance, formatDuration } from './format';

/**
 * Validates array of trip objects, ignoring nulls, corrupted objects, and invalid timestamps/distances.
 * @param {Array} trips 
 * @returns {Array} Array of valid trip objects
 */
export function validateTrips(trips) {
  if (!trips || !Array.isArray(trips)) return [];

  return trips.filter(t => {
    if (!t || typeof t !== 'object') return false;
    if (!t.id || typeof t.id !== 'string') return false;
    
    const startTime = t.startTime;
    if (startTime === undefined || startTime === null || isNaN(startTime) || startTime <= 0) return false;

    const distance = t.totalDistance;
    if (distance === undefined || distance === null || isNaN(distance) || distance < 0) return false;

    return true;
  });
}

/**
 * Calculates the dominant travel mode (WALKING, CYCLING, VEHICLE) from valid trips.
 * @param {Array} trips 
 * @returns {Object} { mode, count, percentage, label }
 */
export function getMostUsedTravelMode(trips) {
  const validTrips = validateTrips(trips);
  if (validTrips.length === 0) {
    return { mode: 'INSUFFICIENT_DATA', count: 0, percentage: 0, label: 'Not enough travel mode data' };
  }

  const counts = { WALKING: 0, CYCLING: 0, VEHICLE: 0 };
  let evaluatedCount = 0;

  validTrips.forEach(t => {
    let mode = t.travelMode;

    // Legacy or missing travelMode fallback via speed estimation
    if (!mode || mode === 'UNKNOWN') {
      const dist = t.totalDistance || 0;
      const end = t.endTime || Date.now();
      const durHours = (end - t.startTime) / 3600000;
      const avgSpeed = durHours > 0 ? dist / durHours : 0;

      if (avgSpeed <= 0.5) {
        mode = 'UNKNOWN';
      } else if (avgSpeed <= 7) {
        mode = 'WALKING';
      } else if (avgSpeed <= 25) {
        mode = 'CYCLING';
      } else {
        mode = 'VEHICLE';
      }
    }

    if (counts[mode] !== undefined) {
      counts[mode] += 1;
      evaluatedCount += 1;
    }
  });

  if (evaluatedCount === 0) {
    return { mode: 'INSUFFICIENT_DATA', count: 0, percentage: 0, label: 'Not enough travel mode data' };
  }

  let dominantMode = 'VEHICLE';
  let maxCount = -1;

  Object.keys(counts).forEach(m => {
    if (counts[m] > maxCount) {
      maxCount = counts[m];
      dominantMode = m;
    }
  });

  const percentage = Math.round((maxCount / validTrips.length) * 100);
  const modeTitles = { WALKING: 'Walking 🚶', CYCLING: 'Cycling 🚴', VEHICLE: 'Vehicle 🚗' };
  const title = modeTitles[dominantMode] || 'Travel';

  return {
    mode: dominantMode,
    count: maxCount,
    totalCount: validTrips.length,
    percentage,
    label: `${title} (${percentage}% of trips)`
  };
}

/**
 * Identifies the valid trip with the longest recorded distance.
 * @param {Array} trips 
 * @returns {Object|null} { trip, distanceKm, durationMins, startTime }
 */
export function getLongestTrip(trips) {
  const validTrips = validateTrips(trips).filter(t => (t.totalDistance || 0) > 0);
  if (validTrips.length === 0) return null;

  let longest = validTrips[0];
  for (let i = 1; i < validTrips.length; i++) {
    if (validTrips[i].totalDistance > longest.totalDistance) {
      longest = validTrips[i];
    }
  }

  const end = longest.endTime || Date.now();
  const durationMins = Math.max(0, (end - longest.startTime) / 60000);

  return {
    trip: longest,
    distanceKm: longest.totalDistance,
    durationMins,
    startTime: longest.startTime,
    label: `${formatDistance(longest.totalDistance)} (${formatDuration(durationMins)})`
  };
}

/**
 * Identifies the valid trip with the shortest recorded distance.
 * @param {Array} trips 
 * @returns {Object|null} { trip, distanceKm, durationMins, startTime }
 */
export function getShortestTrip(trips) {
  const validTrips = validateTrips(trips).filter(t => (t.totalDistance || 0) > 0);
  if (validTrips.length === 0) return null;

  let shortest = validTrips[0];
  for (let i = 1; i < validTrips.length; i++) {
    if (validTrips[i].totalDistance < shortest.totalDistance) {
      shortest = validTrips[i];
    }
  }

  const end = shortest.endTime || Date.now();
  const durationMins = Math.max(0, (end - shortest.startTime) / 60000);

  return {
    trip: shortest,
    distanceKm: shortest.totalDistance,
    durationMins,
    startTime: shortest.startTime,
    label: `${formatDistance(shortest.totalDistance)} (${formatDuration(durationMins)})`
  };
}

/**
 * Computes average trip distance across all valid trips.
 * @param {Array} trips 
 * @returns {number} Average distance in km
 */
export function getAverageTripDistance(trips) {
  const validTrips = validateTrips(trips);
  if (validTrips.length === 0) return 0;

  const totalDist = validTrips.reduce((sum, t) => sum + t.totalDistance, 0);
  return totalDist / validTrips.length;
}

/**
 * Computes average trip duration across all valid trips.
 * @param {Array} trips 
 * @returns {number} Average duration in minutes
 */
export function getAverageTripDuration(trips) {
  const validTrips = validateTrips(trips);
  if (validTrips.length === 0) return 0;

  const totalDurationMins = validTrips.reduce((sum, t) => {
    const end = t.endTime || Date.now();
    return sum + Math.max(0, (end - t.startTime) / 60000);
  }, 0);

  return totalDurationMins / validTrips.length;
}

/**
 * Calculates the weekday with the highest frequency of recorded trips.
 * @param {Array} trips 
 * @returns {Object} { dayName, count, label }
 */
export function getMostFrequentTravelDay(trips) {
  const validTrips = validateTrips(trips);
  if (validTrips.length === 0) {
    return { dayName: 'INSUFFICIENT_DATA', count: 0, label: 'Insufficient trip data' };
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];

  validTrips.forEach(t => {
    const date = new Date(t.startTime);
    const dayIndex = date.getDay();
    if (dayIndex >= 0 && dayIndex <= 6) {
      dayCounts[dayIndex] += 1;
    }
  });

  let maxDayIdx = 0;
  let maxCount = -1;

  dayCounts.forEach((count, idx) => {
    if (count > maxCount) {
      maxCount = count;
      maxDayIdx = idx;
    }
  });

  if (maxCount <= 0) {
    return { dayName: 'INSUFFICIENT_DATA', count: 0, label: 'Insufficient trip data' };
  }

  const bestDay = dayNames[maxDayIdx];
  return {
    dayName: bestDay,
    count: maxCount,
    label: `${bestDay} (${maxCount} trip${maxCount > 1 ? 's' : ''})`
  };
}

/**
 * Evaluates recent travel trend by comparing recent valid trips vs prior valid trips.
 * @param {Array} trips 
 * @returns {Object} { status: 'INCREASING'|'DECREASING'|'STABLE'|'INSUFFICIENT_DATA', label }
 */
export function getRecentTravelTrend(trips) {
  const validTrips = validateTrips(trips).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  if (validTrips.length < 2) {
    return { status: 'INSUFFICIENT_DATA', label: 'Insufficient data for trend analysis' };
  }

  const halfSize = Math.floor(validTrips.length / 2);
  const recentSlice = validTrips.slice(0, halfSize);
  const priorSlice = validTrips.slice(halfSize, halfSize * 2);

  if (recentSlice.length === 0 || priorSlice.length === 0) {
    return { status: 'INSUFFICIENT_DATA', label: 'Insufficient data for trend analysis' };
  }

  const avgRecentDist = recentSlice.reduce((s, t) => s + t.totalDistance, 0) / recentSlice.length;
  const avgPriorDist = priorSlice.reduce((s, t) => s + t.totalDistance, 0) / priorSlice.length;

  if (avgPriorDist === 0) {
    return { status: 'STABLE', label: 'Travel volume is stable' };
  }

  const deltaPct = ((avgRecentDist - avgPriorDist) / avgPriorDist) * 100;

  if (deltaPct > 15) {
    return { status: 'INCREASING', percentChange: Math.round(deltaPct), label: `Recent travel distance up +${Math.round(deltaPct)}%` };
  } else if (deltaPct < -15) {
    return { status: 'DECREASING', percentChange: Math.round(deltaPct), label: `Recent travel distance down ${Math.round(deltaPct)}%` };
  } else {
    return { status: 'STABLE', percentChange: Math.round(deltaPct), label: 'Travel volume is steady' };
  }
}

/**
 * Computes deterministic travel consistency metric based on weekly trip frequency.
 * @param {Array} trips 
 * @returns {Object} { status: 'HIGH'|'MODERATE'|'LOW'|'INSUFFICIENT_DATA', label, tripsPerWeek }
 */
export function getTravelConsistency(trips) {
  const validTrips = validateTrips(trips).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  if (validTrips.length < 2) {
    return { status: 'INSUFFICIENT_DATA', tripsPerWeek: 0, label: 'Insufficient data for consistency rating' };
  }

  const oldest = validTrips[0].startTime;
  const newest = validTrips[validTrips.length - 1].startTime;
  const timeSpanMs = newest - oldest;
  const timeSpanWeeks = Math.max(1, timeSpanMs / (7 * 86400 * 1000));

  const tripsPerWeek = validTrips.length / timeSpanWeeks;
  const rounded = Math.round(tripsPerWeek * 10) / 10;

  if (tripsPerWeek >= 4) {
    return { status: 'HIGH', tripsPerWeek: rounded, label: `High Consistency (~${rounded} trips/week)` };
  } else if (tripsPerWeek >= 2) {
    return { status: 'MODERATE', tripsPerWeek: rounded, label: `Moderate Consistency (~${rounded} trips/week)` };
  } else {
    return { status: 'LOW', tripsPerWeek: rounded, label: `Low Consistency (~${rounded} trips/week)` };
  }
}

/**
 * Calculates stop dwell insights across valid trip stops.
 * @param {Array} trips 
 * @param {Array} [allStops=[]] 
 * @returns {Object} { totalStopsCount, avgStopDurationMins, longestStop, avgStopsPerTrip, topPlaces }
 */
export function getStopInsights(trips, allStops = []) {
  const validTrips = validateTrips(trips);
  const validStops = Array.isArray(allStops) ? allStops.filter(s => s && typeof s === 'object' && typeof s.durationMinutes === 'number' && s.durationMinutes >= 0) : [];

  const totalStopsCount = validStops.length;
  const avgStopsPerTrip = validTrips.length > 0 ? Math.round((totalStopsCount / validTrips.length) * 10) / 10 : 0;

  const totalDwellMins = validStops.reduce((sum, s) => sum + s.durationMinutes, 0);
  const avgStopDurationMins = totalStopsCount > 0 ? Math.round(totalDwellMins / totalStopsCount) : 0;

  let longestStop = null;
  if (validStops.length > 0) {
    longestStop = [...validStops].sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  }

  // Aggregate top visited stop place names
  const placeCounts = {};
  validStops.forEach(s => {
    const name = s.placeName;
    if (name && name !== 'Resolving Address...' && name !== 'Resolving address...' && !name.startsWith('Location (') && !name.startsWith('Point (')) {
      placeCounts[name] = (placeCounts[name] || 0) + 1;
    }
  });

  const sortedPlaces = Object.keys(placeCounts)
    .map(name => ({ placeName: name, count: placeCounts[name] }))
    .sort((a, b) => b.count - a.count);

  return {
    totalStopsCount,
    avgStopDurationMins,
    longestStop,
    avgStopsPerTrip,
    topPlaces: sortedPlaces.slice(0, 3)
  };
}

/**
 * Generates compact factual natural language summary statements from validated data.
 * @param {Array} trips 
 * @param {Array} [allStops=[]] 
 * @returns {Array<string>} List of factual bullet statements
 */
export function generateTravelSummary(trips, allStops = []) {
  const validTrips = validateTrips(trips);
  if (validTrips.length === 0) return [];

  const statements = [];
  const totalDist = getAverageTripDistance(trips) * validTrips.length;
  statements.push(`Recorded ${validTrips.length} trip${validTrips.length > 1 ? 's' : ''} totaling ${formatDistance(totalDist)}.`);

  const modeInfo = getMostUsedTravelMode(trips);
  if (modeInfo.mode !== 'INSUFFICIENT_DATA') {
    statements.push(`Your most-used travel mode is ${modeInfo.label}.`);
  }

  const avgDist = getAverageTripDistance(trips);
  const avgDur = getAverageTripDuration(trips);
  if (avgDist > 0) {
    statements.push(`Average trip distance is ${formatDistance(avgDist)} (${formatDuration(avgDur)} avg duration).`);
  }

  const frequentDay = getMostFrequentTravelDay(trips);
  if (frequentDay.dayName !== 'INSUFFICIENT_DATA') {
    statements.push(`Most frequent travel day is ${frequentDay.dayName}.`);
  }

  return statements;
}

/**
 * Master aggregator computing all insights in a single deterministic pass.
 * @param {Array} trips 
 * @param {Array} [stops=[]] 
 * @returns {Object} Aggregated travel insights
 */
export function calculateAllInsights(trips, stops = []) {
  const validTrips = validateTrips(trips);
  const hasData = validTrips.length > 0;

  if (!hasData) {
    return {
      hasData: false,
      summary: [],
      mostUsedMode: getMostUsedTravelMode([]),
      longestTrip: null,
      shortestTrip: null,
      avgDistanceKm: 0,
      avgDurationMins: 0,
      frequentDay: getMostFrequentTravelDay([]),
      trend: getRecentTravelTrend([]),
      consistency: getTravelConsistency([]),
      stopInsights: getStopInsights([], [])
    };
  }

  return {
    hasData: true,
    summary: generateTravelSummary(validTrips, stops),
    mostUsedMode: getMostUsedTravelMode(validTrips),
    longestTrip: getLongestTrip(validTrips),
    shortestTrip: getShortestTrip(validTrips),
    avgDistanceKm: getAverageTripDistance(validTrips),
    avgDurationMins: getAverageTripDuration(validTrips),
    frequentDay: getMostFrequentTravelDay(validTrips),
    trend: getRecentTravelTrend(validTrips),
    consistency: getTravelConsistency(validTrips),
    stopInsights: getStopInsights(validTrips, stops)
  };
}
