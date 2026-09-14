/**
 * Trip Comparison & Detailed Trip Report Utility Module
 * 100% Local, Offline-First Deterministic Comparison Engine.
 * Formats structured trip reports and computes side-by-side metric comparison payloads.
 */

import { formatDate, formatTime, formatDistance, formatDuration } from './format';
import { calculateAverageSpeed } from './location';

/**
 * Validates and formats a complete trip report object.
 * @param {Object} trip Trip metadata
 * @param {Array} [stops=[]] Confirmed stops array
 * @param {Array} [points=[]] Route points array
 * @returns {Object} Structured Trip Report payload
 */
export function validateTripReport(trip, stops = [], points = []) {
  if (!trip || typeof trip !== 'object' || !trip.id) {
    return { isValid: false, reason: 'Trip data is unavailable.' };
  }

  const startTime = typeof trip.startTime === 'number' && trip.startTime > 0 ? trip.startTime : null;
  if (!startTime) {
    return { isValid: false, reason: 'Invalid or missing trip timestamp.' };
  }

  const endTime = typeof trip.endTime === 'number' && trip.endTime >= startTime ? trip.endTime : null;
  const durationMins = endTime ? Math.max(0, (endTime - startTime) / 60000) : 0;
  const distanceKm = typeof trip.totalDistance === 'number' && !isNaN(trip.totalDistance) && trip.totalDistance >= 0 ? trip.totalDistance : 0;

  const validPoints = Array.isArray(points) ? points.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number') : [];
  const validStops = Array.isArray(stops) ? stops.filter(s => s && typeof s.durationMinutes === 'number' && s.durationMinutes >= 0) : [];

  const avgSpeedKmH = calculateAverageSpeed(distanceKm, startTime, endTime || Date.now());

  let maxSpeedKmH = 0;
  if (validPoints.length > 0) {
    const speeds = validPoints.map(p => (typeof p.speed === 'number' && !isNaN(p.speed) && p.speed >= 0 ? p.speed : 0));
    maxSpeedKmH = Math.max(...speeds, 0);
  } else if (typeof trip.maxSpeed === 'number' && !isNaN(trip.maxSpeed)) {
    maxSpeedKmH = trip.maxSpeed;
  } else {
    maxSpeedKmH = avgSpeedKmH;
  }

  let longestStop = null;
  if (validStops.length > 0) {
    longestStop = [...validStops].sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  }

  const totalStopDurationMins = validStops.reduce((sum, s) => sum + s.durationMinutes, 0);

  return {
    isValid: true,
    id: trip.id,
    startTime,
    endTime,
    dateStr: formatDate(startTime),
    startTimeStr: formatTime(startTime),
    endTimeStr: endTime ? formatTime(endTime) : 'In Progress',
    durationMins,
    durationStr: formatDuration(durationMins),
    distanceKm,
    distanceStr: formatDistance(distanceKm),
    avgSpeedKmH,
    avgSpeedStr: `${avgSpeedKmH.toFixed(1)} km/h`,
    maxSpeedKmH,
    maxSpeedStr: `${maxSpeedKmH.toFixed(1)} km/h`,
    travelMode: trip.travelMode || 'UNKNOWN',
    pointCount: validPoints.length,
    stopsCount: validStops.length > 0 ? validStops.length : (trip.stopsCount || 0),
    totalStopDurationMins,
    totalStopDurationStr: formatDuration(totalStopDurationMins),
    longestStop,
    startCoords: validPoints.length > 0 ? { lat: validPoints[0].lat, lng: validPoints[0].lng } : null,
    endCoords: validPoints.length > 0 ? { lat: validPoints[validPoints.length - 1].lat, lng: validPoints[validPoints.length - 1].lng } : null,
    hasRoutePoints: validPoints.length >= 2,
    stops: validStops,
    routePoints: validPoints
  };
}

/**
 * Computes side-by-side comparison payload between two completed trips.
 * @param {Object} tripA First Trip metadata
 * @param {Object} tripB Second Trip metadata
 * @param {Array} [stopsA=[]] First Trip stops
 * @param {Array} [stopsB=[]] Second Trip stops
 * @param {Array} [pointsA=[]] First Trip points
 * @param {Array} [pointsB=[]] Second Trip points
 * @returns {Object} Comparison result payload
 */
export function compareTwoTrips(tripA, tripB, stopsA = [], stopsB = [], pointsA = [], pointsB = []) {
  const rA = validateTripReport(tripA, stopsA, pointsA);
  const rB = validateTripReport(tripB, stopsB, pointsB);

  if (!rA.isValid || !rB.isValid) {
    return {
      isValid: false,
      reason: !rA.isValid ? `Trip A: ${rA.reason}` : `Trip B: ${rB.reason}`
    };
  }

  // 1. Distance Metric Comparison (km)
  const distDiff = rB.distanceKm - rA.distanceKm;
  const distDiffStr = distDiff >= 0 ? `+${distDiff.toFixed(2)} km` : `${distDiff.toFixed(2)} km`;
  let distHighlight = 'Equal distance';
  if (distDiff > 0.05) distHighlight = 'Trip B is longer (+ distance)';
  else if (distDiff < -0.05) distHighlight = 'Trip A is longer (+ distance)';

  // 2. Duration Metric Comparison (mins)
  const durDiff = rB.durationMins - rA.durationMins;
  const durDiffStr = durDiff >= 0 ? `+${Math.round(durDiff)} mins` : `${Math.round(durDiff)} mins`;
  let durHighlight = 'Equal duration';
  if (durDiff > 1) durHighlight = 'Trip B took longer (+ duration)';
  else if (durDiff < -1) durHighlight = 'Trip A took longer (+ duration)';

  // 3. Average Speed Metric Comparison (km/h)
  const avgSpeedDiff = rB.avgSpeedKmH - rA.avgSpeedKmH;
  const avgSpeedDiffStr = avgSpeedDiff >= 0 ? `+${avgSpeedDiff.toFixed(1)} km/h` : `${avgSpeedDiff.toFixed(1)} km/h`;
  let avgSpeedHighlight = 'Equal average speed';
  if (avgSpeedDiff > 0.5) avgSpeedHighlight = 'Trip B was faster (+ avg speed)';
  else if (avgSpeedDiff < -0.5) avgSpeedHighlight = 'Trip A was faster (+ avg speed)';

  // 4. Maximum Speed Metric Comparison (km/h)
  const maxSpeedDiff = rB.maxSpeedKmH - rA.maxSpeedKmH;
  const maxSpeedDiffStr = maxSpeedDiff >= 0 ? `+${maxSpeedDiff.toFixed(1)} km/h` : `${maxSpeedDiff.toFixed(1)} km/h`;
  let maxSpeedHighlight = 'Equal max speed';
  if (maxSpeedDiff > 0.5) maxSpeedHighlight = 'Trip B higher max speed';
  else if (maxSpeedDiff < -0.5) maxSpeedHighlight = 'Trip A higher max speed';

  // 5. Stops Count Comparison
  const stopsDiff = rB.stopsCount - rA.stopsCount;
  const stopsDiffStr = stopsDiff >= 0 ? `+${stopsDiff}` : `${stopsDiff}`;
  let stopsHighlight = 'Equal stop count';
  if (stopsDiff > 0) stopsHighlight = 'Trip B made more stops';
  else if (stopsDiff < 0) stopsHighlight = 'Trip A made more stops';

  // 6. Stop Duration Comparison (mins)
  const stopDurDiff = rB.totalStopDurationMins - rA.totalStopDurationMins;
  const stopDurDiffStr = stopDurDiff >= 0 ? `+${Math.round(stopDurDiff)} mins` : `${Math.round(stopDurDiff)} mins`;
  let stopDurHighlight = 'Equal stop dwell time';
  if (stopDurDiff > 1) stopDurHighlight = 'Trip B spent more time stopped';
  else if (stopDurDiff < -1) stopDurHighlight = 'Trip A spent more time stopped';

  // 7. Travel Mode Comparison
  const modeA = rA.travelMode;
  const modeB = rB.travelMode;
  const isSameMode = modeA === modeB;

  // 8. GPS Points Count Comparison
  const pointDiff = rB.pointCount - rA.pointCount;

  return {
    isValid: true,
    reportA: rA,
    reportB: rB,
    metrics: {
      distance: { valA: rA.distanceStr, valB: rB.distanceStr, diffStr: distDiffStr, highlight: distHighlight },
      duration: { valA: rA.durationStr, valB: rB.durationStr, diffStr: durDiffStr, highlight: durHighlight },
      avgSpeed: { valA: rA.avgSpeedStr, valB: rB.avgSpeedStr, diffStr: avgSpeedDiffStr, highlight: avgSpeedHighlight },
      maxSpeed: { valA: rA.maxSpeedStr, valB: rB.maxSpeedStr, diffStr: maxSpeedDiffStr, highlight: maxSpeedHighlight },
      stopsCount: { valA: rA.stopsCount, valB: rB.stopsCount, diffStr: stopsDiffStr, highlight: stopsHighlight },
      totalStopDuration: { valA: rA.totalStopDurationStr, valB: rB.totalStopDurationStr, diffStr: stopDurDiffStr, highlight: stopDurHighlight },
      travelMode: { modeA, modeB, isSameMode },
      pointCount: { countA: rA.pointCount, countB: rB.pointCount, diffPoints: pointDiff }
    }
  };
}
