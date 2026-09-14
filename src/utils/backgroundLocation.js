import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getActiveTrip, saveActiveTrip } from './db';
import {
  haversineDistance,
  StopDetector,
  validateGpsQuality,
  processSpeed,
  classifyMovementState,
  estimateTravelMode
} from './location';

export const BACKGROUND_LOCATION_TASK = 'TRAVEL_TRACKER_BACKGROUND_LOCATION';

// Internal module StopDetector instance for background processing
const backgroundStopDetector = new StopDetector();

// Define TaskManager Background Location Task at top-level scope
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }

    if (!data || !data.locations || data.locations.length === 0) {
      return;
    }

    try {
      // 1. Fetch current active trip state from AsyncStorage
      const activeData = await getActiveTrip();
      if (!activeData || !activeData.currentTrip) {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isRunning) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
        return;
      }

      let { currentTrip, routePoints = [], stops = [] } = activeData;
      let tripUpdated = false;

      // 2. Process incoming location updates
      for (const loc of data.locations) {
        const coords = loc.coords;
        const lat = coords.latitude;
        const lng = coords.longitude;
        const altitude = coords.altitude ?? null;
        const rawSpeed = coords.speed ?? null;
        const accuracy = coords.accuracy ?? null;
        const timestamp = loc.timestamp || Date.now();

        // Validate coordinate bounds
        if (
          lat === undefined || lat === null || isNaN(lat) || lat < -90 || lat > 90 ||
          lng === undefined || lng === null || isNaN(lng) || lng < -180 || lng > 180
        ) {
          continue;
        }

        // Avoid duplicate timestamps
        const isDuplicate = routePoints.some(p => Math.abs(p.timestamp - timestamp) < 1000);
        if (isDuplicate) continue;

        const currentPoint = { lat, lng, altitude, speed: rawSpeed, accuracy, timestamp };
        const lastPoint = routePoints.length > 0 ? routePoints[routePoints.length - 1] : null;

        // GPS Quality & Jump Validation
        const qualityRes = validateGpsQuality(currentPoint, lastPoint);
        if (!qualityRes.isValid) {
          // Skip invalid points or false GPS jumps
          continue;
        }

        // Speed processing (km/h)
        const speedKmH = processSpeed(currentPoint, lastPoint);

        // Movement state classification
        const movementState = classifyMovementState(currentPoint, speedKmH);

        const newPoint = {
          id: `pt_${timestamp}`,
          tripId: currentTrip.id,
          lat,
          lng,
          altitude,
          speed: speedKmH,
          accuracy,
          timestamp,
          movementState
        };

        routePoints.push(newPoint);

        // Calculate travel mode estimation across moving points
        const travelMode = estimateTravelMode(routePoints);

        currentTrip = {
          ...currentTrip,
          endTime: timestamp,
          totalDistance: (currentTrip.totalDistance || 0) + qualityRes.distanceKm,
          travelMode: travelMode,
          movementState: movementState
        };

        // Run StopDetector state machine
        const stopResult = backgroundStopDetector.processPoint(newPoint);
        if (stopResult.action === 'STOP_CONFIRMED') {
          stops.push(stopResult.stop);
        } else if (stopResult.action === 'STOP_UPDATED') {
          const idx = stops.findIndex(s => s.id === stopResult.stop.id);
          if (idx > -1) stops[idx].durationMinutes = stopResult.stop.durationMinutes;
        } else if (stopResult.action === 'STOP_DEPARTED') {
          const idx = stops.findIndex(s => s.id === stopResult.stop.id);
          if (idx > -1) {
            stops[idx].departureTime = stopResult.stop.departureTime;
            stops[idx].durationMinutes = stopResult.stop.durationMinutes;
            stops[idx].isFinalized = true;
          }
        }

        tripUpdated = true;
      }

      // 3. Persist updated active trip back to AsyncStorage
      if (tripUpdated) {
        await saveActiveTrip({
          currentTrip,
          routePoints,
          stops
        });
      }

    } catch (err) {
      console.error('Failed to process background location update:', err);
    }
  });
}

/**
 * Starts background location tracking with native permissions check and task deduplication.
 * @returns {Promise<boolean>} True if background tracking started successfully
 */
export async function startBackgroundTracking() {
  if (Platform.OS === 'web') return false;

  try {
    // Check foreground permission
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      console.warn('Foreground location permission denied. Cannot start background tracking.');
      return false;
    }

    // Check background permission
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      console.warn('Background location permission denied or restricted.');
      // Proceeding with foreground tracking fallback
      return false;
    }

    // Check if background task is already running to prevent duplicate tasks
    const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isAlreadyRunning) {
      return true;
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,   // 3 seconds interval
      distanceInterval: 5,   // 5 meters displacement
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true, // Required for iOS status bar indicator
      foregroundService: {
        notificationTitle: 'Travel Tracker Active',
        notificationBody: 'Recording your travel route in the background.',
        notificationColor: '#3b82f6'
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to start background location tracking:', error);
    return false;
  }
}

/**
 * Stops background location tracking.
 */
export async function stopBackgroundTracking() {
  if (Platform.OS === 'web') return;

  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    console.error('Failed to stop background location tracking:', error);
  }
}
