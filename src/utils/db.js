import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage Keys
const KEYS = {
  ACTIVE_TRIP: 'travel_tracker_active_trip',
  TRIPS: 'travel_tracker_trips',
  STOPS: 'travel_tracker_stops',
  ROUTE_POINTS: 'travel_tracker_route_points',
  SETTINGS: 'travel_tracker_settings',
  HOME_LOCATION: 'travel_tracker_home_location',
  HOME_GEOFENCE_STATE: 'travel_tracker_home_geofence_state',
  GOALS: 'travel_tracker_goals'
};

/**
 * Safely parses JSON data from AsyncStorage.
 * Returns fallback object/array if parsing fails or data is null.
 */
function safeParseJSON(jsonString, fallback = null) {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse AsyncStorage JSON:', e);
    return fallback;
  }
}

// ==========================================
// 1. ACTIVE TRIP MANAGEMENT
// ==========================================

export async function saveActiveTrip(trip) {
  try {
    if (trip) {
      const payload = {
        ...trip,
        lastUpdated: Date.now()
      };
      await AsyncStorage.setItem(KEYS.ACTIVE_TRIP, JSON.stringify(payload));
    } else {
      await clearActiveTrip();
    }
  } catch (error) {
    console.error('Failed to save active trip:', error);
  }
}

export async function getActiveTrip() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ACTIVE_TRIP);
    return safeParseJSON(raw, null);
  } catch (error) {
    console.error('Failed to retrieve active trip:', error);
    return null;
  }
}

export async function clearActiveTrip() {
  try {
    await AsyncStorage.removeItem(KEYS.ACTIVE_TRIP);
  } catch (error) {
    console.error('Failed to clear active trip:', error);
  }
}

// ==========================================
// 2. COMPLETED TRIPS MANAGEMENT
// ==========================================

export async function saveCompletedTrip(trip) {
  if (!trip || !trip.id) {
    console.warn('Attempted to save invalid completed trip:', trip);
    return;
  }
  try {
    const trips = await getTrips();
    const existingIndex = trips.findIndex(t => t.id === trip.id);

    if (existingIndex > -1) {
      trips[existingIndex] = { ...trips[existingIndex], ...trip };
    } else {
      trips.push(trip);
    }

    await AsyncStorage.setItem(KEYS.TRIPS, JSON.stringify(trips));
    
    const active = await getActiveTrip();
    if (active && active.currentTrip && active.currentTrip.id === trip.id) {
      await clearActiveTrip();
    }
  } catch (error) {
    console.error('Failed to save completed trip:', error);
  }
}

export async function saveTrip(trip) {
  return saveCompletedTrip(trip);
}

export async function getTrips() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.TRIPS);
    const trips = safeParseJSON(raw, []);
    if (!Array.isArray(trips)) return [];
    return trips.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  } catch (error) {
    console.error('Failed to retrieve completed trips:', error);
    return [];
  }
}

export async function deleteTrip(tripId) {
  if (!tripId) return;
  try {
    const trips = await getTrips();
    const updatedTrips = trips.filter(t => t.id !== tripId);
    await AsyncStorage.setItem(KEYS.TRIPS, JSON.stringify(updatedTrips));

    const allStops = await getAllStops();
    const updatedStops = allStops.filter(s => s.tripId !== tripId);
    await AsyncStorage.setItem(KEYS.STOPS, JSON.stringify(updatedStops));

    const allPoints = await getAllRoutePoints();
    const updatedPoints = allPoints.filter(p => p.tripId !== tripId);
    await AsyncStorage.setItem(KEYS.ROUTE_POINTS, JSON.stringify(updatedPoints));

    const active = await getActiveTrip();
    if (active && active.currentTrip && active.currentTrip.id === tripId) {
      await clearActiveTrip();
    }
  } catch (error) {
    console.error('Failed to delete trip:', error);
  }
}

// ==========================================
// 3. SETTINGS & HOME LOCATION MANAGEMENT
// ==========================================

export async function saveSettings(settings) {
  try {
    const existing = await getSettings();
    const updated = { ...existing, ...settings };
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
    
    if (settings && settings.homeLocation !== undefined) {
      await saveHomeLocation(settings.homeLocation);
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return safeParseJSON(raw, { notificationsEnabled: true });
  } catch (error) {
    console.error('Failed to retrieve settings:', error);
    return { notificationsEnabled: true };
  }
}

export async function saveHomeLocation(location) {
  try {
    if (location) {
      await AsyncStorage.setItem(KEYS.HOME_LOCATION, JSON.stringify(location));
    } else {
      await AsyncStorage.removeItem(KEYS.HOME_LOCATION);
    }
  } catch (error) {
    console.error('Failed to save home location:', error);
  }
}

export async function getHomeLocation() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HOME_LOCATION);
    return safeParseJSON(raw, null);
  } catch (error) {
    console.error('Failed to retrieve home location:', error);
    return null;
  }
}

/**
 * Saves the current Home geofence state ('HOME' | 'AWAY' | 'UNKNOWN')
 */
export async function saveHomeGeofenceState(state) {
  try {
    if (state) {
      await AsyncStorage.setItem(KEYS.HOME_GEOFENCE_STATE, state);
    } else {
      await AsyncStorage.removeItem(KEYS.HOME_GEOFENCE_STATE);
    }
  } catch (error) {
    console.error('Failed to save home geofence state:', error);
  }
}

/**
 * Retrieves the saved Home geofence state ('HOME' | 'AWAY' | 'UNKNOWN')
 */
export async function getHomeGeofenceState() {
  try {
    const state = await AsyncStorage.getItem(KEYS.HOME_GEOFENCE_STATE);
    return state || 'UNKNOWN';
  } catch (error) {
    console.error('Failed to retrieve home geofence state:', error);
    return 'UNKNOWN';
  }
}

// ==========================================
// 3.5. PERSONAL GOALS STORAGE
// ==========================================

export async function getGoals() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GOALS);
    const goals = safeParseJSON(raw, []);
    if (!Array.isArray(goals)) return [];
    return goals;
  } catch (error) {
    console.error('Failed to retrieve goals:', error);
    return [];
  }
}

export async function saveGoal(goal) {
  if (!goal || !goal.id) return;
  try {
    const goals = await getGoals();
    const existingIndex = goals.findIndex(g => g.id === goal.id);

    if (existingIndex > -1) {
      goals[existingIndex] = { ...goals[existingIndex], ...goal };
    } else {
      goals.push(goal);
    }

    await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
  } catch (error) {
    console.error('Failed to save goal:', error);
  }
}

export async function deleteGoal(goalId) {
  if (!goalId) return;
  try {
    const goals = await getGoals();
    const updated = goals.filter(g => g.id !== goalId);
    await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete goal:', error);
  }
}

// ==========================================
// 4. ROUTE POINTS AND STOPS STORAGE
// ==========================================

async function getAllStops() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STOPS);
    return safeParseJSON(raw, []);
  } catch (error) {
    console.error('Failed to retrieve stops:', error);
    return [];
  }
}

export async function saveStops(newStops) {
  if (!newStops || !Array.isArray(newStops) || newStops.length === 0) return;
  try {
    const allStops = await getAllStops();
    const newStopIds = new Set(newStops.map(s => s.id));
    const filteredStops = allStops.filter(s => !newStopIds.has(s.id));

    filteredStops.push(...newStops);
    await AsyncStorage.setItem(KEYS.STOPS, JSON.stringify(filteredStops));
  } catch (error) {
    console.error('Failed to save stops:', error);
  }
}

export async function getStopsForTrip(tripId) {
  if (!tripId) return [];
  try {
    const allStops = await getAllStops();
    return allStops
      .filter(s => s.tripId === tripId)
      .sort((a, b) => (a.arrivalTime || 0) - (b.arrivalTime || 0));
  } catch (error) {
    console.error('Failed to retrieve stops for trip:', error);
    return [];
  }
}

async function getAllRoutePoints() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ROUTE_POINTS);
    return safeParseJSON(raw, []);
  } catch (error) {
    console.error('Failed to retrieve route points:', error);
    return [];
  }
}

export async function saveRoutePoints(newPoints) {
  if (!newPoints || !Array.isArray(newPoints) || newPoints.length === 0) return;
  try {
    const allPoints = await getAllRoutePoints();
    const newPointIds = new Set(newPoints.map(p => p.id));
    const filteredPoints = allPoints.filter(p => !newPointIds.has(p.id));

    filteredPoints.push(...newPoints);
    await AsyncStorage.setItem(KEYS.ROUTE_POINTS, JSON.stringify(filteredPoints));
  } catch (error) {
    console.error('Failed to save route points:', error);
  }
}

export async function getRoutePointsForTrip(tripId) {
  if (!tripId) return [];
  try {
    const allPoints = await getAllRoutePoints();
    return allPoints
      .filter(p => p.tripId === tripId)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  } catch (error) {
    console.error('Failed to retrieve route points for trip:', error);
    return [];
  }
}

// ==========================================
// 5. GLOBAL DATA RESET & EXPORT HELPERS
// ==========================================

export async function clearAllData() {
  try {
    const keys = Object.values(KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Failed to clear all application data:', error);
  }
}

export async function getTotalPointsCount() {
  try {
    const allPoints = await getAllRoutePoints();
    return allPoints ? allPoints.length : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Exports complete trip history into a sanitized local JSON file.
 */
export async function exportTripDataJSON() {
  try {
    const trips = await getTrips();
    if (!trips || trips.length === 0) {
      return { success: false, reason: 'NO_TRIPS', message: 'No trip data available to export.' };
    }

    const exportedTrips = [];
    for (const trip of trips) {
      const stops = await getStopsForTrip(trip.id);
      const points = await getRoutePointsForTrip(trip.id);
      exportedTrips.push({
        ...trip,
        stops: stops || [],
        routePoints: points || [],
        segments: trip.segments || []
      });
    }

    const exportPayload = {
      appName: 'Travel Tracker',
      exportVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalTrips: exportedTrips.length,
      trips: exportedTrips
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.document) {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `travel_tracker_export_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      return { success: true, count: exportedTrips.length };
    } else {
      return { success: true, count: exportedTrips.length, jsonPayload: jsonString };
    }
  } catch (error) {
    console.error('Failed to export trip history JSON:', error);
    return { success: false, reason: 'ERROR', message: 'Failed to generate export file.' };
  }
}
