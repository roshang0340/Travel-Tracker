import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, Switch, Platform, ScrollView } from 'react-native';
import { Home, Trash2, MapPin, Check, RefreshCw, AlertTriangle, Bell, Download, ShieldCheck, Database, HardDrive } from 'lucide-react-native';
import * as Location from 'expo-location';
import { saveHomeLocation, exportTripDataJSON, getTotalPointsCount } from '../utils/db';

export default function SettingsView({
  homeLocation,
  onHomeLocationSaved,
  onClearHomeLocation,
  onClearAllData,
  notificationsEnabled,
  setNotificationsEnabled,
  pastTrips = [],
  isTracking = false
}) {
  const [homeName, setHomeName] = useState(homeLocation?.name || 'Home');
  const [latInput, setLatInput] = useState(homeLocation?.lat ? String(homeLocation.lat) : '');
  const [lngInput, setLngInput] = useState(homeLocation?.lng ? String(homeLocation.lng) : '');
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [totalPointsCount, setTotalPointsCount] = useState(0);

  // Fetch total stored points count for storage summary
  useEffect(() => {
    async function loadStorageMetrics() {
      const count = await getTotalPointsCount();
      setTotalPointsCount(count);
    }
    loadStorageMetrics();
  }, [pastTrips]);

  // Auto-detect current GPS location for Home setting
  const handleDetectGPS = async () => {
    setIsLoadingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable Location services to auto-detect coordinates.');
        setIsLoadingGPS(false);
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      setLatInput(String(loc.coords.latitude));
      setLngInput(String(loc.coords.longitude));
    } catch (e) {
      console.error('Failed to detect GPS location:', e);
      Alert.alert('Error', 'Failed to retrieve current location. Please type manually or retry.');
    } finally {
      setIsLoadingGPS(false);
    }
  };

  // Save the Home Location details
  const handleSaveHome = async () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    const newHome = {
      lat,
      lng,
      name: homeName.trim() || 'Home'
    };

    await saveHomeLocation(newHome);
    onHomeLocationSaved(newHome);
    Alert.alert('Success', 'Home Location saved successfully!');
  };

  // Clear Home Location
  const handleClearHome = async () => {
    setLatInput('');
    setLngInput('');
    setHomeName('Home');
    if (onClearHomeLocation) {
      await onClearHomeLocation();
    }
    Alert.alert('Home Reset', 'Home location and geofence state have been reset.');
  };

  // Handle Local JSON Export
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await exportTripDataJSON();
      if (!res.success) {
        Alert.alert('Export Notice', res.message || 'No trip data available to export.');
      } else {
        if (Platform.OS === 'web') {
          Alert.alert('Export Successful', `Exported ${res.count} trip(s) into JSON file.`);
        } else {
          Alert.alert('Export Ready', `Generated export JSON payload for ${res.count} trip(s).`);
        }
      }
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export Error', 'An error occurred while generating export payload.');
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger prompt for database reset with active trip protection
  const handleClearAllConfirm = () => {
    const warningMsg = isTracking
      ? 'An active trip is currently being recorded. Deleting data will permanently stop tracking and remove all saved trips and home settings.'
      : 'Are you sure you want to clear all data? This will delete all trip history and your home location. This action cannot be undone.';

    if (Platform.OS === 'web') {
      const confirmWeb = window.confirm(warningMsg);
      if (confirmWeb) {
        onClearAllData();
      }
      return;
    }

    Alert.alert(
      isTracking ? 'Active Tracking Warning' : 'Clear All Data',
      warningMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: onClearAllData }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Data Control</Text>
        <Text style={styles.subtitle}>Manage local storage, home geofence, exports, and privacy</Text>
      </View>

      {/* 1. Storage & Data Summary */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <HardDrive size={18} color="#06b6d4" />
          <Text style={styles.sectionTitle}>Local Storage Summary</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{pastTrips.length}</Text>
            <Text style={styles.summaryLabel}>Completed Trips</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryValue, { color: isTracking ? '#10b981' : '#94a3b8' }]}>
              {isTracking ? 'Recording' : 'Idle'}
            </Text>
            <Text style={styles.summaryLabel}>Active Status</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{totalPointsCount}</Text>
            <Text style={styles.summaryLabel}>GPS Points</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.btnSecondary} 
          onPress={handleExportData}
          disabled={isExporting}
          activeOpacity={0.7}
        >
          <Download size={14} color="#3b82f6" />
          <Text style={styles.btnSecondaryText}>{isExporting ? 'Exporting...' : 'Export Trip History (JSON)'}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Home Setup Panel */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Home size={18} color="#10b981" />
          <Text style={styles.sectionTitle}>Home Location & Geofence</Text>
        </View>

        <Text style={styles.sectionDesc}>
          Your Home Location acts as the center geofence. Tracking will auto-stop within 100m, and auto-start when leaving.
        </Text>

        {homeLocation ? (
          <View style={styles.homeStatusBadge}>
            <Check size={14} color="#10b981" />
            <Text style={styles.homeStatusText}>
              Set: {homeLocation.name} ({homeLocation.lat.toFixed(4)}, {homeLocation.lng.toFixed(4)})
            </Text>
          </View>
        ) : (
          <View style={styles.homeStatusBadgeAlert}>
            <AlertTriangle size={14} color="#f59e0b" />
            <Text style={styles.homeStatusTextAlert}>
              Home Location is not set yet.
            </Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Location Name</Text>
          <TextInput
            style={styles.input}
            value={homeName}
            onChangeText={setHomeName}
            placeholder="e.g. Home, My Apartment"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.coordRow}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={styles.label}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={latInput}
              onChangeText={setLatInput}
              keyboardType="numeric"
              placeholder="e.g. 12.9716"
              placeholderTextColor="#64748b"
            />
          </View>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={styles.label}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={lngInput}
              onChangeText={setLngInput}
              keyboardType="numeric"
              placeholder="e.g. 77.5946"
              placeholderTextColor="#64748b"
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.btnSecondary, { flex: 1 }]} 
            onPress={handleDetectGPS}
            disabled={isLoadingGPS}
            activeOpacity={0.7}
          >
            <RefreshCw size={14} color="#3b82f6" />
            <Text style={styles.btnSecondaryText}>{isLoadingGPS ? 'Detecting...' : 'Detect GPS'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btnPrimary, { flex: 1 }]} 
            onPress={handleSaveHome}
            activeOpacity={0.7}
          >
            <MapPin size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>Save Home</Text>
          </TouchableOpacity>
        </View>

        {homeLocation && (
          <TouchableOpacity 
            style={styles.btnClearHome} 
            onPress={handleClearHome}
            activeOpacity={0.7}
          >
            <Text style={styles.btnClearHomeText}>Clear Home Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Notification Preferences */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Bell size={18} color="#3b82f6" />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        
        <View style={styles.switchRow}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.switchLabel}>Enable Local Alerts</Text>
            <Text style={styles.switchDesc}>Get alerts for Welcome Home, Auto-start, and detected stops.</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#334155', true: '#3b82f6' }}
            thumbColor={notificationsEnabled ? '#f8fafc' : '#94a3b8'}
          />
        </View>
      </View>

      {/* 4. Privacy Information Panel */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <ShieldCheck size={18} color="#10b981" />
          <Text style={styles.sectionTitle}>Privacy & Data Security</Text>
        </View>

        <Text style={styles.privacyItem}>
          🔒 <Text style={styles.privacyHighlight}>Local Storage First:</Text> All GPS coordinates, route points, and trip logs are stored strictly on your device using AsyncStorage.
        </Text>
        <Text style={styles.privacyItem}>
          🚫 <Text style={styles.privacyHighlight}>Zero Server Uploads:</Text> Travel history is never sent to external servers, cloud databases, or third-party analytics SDKs.
        </Text>
        <Text style={styles.privacyItem}>
          📥 <Text style={styles.privacyHighlight}>On-Device JSON Export:</Text> Export files are generated entirely on-device and shared via local system controls.
        </Text>
      </View>

      {/* 5. Destructive Data Reset */}
      <View style={[styles.sectionCard, styles.dangerBorder]}>
        <View style={styles.sectionHeader}>
          <Trash2 size={18} color="#ef4444" />
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Delete All Travel Data</Text>
        </View>

        <Text style={styles.sectionDesc}>
          Removes all application-specific travel keys (`travel_tracker_*`), active trip state, home location, and stored history. Unrelated system keys are preserved.
        </Text>

        <TouchableOpacity 
          style={styles.dangerButton} 
          onPress={handleClearAllConfirm}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color="#fff" />
          <Text style={styles.dangerButtonText}>Delete All Local Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dangerBorder: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 12,
  },
  homeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 14,
    gap: 6,
  },
  homeStatusText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  homeStatusBadgeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 14,
    gap: 6,
  },
  homeStatusTextAlert: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingVertical: 10,
    gap: 6,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingVertical: 10,
    gap: 6,
  },
  btnSecondaryText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rotateIcon: {
    // Rotating style can be simulated or omitted on React Native web, this is a placeholder
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  switchDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 6,
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#334155',
  },
  btnClearHome: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 10,
  },
  btnClearHomeText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  privacyItem: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 8,
  },
  privacyHighlight: {
    color: '#f8fafc',
    fontWeight: 'bold',
  }
});
