import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
const KEYS = {
  HOME_LOCATION: 'travel_tracker_home_location',
  TRIPS: 'travel_tracker_trips',
  STOPS: 'travel_tracker_stops',
  ROUTE_POINTS: 'travel_tracker_route_points'
};

/**
 * Saves the home location coordinates and address.
 * @param {Object} location - Home location details { lat, lng, name }
 */
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

/**
 * Retrieves the saved home location.
 * @returns {Promise<Object|null>} Saved home location or null
 */
export async function getHomeLocation() {
  try {
    const data = await AsyncStorage.getItem(KEYS.HOME_LOCATION);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to retrieve home location:', error);
    return null;
  }
}

/**
 * Retrieves all saved trips, sorted by start time (newest first).
 * @returns {Promise<Array>} List of trips
 */
export async function getTrips() {
  try {
    const data = await AsyncStorage.getItem(KEYS.TRIPS);
    const trips = data ? JSON.parse(data) : [];
    // Sort by startTime descending
    return trips.sort((a, b) => b.startTime - a.startTime);
  } catch (error) {
    console.error('Failed to retrieve trips:', error);
    return [];
  }
}

/**
 * Saves or updates a completed trip.
 * @param {Object} trip - The trip object to save
 */
export async function saveTrip(trip) {
  try {
    const trips = await getTrips();
    const existingIndex = trips.findIndex(t => t.id === trip.id);
    
    if (existingIndex > -1) {
      trips[existingIndex] = trip;
    } else {
      trips.push(trip);
    }
    
    await AsyncStorage.setItem(KEYS.TRIPS, JSON.stringify(trips));
  } catch (error) {
    console.error('Failed to save trip:', error);
  }
}

/**
 * Retrieves stops for all trips.
 * @returns {Promise<Array>} List of all stops
 */
async function getAllStops() {
  try {
    const data = await AsyncStorage.getItem(KEYS.STOPS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to retrieve stops:', error);
    return [];
  }
}

/**
 * Saves stops for a specific trip.
 * @param {Array} newStops - Stops to add/update
 */
export async function saveStops(newStops) {
  if (!newStops || newStops.length === 0) return;
  try {
    const allStops = await getAllStops();
    // Filter out any existing stops that we are overwriting
    const newStopIds = new Set(newStops.map(s => s.id));
    const filteredStops = allStops.filter(s => !newStopIds.has(s.id));
    
    // Add the new stops
    filteredStops.push(...newStops);
    await AsyncStorage.setItem(KEYS.STOPS, JSON.stringify(filteredStops));
  } catch (error) {
    console.error('Failed to save stops:', error);
  }
}

/**
 * Retrieves all stops associated with a specific trip.
 * @param {string} tripId - The ID of the trip
 * @returns {Promise<Array>} List of stops for the trip
 */
export async function getStopsForTrip(tripId) {
  try {
    const allStops = await getAllStops();
    return allStops
      .filter(s => s.tripId === tripId)
      .sort((a, b) => a.arrivalTime - b.arrivalTime); // Chronological order
  } catch (error) {
    console.error('Failed to retrieve stops for trip:', error);
    return [];
  }
}

/**
 * Retrieves route points for all trips.
 * @returns {Promise<Array>} List of all route points
 */
async function getAllRoutePoints() {
  try {
    const data = await AsyncStorage.getItem(KEYS.ROUTE_POINTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to retrieve route points:', error);
    return [];
  }
}

/**
 * Saves route points for a specific trip.
 * @param {Array} newPoints - Route points to save
 */
export async function saveRoutePoints(newPoints) {
  if (!newPoints || newPoints.length === 0) return;
  try {
    const allPoints = await getAllRoutePoints();
    // Filter out existing points for this trip if we want to overwrite, 
    // or just append them. We'll filter out by matching ID to avoid duplicates.
    const newPointIds = new Set(newPoints.map(p => p.id));
    const filteredPoints = allPoints.filter(p => !newPointIds.has(p.id));
    
    filteredPoints.push(...newPoints);
    await AsyncStorage.setItem(KEYS.ROUTE_POINTS, JSON.stringify(filteredPoints));
  } catch (error) {
    console.error('Failed to save route points:', error);
  }
}

/**
 * Retrieves all route points for a specific trip, sorted chronologically.
 * @param {string} tripId - The ID of the trip
 * @returns {Promise<Array>} List of route points
 */
export async function getRoutePointsForTrip(tripId) {
  try {
    const allPoints = await getAllRoutePoints();
    return allPoints
      .filter(p => p.tripId === tripId)
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to retrieve route points for trip:', error);
    return [];
  }
}

/**
 * Deletes a specific trip and all its associated stops and route points.
 * @param {string} tripId - The ID of the trip to delete
 */
export async function deleteTrip(tripId) {
  try {
    // 1. Remove from Trips list
    const trips = await getTrips();
    const updatedTrips = trips.filter(t => t.id !== tripId);
    await AsyncStorage.setItem(KEYS.TRIPS, JSON.stringify(updatedTrips));

    // 2. Remove associated Stops
    const allStops = await getAllStops();
    const updatedStops = allStops.filter(s => s.tripId !== tripId);
    await AsyncStorage.setItem(KEYS.STOPS, JSON.stringify(updatedStops));

    // 3. Remove associated RoutePoints
    const allPoints = await getAllRoutePoints();
    const updatedPoints = allPoints.filter(p => p.tripId !== tripId);
    await AsyncStorage.setItem(KEYS.ROUTE_POINTS, JSON.stringify(updatedPoints));
  } catch (error) {
    console.error('Failed to delete trip:', error);
  }
}

/**
 * Clears all stored application data from AsyncStorage (resets app).
 */
export async function clearAllData() {
  try {
    const keys = Object.values(KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Failed to clear all data:', error);
  }
}
