import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Platform, Alert, Dimensions, TouchableOpacity, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

// Utilities
import {
  getHomeLocation,
  saveHomeLocation,
  getHomeGeofenceState,
  saveHomeGeofenceState,
  getTrips,
  saveCompletedTrip,
  saveTrip,
  saveActiveTrip,
  getActiveTrip,
  clearActiveTrip,
  saveStops,
  saveRoutePoints,
  clearAllData,
  getStopsForTrip,
  getRoutePointsForTrip
} from './src/utils/db';

import {
  haversineDistance,
  getDistance,
  isWithinRadius,
  extractStopsFromRoutePoints,
  reverseGeocode,
  calculateAverageSpeed,
  checkHomeGeofenceTransition,
  StopDetector,
  STOP_CONFIG,
  STOP_STATES,
  GEOFENCE_CONFIG,
  GEOFENCE_STATES,
  validateGpsQuality,
  processSpeed,
  classifyMovementState,
  estimateTravelMode,
  TripSegmentTracker,
  MOVEMENT_STATES,
  TRAVEL_MODES
} from './src/utils/location';

import {
  startBackgroundTracking,
  stopBackgroundTracking,
  BACKGROUND_LOCATION_TASK
} from './src/utils/backgroundLocation';

import {
  requestNotificationPermissions,
  notifyTrackingStarted,
  notifyStopDetected,
  notifyLeftHome,
  notifyArrivedHome,
  notifyTripCompleted
} from './src/utils/notifications';

import { formatTime } from './src/utils/format';

// Components
import BottomNav from './src/components/BottomNav';
import MapSection from './src/components/MapSection';
import StopsList from './src/components/StopsList';
import AnalyticsView from './src/components/AnalyticsView';
import HistoryList from './src/components/HistoryList';
import SettingsView from './src/components/SettingsView';

export default function App() {
  // Tabs: 'map' | 'stops' | 'analytics' | 'history' | 'settings'
  const [activeTab, setActiveTab] = useState('map'); 
  const [homeLocation, setHomeLocation] = useState(null);
  const [homeGeofenceState, setHomeGeofenceState] = useState(GEOFENCE_STATES.UNKNOWN);
  const [pastTrips, setPastTrips] = useState([]);
  
  // Active Trip States
  const [isTracking, setIsTracking] = useState(false);
  const [isRecoveredPending, setIsRecoveredPending] = useState(false);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [stops, setStops] = useState([]);
  const [dwellGroup, setDwellGroup] = useState([]);
  
  // Last Trip Analytics Cache (when not tracking)
  const [historyAnalyticsStops, setHistoryAnalyticsStops] = useState([]);
  const [historyAnalyticsRoutePoints, setHistoryAnalyticsRoutePoints] = useState([]);
  
  // Current Location State
  const [currentLocation, setCurrentLocation] = useState(null);
  
  // Configuration settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Stable references for location watcher & state machine evaluation
  const watcherRef = useRef(null);
  const isStartingWatcherRef = useRef(false);
  const stopDetectorRef = useRef(new StopDetector());
  const segmentTrackerRef = useRef(new TripSegmentTracker());
  const isTrackingRef = useRef(isTracking);
  const currentTripRef = useRef(currentTrip);
  const routePointsRef = useRef(routePoints);
  const stopsRef = useRef(stops);
  const homeLocationRef = useRef(homeLocation);
  const homeGeofenceStateRef = useRef(homeGeofenceState);

  // Synchronize state values with stable refs
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { currentTripRef.current = currentTrip; }, [currentTrip]);
  useEffect(() => { routePointsRef.current = routePoints; }, [routePoints]);
  useEffect(() => { stopsRef.current = stops; }, [stops]);
  useEffect(() => { homeLocationRef.current = homeLocation; }, [homeLocation]);
  useEffect(() => { homeGeofenceStateRef.current = homeGeofenceState; }, [homeGeofenceState]);

  // AppState listener: Sync latest active trip state from AsyncStorage when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && isTrackingRef.current) {
        const active = await getActiveTrip();
        if (active && active.currentTrip) {
          setCurrentTrip(active.currentTrip);
          setRoutePoints(active.routePoints || []);
          setStops(active.stops || []);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Load initial configurations and active trip recovery on app mount
  useEffect(() => {
    async function loadData() {
      const home = await getHomeLocation();
      const trips = await getTrips();
      const geoState = await getHomeGeofenceState();
      
      setPastTrips(trips);
      setHomeGeofenceState(geoState);
      setActiveTab('map');

      if (home) {
        setHomeLocation(home);
      }

      // Check for active uncompleted trip recovery from AsyncStorage
      const recoveredActive = await getActiveTrip();
      if (recoveredActive && recoveredActive.currentTrip) {
        setCurrentTrip(recoveredActive.currentTrip);
        setRoutePoints(recoveredActive.routePoints || []);
        setStops(recoveredActive.stops || []);
        setIsRecoveredPending(true); // Prompts user: Resume or Discard
      }
    }
    loadData();
    requestPermissions();
  }, []);

  // Fetch last completed trip's points & stops for main Analytics tab when idle
  useEffect(() => {
    async function loadHistoryAnalytics() {
      if (activeTab === 'analytics' && !isTracking && pastTrips.length > 0) {
        const latestTrip = pastTrips[0];
        try {
          const fetchedStops = await getStopsForTrip(latestTrip.id);
          const fetchedPoints = await getRoutePointsForTrip(latestTrip.id);
          setHistoryAnalyticsStops(fetchedStops);
          setHistoryAnalyticsRoutePoints(fetchedPoints);
        } catch (e) {
          console.error('Failed to load latest trip details for analytics:', e);
        }
      }
    }
    loadHistoryAnalytics();
  }, [activeTab, isTracking, pastTrips]);

  // Request native permissions via central notification module
  const requestPermissions = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus !== 'granted') {
          console.warn('Foreground location permission denied.');
        } else {
          try {
            await Location.requestBackgroundPermissionsAsync();
          } catch (bgErr) {
            console.warn('Background location permission request failed or not supported:', bgErr);
          }
        }
      }
      await requestNotificationPermissions();
    } catch (e) {
      console.error('Failed to request permissions:', e);
    }
  };

  // Alert message dialog box wrapper
  const triggerTextAlert = (title, body) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${body}`);
    } else {
      Alert.alert(title, body);
    }
  };

  // Safe haptic feedback wrapper
  const triggerHaptic = () => {
    try {
      if (Platform.OS === 'web') {
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Haptic feedback not supported or failed:', e);
    }
  };

  // GPS SUBSCRIPTION ENGINE MANAGEMENT
  const startLocationWatcher = async () => {
    if (watcherRef.current || isStartingWatcherRef.current) return;
    isStartingWatcherRef.current = true;

    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          const watchId = navigator.geolocation.watchPosition(
            (pos) => {
              handleLocationUpdate({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  altitude: pos.coords.altitude,
                  speed: pos.coords.speed,
                  accuracy: pos.coords.accuracy
                },
                timestamp: pos.timestamp || Date.now()
              });
            },
            (err) => console.warn('Web watchPosition notice:', err),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
          );
          watcherRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
        }
      } catch (e) {
        console.warn('Failed to start web location watcher:', e);
      } finally {
        isStartingWatcherRef.current = false;
      }
      return;
    }

    try {
      await startBackgroundTracking();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        isStartingWatcherRef.current = false;
        return;
      }

      if (watcherRef.current) {
        isStartingWatcherRef.current = false;
        return;
      }

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2500, // 2.5 seconds update interval
          distanceInterval: 5  // 5 meters displacement threshold
        },
        (locationObj) => {
          handleLocationUpdate(locationObj);
        }
      );
    } catch (e) {
      console.error('Failed to start location watcher:', e);
      watcherRef.current = null;
    } finally {
      isStartingWatcherRef.current = false;
    }
  };

  const stopLocationWatcher = async () => {
    isStartingWatcherRef.current = false;
    if (Platform.OS !== 'web') {
      await stopBackgroundTracking();
    }
    if (watcherRef.current) {
      try {
        watcherRef.current.remove();
      } catch (e) {
        console.warn('Error removing location subscription:', e);
      }
      watcherRef.current = null;
    }
  };

  // Clean up location subscription on unmount
  useEffect(() => {
    return () => {
      stopLocationWatcher();
    };
  }, []);

  // CORE LOCATION UPDATE HANDLER
  const handleLocationUpdate = async (locationInput) => {
    if (!locationInput) return;

    // Standardize coordinate & sensor metadata extraction
    const coords = locationInput.coords || locationInput;
    const lat = coords.latitude ?? coords.lat;
    const lng = coords.longitude ?? coords.lng;
    const altitude = coords.altitude ?? null;
    const rawSpeed = coords.speed ?? null; // m/s from sensor
    const accuracy = coords.accuracy ?? null; // meters
    const timestamp = locationInput.timestamp || Date.now();

    // Validate coordinates range
    if (
      lat === undefined || lat === null || isNaN(lat) || lat < -90 || lat > 90 ||
      lng === undefined || lng === null || isNaN(lng) || lng < -180 || lng > 180
    ) {
      return;
    }

    // Convert speed to km/h (m/s * 3.6)
    const speedKmH = (rawSpeed !== null && rawSpeed >= 0) ? Math.round(rawSpeed * 3.6 * 10) / 10 : 0;

    const currentCoords = { lat, lng, altitude, speed: speedKmH, accuracy, timestamp };
    setCurrentLocation(currentCoords);

    const home = homeLocationRef.current;
    const currentGeofenceState = homeGeofenceStateRef.current;

    // Evaluate Home Geofence State Machine (Transition Triggering Only)
    if (home) {
      const geofenceRes = checkHomeGeofenceTransition(currentCoords, home, currentGeofenceState, 100);

      if (geofenceRes.newState !== currentGeofenceState) {
        setHomeGeofenceState(geofenceRes.newState);
        await saveHomeGeofenceState(geofenceRes.newState);
      }

      if (geofenceRes.transition === 'LEFT_HOME') {
        triggerHaptic();
        await notifyLeftHome(home.name || 'Home', notificationsEnabled);
      } else if (geofenceRes.transition === 'ARRIVED_HOME') {
        triggerHaptic();
        await notifyArrivedHome(home.name || 'Home', notificationsEnabled);
      }
    }

    const trackingActive = isTrackingRef.current;
    const activeTrip = currentTripRef.current;
    const activePoints = routePointsRef.current;
    const activeStops = stopsRef.current;

    if (trackingActive && activeTrip) {
      let lastPoint = activePoints.length > 0 ? activePoints[activePoints.length - 1] : null;

      // Smart GPS Quality & Teleportation Jump Check
      const qualityRes = validateGpsQuality(currentCoords, lastPoint);
      if (!qualityRes.isValid) {
        // Skip inaccurate points or impossible location jumps
        return;
      }

      // Process speed (km/h) consistently
      const speedKmH = processSpeed(currentCoords, lastPoint);

      // Classify current movement state
      const movementState = classifyMovementState(currentCoords, speedKmH);

      const newPoint = {
        id: `pt_${timestamp}`,
        tripId: activeTrip.id,
        lat,
        lng,
        altitude,
        speed: speedKmH,
        accuracy,
        timestamp,
        movementState
      };

      const updatedPoints = [...activePoints, newPoint];

      // Estimate automatic travel mode across moving points
      const travelMode = estimateTravelMode(updatedPoints);

      // Track trip segments
      const segments = segmentTrackerRef.current.processPoint(newPoint, movementState);

      const updatedTrip = {
        ...activeTrip,
        endTime: timestamp,
        totalDistance: (activeTrip.totalDistance || 0) + qualityRes.distanceKm,
        travelMode,
        movementState,
        segments
      };

      setRoutePoints(updatedPoints);
      setCurrentTrip(updatedTrip);

      // Process Automatic Stop Detection State Machine
      const stopResult = stopDetectorRef.current.processPoint(newPoint);
      let updatedStops = [...activeStops];

      if (stopResult.action === 'STOP_CONFIRMED') {
        triggerHaptic();
        const confirmedStop = stopResult.stop;
        updatedStops = [...activeStops, confirmedStop];
        setStops(updatedStops);

        // Notify stop confirmed
        await notifyStopDetected('Resolving address...', notificationsEnabled);

        // Reverse-geocode ONLY WHEN STOP IS CONFIRMED
        reverseGeocode(confirmedStop.lat, confirmedStop.lng).then(async (geo) => {
          setStops(prevStops => {
            const merged = prevStops.map(s => {
              if (s.id === confirmedStop.id) {
                return { ...s, placeName: geo.placeName, placeType: geo.placeType };
              }
              return s;
            });
            saveStops(merged.filter(s => s.id === confirmedStop.id));
            return merged;
          });
        });

      } else if (stopResult.action === 'STOP_UPDATED') {
        updatedStops = activeStops.map(s => {
          if (s.id === stopResult.stop.id) {
            return { ...s, durationMinutes: stopResult.stop.durationMinutes };
          }
          return s;
        });
        setStops(updatedStops);

      } else if (stopResult.action === 'STOP_DEPARTED') {
        updatedStops = activeStops.map(s => {
          if (s.id === stopResult.stop.id) {
            return {
              ...s,
              departureTime: stopResult.stop.departureTime,
              durationMinutes: stopResult.stop.durationMinutes,
              isFinalized: true
            };
          }
          return s;
        });
        setStops(updatedStops);
        saveStops(updatedStops.filter(s => s.id === stopResult.stop.id));
      }

      // Persist active trip payload incrementally to AsyncStorage
      await saveActiveTrip({
        currentTrip: updatedTrip,
        routePoints: updatedPoints,
        stops: updatedStops
      });

      // Check Auto-Stop Geofence: within 100m of Home
      if (home && isWithinRadius(currentCoords, home, 100)) {
        await executeStopTracking(updatedTrip, updatedPoints, updatedStops, true);
      }

    } else if (!isRecoveredPending) {
      // IDLE MODE: Check Auto-Start Geofence: moved > 100m away from Home
      if (home && !isWithinRadius(currentCoords, home, 100)) {
        await executeStartTracking(currentCoords, true);
      }
    }
  };

  // Start trip tracking
  const executeStartTracking = async (startCoordsInput = null, isAutoTriggered = false) => {
    triggerHaptic();

    let initialLocation = startCoordsInput;

    if (!initialLocation && Platform.OS !== 'web') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          initialLocation = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            altitude: loc.coords.altitude,
            speed: (loc.coords.speed && loc.coords.speed >= 0) ? Math.round(loc.coords.speed * 3.6 * 10) / 10 : 0,
            accuracy: loc.coords.accuracy,
            timestamp: loc.timestamp
          };
        }
      } catch (e) {
        console.warn('Failed to fetch initial GPS fix:', e);
      }
    }

    if (!initialLocation && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const webPos = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
              speed: (pos.coords.speed && pos.coords.speed >= 0) ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : 0,
              accuracy: pos.coords.accuracy || 10,
              timestamp: pos.timestamp || Date.now()
            }),
            () => resolve(null),
            { timeout: 4000, enableHighAccuracy: true }
          );
        });
        if (webPos) initialLocation = webPos;
      } catch (e) {
        console.warn('Web geolocation fetch failed:', e);
      }
    }

    initialLocation = initialLocation || currentLocation || homeLocation || {
      lat: 12.9716,
      lng: 77.5946,
      altitude: 0,
      speed: 0,
      accuracy: 10,
      timestamp: Date.now()
    };

    const tripId = `trip_${Date.now()}`;
    const startTimestamp = Date.now();

    // Reset Stop Detector & Segment Tracker state machines
    stopDetectorRef.current.reset();
    segmentTrackerRef.current.reset();

    const initialSpeedKmH = processSpeed(initialLocation, null);
    const initialMovementState = classifyMovementState(initialLocation, initialSpeedKmH);

    const firstPoint = {
      id: `pt_${startTimestamp}`,
      tripId: tripId,
      lat: initialLocation.lat,
      lng: initialLocation.lng,
      altitude: initialLocation.altitude ?? null,
      speed: initialSpeedKmH,
      accuracy: initialLocation.accuracy ?? null,
      timestamp: startTimestamp,
      movementState: initialMovementState
    };

    const initialSegments = segmentTrackerRef.current.processPoint(firstPoint, initialMovementState);

    const newTrip = {
      id: tripId,
      startTime: startTimestamp,
      endTime: null,
      totalDistance: 0,
      travelMode: TRAVEL_MODES.UNKNOWN,
      movementState: initialMovementState,
      segments: initialSegments,
      homeLocation: homeLocation ? { lat: homeLocation.lat, lng: homeLocation.lng } : null
    };

    setIsRecoveredPending(false);
    setCurrentTrip(newTrip);
    setRoutePoints([firstPoint]);
    setStops([]);
    setDwellGroup([firstPoint]);
    setIsTracking(true);

    // Start background location updates & foreground watcher
    await startLocationWatcher();

    // Persist active trip state
    await saveActiveTrip({
      currentTrip: newTrip,
      routePoints: [firstPoint],
      stops: []
    });

    // Notify tracking started
    await notifyTrackingStarted(tripId, notificationsEnabled);
  };

  // Stop trip tracking
  const executeStopTracking = async (tripToSave = null, pointsToSave = null, stopsToSave = null, isAutoTriggered = false) => {
    triggerHaptic();

    // Remove location watcher subscription & background updates
    await stopLocationWatcher();

    const activeTrip = tripToSave || currentTripRef.current;
    const activePoints = pointsToSave || routePointsRef.current;
    const activeStops = stopsToSave || stopsRef.current;

    if (!activeTrip) return;

    const finalSegments = segmentTrackerRef.current.finalize(Date.now());
    const finalTravelMode = estimateTravelMode(activePoints) || activeTrip.travelMode || TRAVEL_MODES.UNKNOWN;

    const completedTrip = {
      ...activeTrip,
      endTime: Date.now(),
      stopsCount: activeStops.length,
      travelMode: finalTravelMode,
      segments: finalSegments
    };

    // Save completed trip, route points, and stops to history
    await saveCompletedTrip(completedTrip);
    await saveRoutePoints(activePoints);
    await saveStops(activeStops);
    await clearActiveTrip();

    // Reset Stop Detector & Segment Tracker
    stopDetectorRef.current.reset();
    segmentTrackerRef.current.reset();

    // Refresh history lists
    const updatedTrips = await getTrips();
    setPastTrips(updatedTrips);

    // Clear active tracking states
    setIsTracking(false);
    setIsRecoveredPending(false);
    setCurrentTrip(null);
    setRoutePoints([]);
    setStops([]);
    setDwellGroup([]);

    // Notify trip completed
    await notifyTripCompleted(completedTrip.id, completedTrip.totalDistance, notificationsEnabled);
  };

  // User Actions for Recovered Active Trip
  const resumeRecoveredTrip = async () => {
    triggerHaptic();
    setIsRecoveredPending(false);
    setIsTracking(true);
    await startLocationWatcher();
    await notifyTrackingStarted(currentTrip?.id, notificationsEnabled);
  };

  const discardRecoveredTrip = async () => {
    triggerHaptic();
    await stopLocationWatcher();
    await clearActiveTrip();
    stopDetectorRef.current.reset();
    setCurrentTrip(null);
    setRoutePoints([]);
    setStops([]);
    setIsTracking(false);
    setIsRecoveredPending(false);
    triggerTextAlert('Trip Discarded', 'The recovered active trip has been discarded.');
  };

  // Refresh history list callback
  const refreshHistoryList = async () => {
    const trips = await getTrips();
    setPastTrips(trips);
  };

  // Clear all data callback
  const handleClearAllData = async () => {
    await stopLocationWatcher();
    stopDetectorRef.current.reset();
    await clearAllData();
    setHomeLocation(null);
    setHomeGeofenceState(GEOFENCE_STATES.UNKNOWN);
    await saveHomeGeofenceState(GEOFENCE_STATES.UNKNOWN);
    setPastTrips([]);
    setIsTracking(false);
    setIsRecoveredPending(false);
    setCurrentTrip(null);
    setRoutePoints([]);
    setStops([]);
    setDwellGroup([]);
    setActiveTab('settings');
    triggerTextAlert('Data Cleared', 'All application data has been successfully deleted.');
  };

  // Clear Home location callback
  const handleClearHomeLocation = async () => {
    setHomeLocation(null);
    await saveHomeLocation(null);
    setHomeGeofenceState(GEOFENCE_STATES.UNKNOWN);
    await saveHomeGeofenceState(GEOFENCE_STATES.UNKNOWN);
  };

  // Render Screens based on selected Bottom Navigation Tab
  const renderScreen = () => {
    switch (activeTab) {
      case 'map':
        return (
          <View style={styles.mapTabContainer}>
            <View style={styles.mapWrapper}>
              <MapSection
                homeLocation={homeLocation}
                currentLocation={currentLocation}
                routePoints={routePoints}
                stops={stops}
                isTracking={isTracking || isRecoveredPending}
              />
            </View>

            {/* Float Tracking Panel */}
            <View style={styles.floatingControlCard}>
              <View style={styles.floatingHeader}>
                <Text style={styles.floatingTitle}>
                  {isRecoveredPending 
                    ? 'Unfinished Trip Recovered' 
                    : isTracking ? 'Recording Journey...' : 'Geofence Tracker Idle'}
                </Text>
                <View style={[
                  styles.statusDot, 
                  isRecoveredPending ? styles.statusWarning : isTracking ? styles.statusActive : styles.statusIdle
                ]} />
              </View>

              <Text style={styles.floatingDesc}>
                {isRecoveredPending
                  ? `Started: ${formatTime(currentTrip?.startTime)} | Distance: ${(currentTrip?.totalDistance || 0).toFixed(2)} km | ${routePoints.length} points`
                  : isTracking 
                    ? `Distance: ${((currentTrip?.totalDistance) || 0).toFixed(2)} km | Stops: ${stops.length}`
                    : 'Trip starts automatically when leaving Home (>100m)'}
              </Text>

              {isRecoveredPending ? (
                <View style={styles.recoveryButtonRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.buttonResume]}
                    onPress={resumeRecoveredTrip}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.mainButtonText}>Resume Trip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.buttonDiscard]}
                    onPress={discardRecoveredTrip}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.mainButtonText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.mainButton, isTracking ? styles.buttonStop : styles.buttonStart]}
                  onPress={isTracking ? () => executeStopTracking(null, null, null, false) : () => executeStartTracking(null, false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.mainButtonText}>
                    {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );

      case 'stops':
        return (
          <StopsList
            stops={stops}
            isTracking={isTracking || isRecoveredPending}
          />
        );

      case 'analytics':
        return (
          <AnalyticsView
            trip={currentTrip || (pastTrips.length > 0 ? pastTrips[0] : null)}
            stops={isTracking || isRecoveredPending ? stops : historyAnalyticsStops}
            routePoints={isTracking || isRecoveredPending ? routePoints : historyAnalyticsRoutePoints}
            isTracking={isTracking || isRecoveredPending}
            allTrips={pastTrips}
          />
        );

      case 'history':
        return (
          <HistoryList
            pastTrips={pastTrips}
            onTripDeleted={refreshHistoryList}
          />
        );

      case 'settings':
        return (
          <SettingsView
            homeLocation={homeLocation}
            onHomeLocationSaved={async (newHome) => {
              setHomeLocation(newHome);
              setHomeGeofenceState(GEOFENCE_STATES.UNKNOWN);
              await saveHomeGeofenceState(GEOFENCE_STATES.UNKNOWN);
              setActiveTab('map');
            }}
            onClearHomeLocation={handleClearHomeLocation}
            onClearAllData={handleClearAllData}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            pastTrips={pastTrips}
            isTracking={isTracking || isRecoveredPending}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <View style={styles.screenContent}>
        {renderScreen()}
      </View>
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  screenContent: {
    flex: 1,
  },
  mapTabContainer: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
  },
  floatingControlCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#ef4444',
  },
  statusWarning: {
    backgroundColor: '#f59e0b',
  },
  statusIdle: {
    backgroundColor: '#475569',
  },
  floatingDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
  },
  mainButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStart: {
    backgroundColor: '#3b82f6',
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  buttonResume: {
    backgroundColor: '#10b981',
  },
  buttonDiscard: {
    backgroundColor: '#ef4444',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
