import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Play, Square, MapPin, FastForward, Navigation, Home, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react-native';

// Standard mock coordinates (based around a central point, e.g. Bengaluru, India)
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [mockTimeOffset, setMockTimeOffset] = useState(0); // in milliseconds

  // Trigger coordinate update with current mock timestamp (simulating time drift)
  const sendLocationUpdate = (lat, lng, name, timeAddMinutes = 0) => {
    const timeDelta = timeAddMinutes * 60 * 1000;
    const newOffset = mockTimeOffset + timeDelta;
    setMockTimeOffset(newOffset);

    const timestamp = Date.now() + newOffset;
    onMockLocationUpdate({
      lat,
      lng,
      timestamp,
      mockName: name
    });
  };

  // Helper to dispatch multiple coordinates sequentially with incremental timestamps
  const sendLocationUpdatesSequentially = (points, timeAddMinutesTotal) => {
    const ptsCount = points.length;
    if (ptsCount === 0) return;

    const timePerPtMins = timeAddMinutesTotal / ptsCount;
    const timePerPtMs = timePerPtMins * 60 * 1000;
    
    let currentOffset = mockTimeOffset;

    points.forEach((pt) => {
      currentOffset += timePerPtMs;
      const ptTimestamp = Date.now() + currentOffset;
      
      onMockLocationUpdate({
        lat: pt.lat,
        lng: pt.lng,
        timestamp: ptTimestamp,
        mockName: pt.name
      });
    });

    setMockTimeOffset(currentOffset);
  };

  const simulateStep = (type) => {
    const home = homeLocation || MOCK_COORDS.HOME;
    
    switch (type) {
      case 'HOME':
        // Move back to home (simulates route from Office, turning onto Home street)
        sendLocationUpdatesSequentially([
          { lat: 12.9812, lng: 77.5998, name: 'Leaving Office' },
          { lat: 12.9716, lng: 77.5998, name: 'Turning onto Main Street' },
          { lat: home.lat, lng: home.lng, name: 'Home' }
        ], 1);
        break;
      case 'LEAVE_HOME':
        // Move >100m away from Home to trigger geofence
        sendLocationUpdatesSequentially([
          { lat: home.lat, lng: home.lng, name: 'Leaving Home' },
          { lat: home.lat + 0.001, lng: home.lng, name: 'Crossing Gate' },
          { lat: home.lat + 0.0015, lng: home.lng + 0.0015, name: 'Leaving Home Area' }
        ], 2);
        break;
      case 'CAFE_ARRIVE':
        // Move to Cafe (~300m away) following street intersections
        sendLocationUpdatesSequentially([
          { lat: home.lat + 0.0015, lng: home.lng + 0.0015, name: 'Walking' },
          { lat: 12.9716, lng: 77.5975, name: 'Turning at Corner' },
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng, name: MOCK_COORDS.CAFE.name }
        ], 3);
        break;
      case 'CAFE_DWELL':
        // Dwell 6 minutes at Cafe
        sendLocationUpdate(MOCK_COORDS.CAFE.lat, MOCK_COORDS.CAFE.lng, MOCK_COORDS.CAFE.name, 6);
        break;
      case 'MALL_ARRIVE':
        // Move to Mall following west road and then north
        sendLocationUpdatesSequentially([
          { lat: MOCK_COORDS.CAFE.lat, lng: MOCK_COORDS.CAFE.lng, name: 'Leaving Cafe' },
          { lat: 12.9735, lng: 77.5921, name: 'West Cross Junction' },
          { lat: MOCK_COORDS.MALL.lat, lng: MOCK_COORDS.MALL.lng, name: MOCK_COORDS.MALL.name }
        ], 4);
        break;
      case 'MALL_DWELL':
        // Dwell 10 minutes at Mall
        sendLocationUpdate(MOCK_COORDS.MALL.lat, MOCK_COORDS.MALL.lng, MOCK_COORDS.MALL.name, 10);
        break;
      case 'OFFICE_ARRIVE':
        // Move to Office following east road and then north
        sendLocationUpdatesSequentially([
          { lat: MOCK_COORDS.MALL.lat, lng: MOCK_COORDS.MALL.lng, name: 'Leaving Mall' },
          { lat: 12.9768, lng: 77.5998, name: 'East Ring Road' },
          { lat: MOCK_COORDS.OFFICE.lat, lng: MOCK_COORDS.OFFICE.lng, name: MOCK_COORDS.OFFICE.name }
        ], 5);
        break;
      case 'OFFICE_DWELL':
        // Dwell 8 minutes at Office
        sendLocationUpdate(MOCK_COORDS.OFFICE.lat, MOCK_COORDS.OFFICE.lng, MOCK_COORDS.OFFICE.name, 8);
        break;
      case 'TAMIL_NADU_TRIP':
        // Run full journey from Thumbur to Villupuram center
        sendLocationUpdatesSequentially([
          // Start at Thumbur (triggers Auto-Start since >100m away from Villupuram Home)
          { lat: 11.9961, lng: 79.4815, name: 'Thumbur Village (Start)' },
          // Drive south on NH 38 bypass road - detailed street coordinates
          { lat: 11.9935, lng: 79.4816, name: 'NH 38 Bypass Road' },
          { lat: 11.9890, lng: 79.4818, name: 'NH 38 Bypass Road' },
          { lat: 11.9840, lng: 79.4820, name: 'NH 38 Bypass Road' },
          { lat: 11.9785, lng: 79.4825, name: 'NH 38 Bypass Road' },
          { lat: 11.9730, lng: 79.4832, name: 'NH 38 Bypass Road' },
          { lat: 11.9680, lng: 79.4839, name: 'NH 38 Bypass Road' },
          { lat: 11.9635, lng: 79.4846, name: 'NH 38 Bypass Road' },
          { lat: 11.9580, lng: 79.4855, name: 'NH 38 Bypass Road' },
          { lat: 11.9535, lng: 79.4866, name: 'NH 38 Bypass Road' },
          { lat: 11.9490, lng: 79.4876, name: 'NH 38 Bypass Road' },
          { lat: 11.9450, lng: 79.4883, name: 'Entering Villupuram Town' },
          { lat: 11.9415, lng: 79.4891, name: 'Junction Road' },
          // Arrive at Junction (Stop)
          { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
          // Dwell at Junction (multiple duplicate coordinates to simulate time spent)
          { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
          { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
          { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
          { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
          { lat: 11.9392, lng: 79.4892, name: 'Villupuram Railway Junction' },
          // Proceed to Villupuram Center
          { lat: 11.9385, lng: 79.4890, name: 'Station Road' },
          { lat: 11.9372, lng: 79.4889, name: 'Station Road' },
          { lat: 11.9370, lng: 79.4870, name: 'South Car Street' },
          { lat: 11.9370, lng: 79.4852, name: 'South Car Street' },
          { lat: 11.9377, lng: 79.4848, name: 'Center Cross Street' },
          { lat: 11.9390, lng: 79.4849, name: 'Center Cross Street' },
          // Move to Villupuram Center (triggers Auto-Stop since <100m from Villupuram Home)
          { lat: 11.9401, lng: 79.4861, name: 'Villupuram Center (Home)' }
        ], 45);
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
          <RefreshCw size={16} color="#3b82f6" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>GPS Simulator Panel</Text>
        </View>
        {isCollapsed ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
      </TouchableOpacity>

      {!isCollapsed && (
        <ScrollView style={styles.content} nestedScrollEnabled={true}>
          <Text style={styles.infoText}>
            Simulate movements to test geofencing (Auto Start/Stop) and stop detection (5 min dwell).
          </Text>

          {!homeLocation && (
            <Text style={[styles.infoText, { color: '#f59e0b', fontWeight: 'bold', marginBottom: 10 }]}>
              Note: Home location is not set. Simulation will use default mock Home coordinates.
            </Text>
          )}

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Simulated Time Offset:</Text>
            <Text style={styles.statusValue}>+{Math.round(mockTimeOffset / 60000)} mins</Text>
            <TouchableOpacity onPress={resetSimulatorTime} style={styles.resetTimeButton}>
              <Text style={styles.resetTimeText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#10b981' }]} 
              onPress={() => simulateStep('HOME')}
            >
              <Home size={14} color="#10b981" />
              <Text style={[styles.simButtonText, { color: '#10b981' }]}>Move Home</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#ef4444' }]} 
              onPress={() => simulateStep('LEAVE_HOME')}
            >
              <Navigation size={14} color="#ef4444" />
              <Text style={[styles.simButtonText, { color: '#ef4444' }]}>Leave Home (&gt;100m)</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Tamil Nadu Route (Thumbur to Villupuram):</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#a855f7' }]} 
              onPress={() => onSetHome && onSetHome(MOCK_COORDS.V_HOME)}
            >
              <Home size={14} color="#a855f7" />
              <Text style={[styles.simButtonText, { color: '#a855f7' }]}>1. Set Home: Villupuram</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simButton, { borderColor: '#06b6d4' }]} 
              onPress={() => simulateStep('TAMIL_NADU_TRIP')}
            >
              <Play size={14} color="#06b6d4" />
              <Text style={[styles.simButtonText, { color: '#06b6d4' }]}>2. Run Route</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Simulate Stop 1 (Cafe):</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => simulateStep('CAFE_ARRIVE')}
            >
              <MapPin size={14} color="#3b82f6" />
              <Text style={styles.simButtonText}>1. Arrive Cafe</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => simulateStep('CAFE_DWELL')}
            >
              <FastForward size={14} color="#f59e0b" />
              <Text style={styles.simButtonText}>2. Dwell 6 Mins</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Simulate Stop 2 (Mall):</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => simulateStep('MALL_ARRIVE')}
            >
              <MapPin size={14} color="#3b82f6" />
              <Text style={styles.simButtonText}>1. Arrive Mall</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => simulateStep('MALL_DWELL')}
            >
              <FastForward size={14} color="#f59e0b" />
              <Text style={styles.simButtonText}>2. Dwell 10 Mins</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Simulate Stop 3 (Office):</Text>
          <View style={styles.buttonGrid}>
            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => simulateStep('OFFICE_ARRIVE')}
            >
              <MapPin size={14} color="#3b82f6" />
              <Text style={styles.simButtonText}>1. Arrive Office</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => simulateStep('OFFICE_DWELL')}
            >
              <FastForward size={14} color="#f59e0b" />
              <Text style={styles.simButtonText}>2. Dwell 8 Mins</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trackingHelperRow}>
            <Text style={styles.helperLabel}>State: {isTracking ? 'TRACKING' : 'IDLE'}</Text>
            <TouchableOpacity 
              style={[styles.trackButton, isTracking ? styles.trackStop : styles.trackStart]}
              onPress={isTracking ? stopTracking : startTracking}
            >
              {isTracking ? <Square size={12} color="#fff" /> : <Play size={12} color="#fff" />}
              <Text style={styles.trackButtonText}>{isTracking ? 'Stop' : 'Start'}</Text>
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
    borderColor: '#334155',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  content: {
    maxHeight: 250,
    padding: 12,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
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
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  simButtonText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '500',
  },
  warningContainer: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 12,
    textAlign: 'center',
  },
  trackingHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingBottom: 4,
  },
  helperLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
