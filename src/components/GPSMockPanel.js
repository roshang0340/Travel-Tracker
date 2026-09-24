import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Play, Square, MapPin, FastForward, Navigation, Home, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Compass, Zap, ShieldAlert, Award } from 'lucide-react-native';

// Developer Mock Preset Coordinates
const MOCK_COORDS = {
  HOME: { lat: 12.9716, lng: 77.5946, name: 'Home Sweet Home' },
  CAFE: { lat: 12.9735, lng: 77.5975, name: 'Brew & Beans Cafe' },
  MALL: { lat: 12.9768, lng: 77.5921, name: 'Metro Plaza Mall' },
  OFFICE: { lat: 12.9812, lng: 77.5998, name: 'Tech Park Offices' },
  V_HOME: { lat: 11.9401, lng: 79.4861, name: 'Villupuram Center' },
  V_JUNCTION: { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
  THUMBUR: { lat: 11.9961, lng: 79.4815, name: 'Thumbur Village' }
};

export default function GPSMockPanel({
  onMockLocationUpdate,
  homeLocation,
  isTracking,
  startTracking,
  stopTracking,
  currentLocation,
  onSetHome
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mockTimeOffset, setMockTimeOffset] = useState(0); // in milliseconds

  // Dispatch a simulated GPS coordinate update
  const sendLocationUpdate = (lat, lng, name, speedMps = 5, accuracyMeters = 5, timeAddMinutes = 0) => {
    const timeDelta = timeAddMinutes * 60 * 1000;
    const newOffset = mockTimeOffset + timeDelta;
    setMockTimeOffset(newOffset);

    const timestamp = Date.now() + newOffset;
    onMockLocationUpdate({
      coords: {
        latitude: lat,
        longitude: lng,
        altitude: 15,
        speed: speedMps, // m/s
        accuracy: accuracyMeters
      },
      timestamp,
      mockName: name
    });
  };

  // Dispatch a sequence of coordinates
  const sendLocationUpdatesSequentially = (points, timeAddMinutesTotal, speedMps = 5, accuracyMeters = 5) => {
    const ptsCount = points.length;
    if (ptsCount === 0) return;

    const timePerPtMs = (timeAddMinutesTotal * 60 * 1000) / ptsCount;
    let currentOffset = mockTimeOffset;

    points.forEach((pt) => {
      currentOffset += timePerPtMs;
      const ptTimestamp = Date.now() + currentOffset;

      onMockLocationUpdate({
        coords: {
          latitude: pt.lat,
          longitude: pt.lng,
          altitude: 15,
          speed: pt.speed !== undefined ? pt.speed : speedMps,
          accuracy: pt.accuracy !== undefined ? pt.accuracy : accuracyMeters
        },
        timestamp: ptTimestamp,
        mockName: pt.name
      });
    });

    setMockTimeOffset(currentOffset);
  };

  // DEVELOPER TEST SCENARIOS
  const runScenario = (scenarioType) => {
    const home = homeLocation || MOCK_COORDS.HOME;

    switch (scenarioType) {
      // 1. Moving Route Scenario
      case 'MOVING_ROUTE':
        sendLocationUpdatesSequentially([
          { lat: home.lat, lng: home.lng, name: 'Start Point', speed: 6 },
          { lat: home.lat + 0.001, lng: home.lng + 0.001, name: 'Point A', speed: 7 },
          { lat: home.lat + 0.0025, lng: home.lng + 0.002, name: 'Point B', speed: 8 },
          { lat: home.lat + 0.004, lng: home.lng + 0.0035, name: 'Point C', speed: 7 },
          { lat: home.lat + 0.0055, lng: home.lng + 0.005, name: 'Point D', speed: 6 }
        ], 3, 7, 5);
        break;

      // 2. Stationary Location Scenario
      case 'STATIONARY':
        sendLocationUpdate(currentLocation?.lat || home.lat, currentLocation?.lng || home.lng, 'Stationary Point', 0, 4, 1);
        break;

      // 3. Short Stop (Traffic Signal - 1 min dwell -> should NOT confirm stop)
      case 'SHORT_STOP':
        sendLocationUpdatesSequentially([
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng, name: 'Traffic Signal Stop', speed: 0 },
          { lat: MOCK_COORDS.CAFE.lat + 0.0001, lng: MOCK_COORDS.CAFE.lng + 0.0001, name: 'Traffic Signal Stop', speed: 0 }
        ], 1, 0, 5);
        break;

      // 4. Long Stop (Dwell Confirmed - 4 min dwell -> SHOULD confirm stop)
      case 'LONG_STOP':
        sendLocationUpdatesSequentially([
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng, name: 'Brew & Beans Cafe', speed: 0 },
          { lat: MOCK_COORDS.CAFE.lat + 0.00005, lng: MOCK_COORDS.CAFE.lng, name: 'Brew & Beans Cafe', speed: 0 },
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng + 0.00005, name: 'Brew & Beans Cafe', speed: 0 }
        ], 4, 0, 4);
        break;

      // 5. Multiple Stops Journey
      case 'MULTIPLE_STOPS':
        sendLocationUpdatesSequentially([
          // Stop 1: Cafe (4 mins)
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng, name: 'Cafe Dwell', speed: 0 },
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng, name: 'Cafe Dwell', speed: 0 },
          // Drive to Mall
          { lat: 12.9750, lng: 77.5950, name: 'Driving', speed: 8 },
          // Stop 2: Mall (5 mins)
          { lat: MOCK_COORDS.MALL.lat, lng: MOCK_COORDS.MALL.lng, name: 'Mall Dwell', speed: 0 },
          { lat: MOCK_COORDS.MALL.lat, lng: MOCK_COORDS.MALL.lng, name: 'Mall Dwell', speed: 0 },
          // Drive to Office
          { lat: 12.9790, lng: 77.5960, name: 'Driving', speed: 9 },
          // Stop 3: Office (4 mins)
          { lat: MOCK_COORDS.OFFICE.lat, lng: MOCK_COORDS.OFFICE.lng, name: 'Office Dwell', speed: 0 },
          { lat: MOCK_COORDS.OFFICE.lat, lng: MOCK_COORDS.OFFICE.lng, name: MOCK_COORDS.OFFICE.name, speed: 0 }
        ], 18, 5, 5);
        break;

      // 6. GPS Accuracy Variation
      case 'ACCURACY_HIGH':
        sendLocationUpdate(home.lat + 0.001, home.lng + 0.001, 'High Accuracy GPS (5m)', 6, 5, 1);
        break;

      case 'ACCURACY_LOW':
        sendLocationUpdate(home.lat + 0.015, home.lng + 0.015, 'Poor Accuracy Jump (120m)', 25, 120, 1);
        break;

      // Geofence Tests
      case 'GEOFENCE_EXIT':
        sendLocationUpdatesSequentially([
          { lat: home.lat, lng: home.lng, name: 'At Home', speed: 0 },
          { lat: home.lat + 0.0015, lng: home.lng + 0.0015, name: 'Leaving Home (>100m)', speed: 6 }
        ], 2, 6, 5);
        break;

      case 'GEOFENCE_ENTER':
        sendLocationUpdatesSequentially([
          { lat: home.lat + 0.002, lng: home.lng + 0.002, name: 'Approaching Home', speed: 5 },
          { lat: home.lat, lng: home.lng, name: 'Back Home (<100m)', speed: 0 }
        ], 2, 0, 5);
        break;

      default:
        break;
    }
  };

  const resetSimulatorTime = () => {
    setMockTimeOffset(0);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setIsCollapsed(!isCollapsed)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <ShieldAlert size={15} color="#f59e0b" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>[DEV ONLY] GPS Testing Panel</Text>
        </View>
        {isCollapsed ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
      </TouchableOpacity>

      {!isCollapsed && (
        <ScrollView style={styles.content} nestedScrollEnabled={true}>
          <View style={styles.devBanner}>
            <AlertCircle size={14} color="#f59e0b" />
            <Text style={styles.devBannerText}>
              Developer Simulator Active. Use buttons below to test GPS tracking, stop detection, and geofencing without affecting real native sensors.
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Simulated Time Offset:</Text>
            <Text style={styles.statusValue}>+{Math.round(mockTimeOffset / 60000)} mins</Text>
            <TouchableOpacity onPress={resetSimulatorTime} style={styles.resetTimeButton}>
              <Text style={styles.resetTimeText}>Reset Time</Text>
            </TouchableOpacity>
          </View>

          {/* 7. Start / Stop Tracking Controls */}
          <View style={styles.trackingHelperRow}>
            <Text style={styles.helperLabel}>Tracking State: {isTracking ? 'TRACKING ACTIVE' : 'IDLE'}</Text>
            <TouchableOpacity 
              style={[styles.trackButton, isTracking ? styles.trackStop : styles.trackStart]}
              onPress={isTracking ? stopTracking : startTracking}
            >
              {isTracking ? <Square size={12} color="#fff" /> : <Play size={12} color="#fff" />}
              <Text style={styles.trackButtonText}>{isTracking ? 'Stop Test Trip' : 'Start Test Trip'}</Text>
            </TouchableOpacity>
          </View>

          {/* 1 & 2. Moving Route & Stationary Scenarios */}
          <Text style={styles.sectionLabel}>1 & 2. Route & Movement Scenarios:</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#3b82f6' }]} 
              onPress={() => runScenario('MOVING_ROUTE')}
            >
              <Navigation size={14} color="#3b82f6" />
              <Text style={styles.simButtonText}>1. Moving Route</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#10b981' }]} 
              onPress={() => runScenario('STATIONARY')}
            >
              <MapPin size={14} color="#10b981" />
              <Text style={styles.simButtonText}>2. Stationary Point</Text>
            </TouchableOpacity>
          </View>

          {/* 3 & 4. Short Stop vs Long Stop Scenarios */}
          <Text style={styles.sectionLabel}>3 & 4. Stop Detection Scenarios:</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#64748b' }]} 
              onPress={() => runScenario('SHORT_STOP')}
            >
              <FastForward size={14} color="#64748b" />
              <Text style={styles.simButtonText}>3. Short Stop (1m - No Stop)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#f59e0b' }]} 
              onPress={() => runScenario('LONG_STOP')}
            >
              <Award size={14} color="#f59e0b" />
              <Text style={styles.simButtonText}>4. Long Stop (4m - Confirmed)</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Multiple Stops Scenario */}
          <Text style={styles.sectionLabel}>5. Multi-Stop Journey:</Text>
          <TouchableOpacity 
            style={[styles.simButton, { borderColor: '#a855f7', width: '100%', marginBottom: 8 }]} 
            onPress={() => runScenario('MULTIPLE_STOPS')}
          >
            <Compass size={14} color="#a855f7" />
            <Text style={styles.simButtonText}>5. Run Multi-Stop Route (Cafe ➔ Mall ➔ Office)</Text>
          </TouchableOpacity>

          {/* 6. GPS Accuracy Variation Scenario */}
          <Text style={styles.sectionLabel}>6. GPS Accuracy Filtering Test:</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#10b981' }]} 
              onPress={() => runScenario('ACCURACY_HIGH')}
            >
              <Zap size={14} color="#10b981" />
              <Text style={styles.simButtonText}>6a. Accurate GPS (5m)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#ef4444' }]} 
              onPress={() => runScenario('ACCURACY_LOW')}
            >
              <AlertCircle size={14} color="#ef4444" />
              <Text style={styles.simButtonText}>6b. Poor GPS Jump (120m)</Text>
            </TouchableOpacity>
          </View>

          {/* Geofence Testing */}
          <Text style={styles.sectionLabel}>Geofence State Machine Tests:</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#ef4444' }]} 
              onPress={() => runScenario('GEOFENCE_EXIT')}
            >
              <Navigation size={14} color="#ef4444" />
              <Text style={styles.simButtonText}>Exit Home (&gt;100m)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#10b981' }]} 
              onPress={() => runScenario('GEOFENCE_ENTER')}
            >
              <Home size={14} color="#10b981" />
              <Text style={styles.simButtonText}>Enter Home (&lt;100m)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0f172a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  content: {
    maxHeight: 280,
    padding: 12,
  },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    gap: 8,
  },
  devBannerText: {
    color: '#f59e0b',
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 4,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  statusValue: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
    flex: 1,
  },
  resetTimeButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  resetTimeText: {
    color: '#f8fafc',
    fontSize: 10,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  simButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 6,
  },
  simButtonText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '500',
  },
  trackingHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  helperLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    gap: 4,
  },
  trackStart: {
    backgroundColor: '#10b981',
  },
  trackStop: {
    backgroundColor: '#ef4444',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  }
});
