import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Platform, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

// Utilities
import { getHomeLocation, saveHomeLocation, getTrips, saveTrip, saveStops, saveRoutePoints, clearAllData, getStopsForTrip, getRoutePointsForTrip } from './src/utils/db';
import { getDistance, isWithinRadius, extractStopsFromRoutePoints, reverseGeocode } from './src/utils/location';

// Components
import BottomNav from './src/components/BottomNav';
import MapSection from './src/components/MapSection';
import StopsList from './src/components/StopsList';
import AnalyticsView from './src/components/AnalyticsView';
import HistoryList from './src/components/HistoryList';
import SettingsView from './src/components/SettingsView';
import GPSMockPanel from './src/components/GPSMockPanel';

// Configure Notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // Tabs: 'map' | 'stops' | 'analytics' | 'history' | 'settings'
  const [activeTab, setActiveTab] = useState('map'); 
  const [homeLocation, setHomeLocation] = useState(null);
  const [pastTrips, setPastTrips] = useState([]);
  
  // Active Trip States
  const [isTracking, setIsTracking] = useState(false);
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

  // Load initial configurations from AsyncStorage
  useEffect(() => {
    async function loadData() {
      const home = await getHomeLocation();
      const trips = await getTrips();
      
      setPastTrips(trips);
      setActiveTab('map'); // Always default to map tab on load

      if (home) {
        setHomeLocation(home);
      } else {
        console.log('Geofencing features are disabled because home location is not configured.');
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

  // Request native permissions
  const requestPermissions = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        await Location.requestBackgroundPermissionsAsync();
        const { status: notifStatus } = await Notifications.requestPermissionsAsync();
        
        if (locStatus !== 'granted') {
          console.warn('Foreground location permission denied.');
        }
      } else {
        // Request browser notifications permission if on web
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    } catch (e) {
      console.error('Failed to request permissions:', e);
    }
  };

  // Safe wrapper for trigger notifications on both Web and Mobile
  const triggerNotification = async (title, body) => {
    if (!notificationsEnabled) return;

    try {
      if (Platform.OS === 'web') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        } else {
          alert(`${title}\n${body}`);
        }
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title,
            body: body,
            sound: true,
          },
          trigger: null, // immediate
        });
      }
    } catch (e) {
      console.error('Failed to send notification:', e);
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
          navigator.vibrate([100, 50, 100]); // Short vibration pattern
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Haptic feedback not supported or failed:', e);
    }
  };

  // Real device location tracking subscription
  useEffect(() => {
    let subscription = null;

    async function startWatcher() {
      if (Platform.OS === 'web') return; // Simulator panel handles web
      
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        // Watch GPS coordinates every 30 seconds
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000, // 30 seconds
            distanceInterval: 10, // 10 meters minimum update
          },
          (location) => {
            const coords = {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              timestamp: location.timestamp
            };
            handleLocationUpdate(coords);
          }
        );
      } catch (e) {
        console.error('Failed to start native location watcher:', e);
      }
    }

    startWatcher();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTracking, homeLocation, currentTrip, routePoints, stops, dwellGroup]);

  // CORE LOCATION UPDATE HANDLER (Simulated and Real GPS both pass through here)
  const handleLocationUpdate = async (coords) => {
    // coords is { lat, lng, timestamp, mockName }
    setCurrentLocation(coords);

    // Compute distance to Home geofence if home location is defined
    const distanceToHome = homeLocation
      ? getDistance(coords.lat, coords.lng, homeLocation.lat, homeLocation.lng)
      : null;

    if (isTracking) {
      // TRACKING ACTIVE
      
      // Calculate trip metrics
      let lastPoint = routePoints[routePoints.length - 1];
      let distanceAdded = 0;
      if (lastPoint) {
        distanceAdded = getDistance(lastPoint.lat, lastPoint.lng, coords.lat, coords.lng);
      }

      const updatedPoints = [...routePoints, {
        id: `pt_${coords.timestamp}`,
        tripId: currentTrip.id,
        lat: coords.lat,
        lng: coords.lng,
        timestamp: coords.timestamp
      }];

      const updatedTrip = {
        ...currentTrip,
        endTime: coords.timestamp,
        totalDistance: currentTrip.totalDistance + (distanceAdded / 1000) // convert to km
      };

      setRoutePoints(updatedPoints);
      setCurrentTrip(updatedTrip);

      // Extract stops directly from the routePoints line
      const extractedStops = extractStopsFromRoutePoints(updatedPoints, stops);
      setStops(extractedStops);

      // Check if a new stop was detected to reverse-geocode it asynchronously
      const newStops = extractedStops.filter(es => !stops.some(s => s.id === es.id));
      
      if (newStops.length > 0) {
        newStops.forEach(ns => {
          triggerHaptic();
          triggerNotification('New Stop Detected!', `You have dwelled at a new location. Resolving address...`);
          
          reverseGeocode(ns.lat, ns.lng).then(async (geo) => {
            setStops(prevStops => {
              const updated = prevStops.map(s => {
                if (s.id === ns.id) {
                  return { ...s, placeName: geo.placeName, placeType: geo.placeType };
                }
                return s;
              });
              // Auto save updated stops
              saveStops(updated.filter(s => s.id === ns.id));
              return updated;
            });
          });
        });
      }

      // Check Auto-Stop Geofence: within 100m of Home (only if home location is set)
      if (distanceToHome !== null && distanceToHome < 100) {
        await executeStopTracking(updatedTrip, updatedPoints, extractedStops, true);
      }

    } else {
      // TRACKING INACTIVE (IDLE)
      // Check Auto-Start Geofence: moved > 100m away from Home (only if home location is set)
      if (distanceToHome !== null && distanceToHome > 100) {
        await executeStartTracking(coords, true);
      }
    }
  };

  // Start trip tracking
  const executeStartTracking = async (startCoords, isAutoTriggered = false) => {
    triggerHaptic();
    const tripId = `trip_${Date.now()}`;
    const initialLocation = startCoords || currentLocation || homeLocation;

    if (!initialLocation) {
      triggerTextAlert('Error', 'Unable to resolve initial location. Start tracking failed.');
      return;
    }

    const newTrip = {
      id: tripId,
      startTime: Date.now(),
      endTime: null,
      totalDistance: 0,
      homeLocation: homeLocation ? { lat: homeLocation.lat, lng: homeLocation.lng } : null
    };

    const firstPoint = {
      id: `pt_${Date.now()}`,
      tripId: tripId,
      lat: initialLocation.lat,
      lng: initialLocation.lng,
      timestamp: Date.now()
    };

    setCurrentTrip(newTrip);
    setRoutePoints([firstPoint]);
    setStops([]);
    setDwellGroup([firstPoint]);
    setIsTracking(true);

    if (isAutoTriggered) {
      triggerNotification('Trip Started Automatically', 'You have left the Home geofence area. Tracking active.');
    } else {
      triggerNotification('Tracking Started', 'Your travel route is now being recorded.');
    }
  };

  // Stop trip tracking
  const executeStopTracking = async (tripToSave, pointsToSave, stopsToSave, isAutoTriggered = false) => {
    triggerHaptic();
    const activeTrip = tripToSave || currentTrip;
    const activePoints = pointsToSave || routePoints;
    const activeStops = stopsToSave || stops;

    if (!activeTrip) return;

    const completedTrip = {
      ...activeTrip,
      endTime: Date.now(),
      stopsCount: activeStops.length
    };

    // Save all to local database storage (AsyncStorage)
    await saveTrip(completedTrip);
    await saveRoutePoints(activePoints);
    await saveStops(activeStops);

    // Refresh history lists
    const updatedTrips = await getTrips();
    setPastTrips(updatedTrips);

    // Clear active tracking states
    setIsTracking(false);
    setCurrentTrip(null);
    setRoutePoints([]);
    setStops([]);
    setDwellGroup([]);

    if (isAutoTriggered) {
      triggerNotification('Welcome Home!', 'Trip completed and saved successfully.');
      triggerTextAlert('Welcome Home!', 'You have arrived back inside your Home geofence. Tracking stopped and recorded.');
    } else {
      triggerNotification('Tracking Stopped', 'Trip successfully recorded and saved to history.');
    }
  };

  // Refresh history list callback
  const refreshHistoryList = async () => {
    const trips = await getTrips();
    setPastTrips(trips);
  };

  // Clear all data callback
  const handleClearAllData = async () => {
    await clearAllData();
    setHomeLocation(null);
    setPastTrips([]);
    setIsTracking(false);
    setCurrentTrip(null);
    setRoutePoints([]);
    setStops([]);
    setDwellGroup([]);
    setActiveTab('settings');
    triggerTextAlert('Data Cleared', 'All application data has been successfully deleted.');
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
                isTracking={isTracking}
              />
            </View>

            {/* GPS Simulation Panel */}
            <GPSMockPanel
              onMockLocationUpdate={handleLocationUpdate}
              homeLocation={homeLocation}
              isTracking={isTracking}
              startTracking={() => executeStartTracking(null, false)}
              stopTracking={() => executeStopTracking(null, null, null, false)}
              currentLocation={currentLocation}
              onSetHome={async (newHome) => {
                setHomeLocation(newHome);
                await saveHomeLocation(newHome);
              }}
            />

            {/* Float Tracking Panel */}
            <View style={styles.floatingControlCard}>
              <View style={styles.floatingHeader}>
                <Text style={styles.floatingTitle}>
                  {isTracking ? 'Recording Journey...' : 'Geofence Tracker Idle'}
                </Text>
                <View style={[styles.statusDot, isTracking ? styles.statusActive : styles.statusIdle]} />
              </View>
              <Text style={styles.floatingDesc}>
                {isTracking 
                  ? `Distance: ${((currentTrip?.totalDistance) || 0).toFixed(2)} km | Stops: ${stops.length}`
                  : 'Trip starts automatically when leaving Home (>100m)'}
              </Text>
              
              <TouchableOpacity
                style={[styles.mainButton, isTracking ? styles.buttonStop : styles.buttonStart]}
                onPress={isTracking ? () => executeStopTracking(null, null, null, false) : () => executeStartTracking(null, false)}
                activeOpacity={0.8}
              >
                <Text style={styles.mainButtonText}>
                  {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'stops':
        return (
          <StopsList
            stops={stops}
            isTracking={isTracking}
          />
        );

      case 'analytics':
        return (
          <AnalyticsView
            trip={currentTrip || (pastTrips.length > 0 ? pastTrips[0] : null)}
            stops={isTracking ? stops : historyAnalyticsStops}
            routePoints={isTracking ? routePoints : historyAnalyticsRoutePoints}
            isTracking={isTracking}
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
            onHomeLocationSaved={(newHome) => {
              setHomeLocation(newHome);
              setActiveTab('map');
            }}
            onClearAllData={handleClearAllData}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
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
  buttonStart: {
    backgroundColor: '#3b82f6',
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
