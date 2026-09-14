/**
 * Location Utilities Module
 * Core calculations for distance, radius geofencing, speed analysis, and automatic stop detection state machine.
 */

// Configurable Stop Detection Thresholds
export const STOP_CONFIG = {
  STOP_RADIUS_METERS: 30,                // 30 meters cluster radius limit
  MIN_DWELL_TIME_MS: 3 * 60 * 1000,      // 3 minutes minimum dwell duration (configurable)
  STATIONARY_SPEED_THRESHOLD_MPS: 0.8,  // ~2.88 km/h stationary speed limit
};

export const STOP_STATES = {
  MOVING: 'MOVING',
  CANDIDATE: 'CANDIDATE',
  CONFIRMED: 'CONFIRMED'
};

// Configurable Geofence Thresholds & States
export const GEOFENCE_CONFIG = {
  HOME_RADIUS_METERS: 100, // Configurable Home Geofence radius in meters
};

export const GEOFENCE_STATES = {
  HOME: 'HOME',
  AWAY: 'AWAY',
  UNKNOWN: 'UNKNOWN'
};

// General Math & Geographic Constants
export const EARTH_RADIUS_KM = 6371;
export const METERS_PER_KM = 1000;
export const MS_PER_HOUR = 3600000;
export const MS_PER_SECOND = 1000;
export const STATIONARY_SPEED_THRESHOLD_MPS = STOP_CONFIG.STATIONARY_SPEED_THRESHOLD_MPS;

/**
 * Helper to extract numeric latitude and longitude from flexible argument formats.
 */
function extractCoords(arg1, arg2) {
  if (typeof arg1 === 'number' && typeof arg2 === 'number') {
    return { lat: arg1, lng: arg2 };
  }
  if (arg1 && typeof arg1 === 'object') {
    const lat = arg1.lat ?? arg1.latitude;
    const lng = arg1.lng ?? arg1.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Calculates the Haversine distance between two coordinates.
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  let p1, p2;

  if (typeof lat1 === 'object' && typeof lon1 === 'object') {
    p1 = extractCoords(lat1);
    p2 = extractCoords(lon1);
  } else {
    p1 = extractCoords(lat1, lon1);
    p2 = extractCoords(lat2, lon2);
  }

  if (!p1 || !p2) return 0;
  if (isNaN(p1.lat) || isNaN(p1.lng) || isNaN(p2.lat) || isNaN(p2.lng)) return 0;
  if (p1.lat === p2.lat && p1.lng === p2.lng) return 0;

  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Helper wrapper for legacy callers expecting distance in meters.
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  return haversineDistance(lat1, lon1, lat2, lon2) * METERS_PER_KM;
}

/**
 * Checks if a point is within a specified radius of another point.
 */
export function isWithinRadius(p1, p2, radiusInMeters) {
  if (!p1 || !p2 || radiusInMeters === undefined || radiusInMeters === null || radiusInMeters < 0) {
    return false;
  }
  const distanceKm = haversineDistance(p1, p2);
  return (distanceKm * METERS_PER_KM) <= radiusInMeters;
}

/**
 * Evaluates Home Geofence State Transition.
 * Triggers ONLY on state transitions (HOME -> AWAY or AWAY -> HOME).
 * Ignores points with accuracy > 50m to prevent false geofence bounces.
 * @param {Object} currentCoords { lat, lng, accuracy }
 * @param {Object} homeLocation { lat, lng, name }
 * @param {string} [lastState='UNKNOWN'] 'HOME' | 'AWAY' | 'UNKNOWN'
 * @param {number} [radiusMeters=100] Configurable radius
 * @returns {Object} { newState: 'HOME' | 'AWAY', transition: 'NONE' | 'LEFT_HOME' | 'ARRIVED_HOME' }
 */
export function checkHomeGeofenceTransition(currentCoords, homeLocation, lastState = GEOFENCE_STATES.UNKNOWN, radiusMeters = GEOFENCE_CONFIG.HOME_RADIUS_METERS) {
  if (!currentCoords || !homeLocation || typeof homeLocation.lat !== 'number' || typeof homeLocation.lng !== 'number') {
    return { newState: lastState, transition: 'NONE' };
  }

  // Filter out low accuracy GPS points (> 50m) to avoid false geofence triggers
  if (currentCoords.accuracy !== null && currentCoords.accuracy !== undefined && currentCoords.accuracy > 50) {
    return { newState: lastState, transition: 'NONE' };
  }

  const distanceKm = haversineDistance(currentCoords, homeLocation);
  const distanceMeters = distanceKm * METERS_PER_KM;
  const isInside = distanceMeters <= radiusMeters;
  const currentState = isInside ? GEOFENCE_STATES.HOME : GEOFENCE_STATES.AWAY;

  if (lastState === GEOFENCE_STATES.UNKNOWN) {
    return { newState: currentState, transition: 'NONE' };
  }

  if (lastState === GEOFENCE_STATES.HOME && currentState === GEOFENCE_STATES.AWAY) {
    return { newState: GEOFENCE_STATES.AWAY, transition: 'LEFT_HOME' };
  }

  if (lastState === GEOFENCE_STATES.AWAY && currentState === GEOFENCE_STATES.HOME) {
    return { newState: GEOFENCE_STATES.HOME, transition: 'ARRIVED_HOME' };
  }

  return { newState: currentState, transition: 'NONE' };
}

/**
 * Determines if a GPS point indicates stationary status based on GPS speed.
 */
export function isStationaryPoint(point, speedThresholdMps = STOP_CONFIG.STATIONARY_SPEED_THRESHOLD_MPS) {
  if (point === null || point === undefined) return false;

  let speed = null;
  if (typeof point === 'number') {
    speed = point;
  } else if (typeof point === 'object') {
    speed = point.speed ?? point.coords?.speed ?? null;
  }

  if (speed === null || speed === undefined || isNaN(speed)) {
    return false;
  }

  const speedMps = speed > 15 ? speed / 3.6 : speed;
  return speedMps >= 0 && speedMps <= speedThresholdMps;
}

/**
 * Calculates average speed in km/h from total distance and start/end timestamps.
 */
export function calculateAverageSpeed(distanceKm, startTimeMs, endTimeMs) {
  if (
    distanceKm === undefined || distanceKm === null || isNaN(distanceKm) || distanceKm <= 0 ||
    !startTimeMs || !endTimeMs || isNaN(startTimeMs) || isNaN(endTimeMs)
  ) {
    return 0;
  }

  const durationMs = endTimeMs - startTimeMs;
  if (durationMs <= 0) return 0;

  const durationHours = durationMs / MS_PER_HOUR;
  return distanceKm / durationHours;
}

// ============================================================================
// AUTOMATIC STOP DETECTION STATE MACHINE CLASS
// ============================================================================

export class StopDetector {
  constructor(config = {}) {
    this.stopRadiusMeters = config.STOP_RADIUS_METERS || STOP_CONFIG.STOP_RADIUS_METERS;
    this.minDwellTimeMs = config.MIN_DWELL_TIME_MS || STOP_CONFIG.MIN_DWELL_TIME_MS;
    this.stationarySpeedMps = config.STATIONARY_SPEED_THRESHOLD_MPS || STOP_CONFIG.STATIONARY_SPEED_THRESHOLD_MPS;
    this.reset();
  }

  reset() {
    this.state = STOP_STATES.MOVING;
    this.candidatePoints = [];
    this.candidateStartTimestamp = null;
    this.lastStationaryTimestamp = null;
    this.activeConfirmedStop = null;
  }

  processPoint(point) {
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number' || !point.timestamp) {
      return { action: 'NONE', stop: null };
    }

    let speedMps = null;
    if (point.speed !== undefined && point.speed !== null) {
      speedMps = point.speed > 15 ? point.speed / 3.6 : point.speed;
    }

    const isStationary = speedMps !== null ? speedMps <= this.stationarySpeedMps : true;

    if (this.state === STOP_STATES.MOVING) {
      if (isStationary) {
        this.state = STOP_STATES.CANDIDATE;
        this.candidatePoints = [point];
        this.candidateStartTimestamp = point.timestamp;
        this.lastStationaryTimestamp = point.timestamp;
      }
      return { action: 'NONE', stop: null };
    }

    if (this.state === STOP_STATES.CANDIDATE) {
      const anchor = this.candidatePoints[0];
      const distMeters = haversineDistance(anchor, point) * METERS_PER_KM;

      if (distMeters <= this.stopRadiusMeters && isStationary) {
        this.candidatePoints.push(point);
        this.lastStationaryTimestamp = point.timestamp;

        const dwellMs = point.timestamp - this.candidateStartTimestamp;
        if (dwellMs >= this.minDwellTimeMs) {
          this.state = STOP_STATES.CONFIRMED;

          const sumLat = this.candidatePoints.reduce((sum, p) => sum + p.lat, 0);
          const sumLng = this.candidatePoints.reduce((sum, p) => sum + p.lng, 0);
          const centroidLat = sumLat / this.candidatePoints.length;
          const centroidLng = sumLng / this.candidatePoints.length;

          const durationMinutes = Math.round(dwellMs / 60000);

          this.activeConfirmedStop = {
            id: `stop_${this.candidateStartTimestamp}`,
            tripId: point.tripId,
            lat: centroidLat,
            lng: centroidLng,
            arrivalTime: this.candidateStartTimestamp,
            departureTime: null,
            durationMinutes: durationMinutes,
            placeName: 'Resolving Address...',
            placeType: 'general',
            isConfirmed: true,
            isFinalized: false
          };

          return { action: 'STOP_CONFIRMED', stop: this.activeConfirmedStop };
        }
        return { action: 'NONE', stop: null };
      } else {
        this.reset();
        return { action: 'NONE', stop: null };
      }
    }

    if (this.state === STOP_STATES.CONFIRMED) {
      const anchor = { lat: this.activeConfirmedStop.lat, lng: this.activeConfirmedStop.lng };
      const distMeters = haversineDistance(anchor, point) * METERS_PER_KM;

      if (distMeters <= this.stopRadiusMeters && isStationary) {
        this.lastStationaryTimestamp = point.timestamp;
        const dwellMs = point.timestamp - this.candidateStartTimestamp;
        const durationMinutes = Math.round(dwellMs / 60000);

        this.activeConfirmedStop = {
          ...this.activeConfirmedStop,
          durationMinutes: durationMinutes
        };

        return { action: 'STOP_UPDATED', stop: this.activeConfirmedStop };
      } else {
        const departureTime = this.lastStationaryTimestamp || point.timestamp;
        const totalDwellMs = departureTime - this.candidateStartTimestamp;
        const durationMinutes = Math.round(totalDwellMs / 60000);

        const finalizedStop = {
          ...this.activeConfirmedStop,
          departureTime: departureTime,
          durationMinutes: durationMinutes,
          isFinalized: true
        };

        this.reset();
        return { action: 'STOP_DEPARTED', stop: finalizedStop };
      }
    }

    return { action: 'NONE', stop: null };
  }
}

function getPlaceTypeFromAddress(address) {
  if (!address) return 'general';

  const tags = Object.keys(address);
  const foodTags = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court'];
  const shopTags = ['mall', 'supermarket', 'department_store', 'convenience', 'shop', 'boutique', 'clothes'];
  const healthTags = ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'];
  const leisureTags = ['park', 'garden', 'playground', 'stadium', 'gym', 'museum', 'tourism', 'hotel', 'motel'];

  for (const tag of tags) {
    if (foodTags.includes(tag) || foodTags.includes(address[tag])) return 'restaurant';
    if (shopTags.includes(tag) || shopTags.includes(address[tag])) return 'mall';
    if (healthTags.includes(tag) || healthTags.includes(address[tag])) return 'hospital';
    if (leisureTags.includes(tag) || leisureTags.includes(address[tag])) return 'park';
  }

  if (address.building === 'office' || address.office) return 'work';
  if (address.house_number || address.residential) return 'home';

  return 'store';
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TravelTrackerExpoApp/1.0 (Contact: developer@example.com)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      let placeName = '';
      let placeType = 'general';

      if (data.address) {
        placeName = data.name ||
                    data.address.amenity ||
                    data.address.shop ||
                    data.address.tourism ||
                    data.address.building ||
                    data.address.road ||
                    data.address.suburb ||
                    'Unknown Place';
        placeType = getPlaceTypeFromAddress(data.address);
      } else {
        placeName = data.display_name ? data.display_name.split(',')[0] : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }

      return {
        placeName: placeName,
        placeType: placeType
      };
    }
  } catch (error) {
    console.warn('OSM Nominatim Geocoder failed. Using fallback.', error);
  }

  return {
    placeName: `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    placeType: 'general'
  };
}

export function extractStopsFromRoutePoints(routePoints, currentStops = [], config = {}) {
  if (!routePoints || routePoints.length === 0) return [];

  const detector = new StopDetector(config);
  const detectedStops = [];

  for (let i = 0; i < routePoints.length; i++) {
    const res = detector.processPoint(routePoints[i]);

    if (res.action === 'STOP_CONFIRMED') {
      const existing = currentStops.find(s => s.id === res.stop.id);
      detectedStops.push({
        ...res.stop,
        placeName: existing?.placeName || res.stop.placeName,
        placeType: existing?.placeType || res.stop.placeType
      });
    } else if (res.action === 'STOP_UPDATED') {
      const idx = detectedStops.findIndex(s => s.id === res.stop.id);
      if (idx > -1) {
        detectedStops[idx] = {
          ...detectedStops[idx],
          durationMinutes: res.stop.durationMinutes
        };
      }
    } else if (res.action === 'STOP_DEPARTED') {
      const idx = detectedStops.findIndex(s => s.id === res.stop.id);
      if (idx > -1) {
        detectedStops[idx] = {
          ...detectedStops[idx],
          departureTime: res.stop.departureTime,
          durationMinutes: res.stop.durationMinutes,
          isFinalized: true
        };
      } else {
        const existing = currentStops.find(s => s.id === res.stop.id);
        detectedStops.push({
          ...res.stop,
          placeName: existing?.placeName || res.stop.placeName,
          placeType: existing?.placeType || res.stop.placeType
        });
      }
    }
  }

  if (detector.state === STOP_STATES.CONFIRMED && detector.activeConfirmedStop) {
    const active = detector.activeConfirmedStop;
    if (!detectedStops.some(s => s.id === active.id)) {
      const existing = currentStops.find(s => s.id === active.id);
      detectedStops.push({
        ...active,
        placeName: existing?.placeName || active.placeName,
        placeType: existing?.placeType || active.placeType
      });
    }
  }

  return detectedStops;
}

// ============================================================================
// SMART TRIP INTELLIGENCE LAYER
// ============================================================================

export const MOVEMENT_STATES = {
  MOVING: 'MOVING',
  STATIONARY: 'STATIONARY',
  GPS_UNCERTAIN: 'GPS_UNCERTAIN'
};

export const TRAVEL_MODES = {
  WALKING: 'WALKING',
  CYCLING: 'CYCLING',
  VEHICLE: 'VEHICLE',
  UNKNOWN: 'UNKNOWN'
};

export const SMART_CONFIG = {
  MAX_ACCURACY_THRESHOLD_METERS: 50,
  MAX_PLAUSIBLE_SPEED_KMH: 180, // Impossible jump threshold (> 180 km/h over short time)
  WALKING_SPEED_LIMIT_KMH: 7,
  CYCLING_SPEED_LIMIT_KMH: 25,
};

/**
 * Validates GPS coordinate quality and detects impossible GPS jumps.
 * @param {Object} newCoords Current point { lat, lng, accuracy, timestamp }
 * @param {Object} [lastValidCoords] Last verified point
 * @returns {Object} { isValid, isJump, isLowAccuracy, distanceKm, reason }
 */
export function validateGpsQuality(newCoords, lastValidCoords = null) {
  if (!newCoords || typeof newCoords.lat !== 'number' || typeof newCoords.lng !== 'number') {
    return { isValid: false, isJump: false, isLowAccuracy: true, distanceKm: 0, reason: 'INVALID_COORDS' };
  }

  // 1. Accuracy Threshold Filter
  const accuracy = newCoords.accuracy ?? null;
  const isLowAccuracy = accuracy !== null && accuracy > SMART_CONFIG.MAX_ACCURACY_THRESHOLD_METERS;

  if (isLowAccuracy) {
    return { isValid: false, isJump: false, isLowAccuracy: true, distanceKm: 0, reason: 'LOW_ACCURACY' };
  }

  if (!lastValidCoords) {
    return { isValid: true, isJump: false, isLowAccuracy: false, distanceKm: 0, reason: 'OK' };
  }

  // 2. Duplicate timestamp & identical coordinate check
  if (newCoords.timestamp <= lastValidCoords.timestamp) {
    if (newCoords.lat === lastValidCoords.lat && newCoords.lng === lastValidCoords.lng) {
      return { isValid: false, isJump: false, isLowAccuracy: false, distanceKm: 0, reason: 'DUPLICATE_POINT' };
    }
  }

  // 3. Impossible Speed / Teleportation Jump Check
  const distanceKm = haversineDistance(lastValidCoords, newCoords);
  const timeDeltaSec = (newCoords.timestamp - lastValidCoords.timestamp) / 1000;

  if (timeDeltaSec > 0) {
    const impliedSpeedKmH = (distanceKm / (timeDeltaSec / 3600));
    // If calculated speed between points exceeds 180 km/h and displacement > 100m, flag as unrealistic jump
    if (impliedSpeedKmH > SMART_CONFIG.MAX_PLAUSIBLE_SPEED_KMH && (distanceKm * 1000) > 100) {
      return { isValid: false, isJump: true, isLowAccuracy: false, distanceKm: 0, reason: 'IMPOSSIBLE_JUMP' };
    }
  }

  return { isValid: true, isJump: false, isLowAccuracy: false, distanceKm, reason: 'OK' };
}

/**
 * Processes GPS speed consistently to km/h, deriving speed from displacement if raw speed is null.
 */
export function processSpeed(newCoords, lastValidCoords = null) {
  if (!newCoords) return 0;

  let speedKmH = 0;
  const rawSpeed = newCoords.speed;

  if (rawSpeed !== undefined && rawSpeed !== null && !isNaN(rawSpeed) && rawSpeed >= 0) {
    speedKmH = rawSpeed > 15 ? rawSpeed : Math.round(rawSpeed * 3.6 * 10) / 10;
  }

  if ((speedKmH === 0 || rawSpeed === null) && lastValidCoords) {
    const distKm = haversineDistance(lastValidCoords, newCoords);
    const timeDeltaHours = (newCoords.timestamp - lastValidCoords.timestamp) / MS_PER_HOUR;
    if (timeDeltaHours > 0 && distKm > 0.005) {
      const derivedSpeed = distKm / timeDeltaHours;
      if (derivedSpeed <= SMART_CONFIG.MAX_PLAUSIBLE_SPEED_KMH) {
        speedKmH = Math.round(derivedSpeed * 10) / 10;
      }
    }
  }

  return Math.min(speedKmH, SMART_CONFIG.MAX_PLAUSIBLE_SPEED_KMH);
}

/**
 * Classifies movement state into MOVING, STATIONARY, or GPS_UNCERTAIN.
 */
export function classifyMovementState(newCoords, speedKmH) {
  if (!newCoords) return MOVEMENT_STATES.GPS_UNCERTAIN;

  const accuracy = newCoords.accuracy ?? null;
  if (accuracy !== null && accuracy > SMART_CONFIG.MAX_ACCURACY_THRESHOLD_METERS) {
    return MOVEMENT_STATES.GPS_UNCERTAIN;
  }

  const speedMps = speedKmH / 3.6;
  if (speedMps <= STOP_CONFIG.STATIONARY_SPEED_THRESHOLD_MPS) {
    return MOVEMENT_STATES.STATIONARY;
  }

  return MOVEMENT_STATES.MOVING;
}

/**
 * Estimates Automatic Travel Mode (WALKING, CYCLING, VEHICLE) based on moving speed distribution.
 */
export function estimateTravelMode(routePoints = []) {
  if (!routePoints || routePoints.length === 0) {
    return TRAVEL_MODES.UNKNOWN;
  }

  const movingSpeeds = routePoints
    .map(p => p.speed)
    .filter(s => typeof s === 'number' && s > 2.88 && !isNaN(s));

  if (movingSpeeds.length === 0) {
    const first = routePoints[0];
    const last = routePoints[routePoints.length - 1];
    let totalDist = 0;
    for (let i = 1; i < routePoints.length; i++) {
      totalDist += haversineDistance(routePoints[i - 1], routePoints[i]);
    }
    const durationHours = (last.timestamp - first.timestamp) / MS_PER_HOUR;
    const avgSpeed = durationHours > 0 ? totalDist / durationHours : 0;

    if (avgSpeed <= 0.5) return TRAVEL_MODES.UNKNOWN;
    if (avgSpeed <= SMART_CONFIG.WALKING_SPEED_LIMIT_KMH) return TRAVEL_MODES.WALKING;
    if (avgSpeed <= SMART_CONFIG.CYCLING_SPEED_LIMIT_KMH) return TRAVEL_MODES.CYCLING;
    return TRAVEL_MODES.VEHICLE;
  }

  movingSpeeds.sort((a, b) => a - b);
  const p75Index = Math.floor(movingSpeeds.length * 0.75);
  const representativeSpeed = movingSpeeds[p75Index];

  if (representativeSpeed <= SMART_CONFIG.WALKING_SPEED_LIMIT_KMH) {
    return TRAVEL_MODES.WALKING;
  } else if (representativeSpeed <= SMART_CONFIG.CYCLING_SPEED_LIMIT_KMH) {
    return TRAVEL_MODES.CYCLING;
  } else {
    return TRAVEL_MODES.VEHICLE;
  }
}

/**
 * Class for tracking trip state transitions and building trip segments.
 */
export class TripSegmentTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.segments = [];
    this.currentSegment = null;
  }

  processPoint(point, movementState) {
    if (!point) return this.segments;

    const timestamp = point.timestamp || Date.now();

    if (!this.currentSegment) {
      this.currentSegment = {
        type: 'TRIP_STARTED',
        state: movementState,
        startTime: timestamp,
        endTime: timestamp,
        startCoords: { lat: point.lat, lng: point.lng },
        endCoords: { lat: point.lat, lng: point.lng },
        pointCount: 1
      };
      this.segments = [this.currentSegment];
      return this.segments;
    }

    if (this.currentSegment.state !== movementState) {
      this.currentSegment.endTime = timestamp;
      this.currentSegment.endCoords = { lat: point.lat, lng: point.lng };

      let segmentType = 'MOVING';
      if (movementState === MOVEMENT_STATES.STATIONARY) {
        segmentType = 'STATIONARY';
      } else if (this.currentSegment.state === MOVEMENT_STATES.STATIONARY && movementState === MOVEMENT_STATES.MOVING) {
        segmentType = 'RESUMED_MOVEMENT';
      } else if (movementState === MOVEMENT_STATES.GPS_UNCERTAIN) {
        segmentType = 'GPS_UNCERTAIN';
      }

      const newSegment = {
        type: segmentType,
        state: movementState,
        startTime: timestamp,
        endTime: timestamp,
        startCoords: { lat: point.lat, lng: point.lng },
        endCoords: { lat: point.lat, lng: point.lng },
        pointCount: 1
      };

      this.currentSegment = newSegment;
      this.segments.push(newSegment);
    } else {
      this.currentSegment.endTime = timestamp;
      this.currentSegment.endCoords = { lat: point.lat, lng: point.lng };
      this.currentSegment.pointCount += 1;
    }

    return this.segments;
  }

  finalize(endTime) {
    if (this.currentSegment) {
      this.currentSegment.endTime = endTime || Date.now();
    }
    return this.segments;
  }
}

