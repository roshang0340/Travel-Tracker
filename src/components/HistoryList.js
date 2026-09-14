import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Calendar, Trash2, ArrowLeft, ChevronRight, MapPin, Clock, AlertCircle, ArrowLeftRight, Gauge, Zap, TrendingUp, CheckCircle, X, Layers } from 'lucide-react-native';
import { getStopsForTrip, getRoutePointsForTrip, deleteTrip } from '../utils/db';
import { formatDate, formatTime, formatDistance, formatDuration } from '../utils/format';
import { validateTripReport, compareTwoTrips } from '../utils/comparison';
import MapSection from './MapSection';
import AnalyticsView from './AnalyticsView';
import TripReplayControls from './TripReplayControls';

export default function HistoryList({ pastTrips = [], onTripDeleted }) {
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedStops, setSelectedStops] = useState([]);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Replay State Machine
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [followMarker, setFollowMarker] = useState(true);
  const timerRef = useRef(null);

  // Comparison State
  const [comparisonTripA, setComparisonTripA] = useState(null);
  const [comparisonTripB, setComparisonTripB] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Handles loading details for a selected past trip
  const handleSelectTrip = async (trip) => {
    setIsLoadingDetails(true);
    try {
      const stops = await getStopsForTrip(trip.id);
      const points = await getRoutePointsForTrip(trip.id);
      setSelectedStops(stops);
      setSelectedPoints(points);
      setSelectedTrip(trip);
      setReplayIndex(0);
      setIsPlayingReplay(false);
    } catch (e) {
      console.error('Failed to load details for trip:', e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleToggleCompare = async (trip) => {
    if (!comparisonTripA) {
      setComparisonTripA(trip);
    } else if (comparisonTripA.id === trip.id) {
      setComparisonTripA(null);
    } else {
      setComparisonTripB(trip);
      setIsLoadingComparison(true);
      try {
        const stopsA = await getStopsForTrip(comparisonTripA.id);
        const pointsA = await getRoutePointsForTrip(comparisonTripA.id);
        const stopsB = await getStopsForTrip(trip.id);
        const pointsB = await getRoutePointsForTrip(trip.id);

        const res = compareTwoTrips(comparisonTripA, trip, stopsA, stopsB, pointsA, pointsB);
        setComparisonResult(res);
        setIsComparing(true);
      } catch (e) {
        console.error('Failed to compare trips:', e);
        Alert.alert('Error', 'Failed to generate comparison data.');
      } finally {
        setIsLoadingComparison(false);
      }
    }
  };

  const handleCloseComparison = () => {
    setIsComparing(false);
    setComparisonResult(null);
    setComparisonTripA(null);
    setComparisonTripB(null);
  };

  // Replay playback timer loop
  useEffect(() => {
    if (isPlayingReplay && selectedPoints.length > 1) {
      const intervalMs = Math.max(100, 1000 / speedMultiplier);
      timerRef.current = setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= selectedPoints.length - 1) {
            setIsPlayingReplay(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlayingReplay, speedMultiplier, selectedPoints]);

  // Clean up replay on trip unselect
  const handleCloseTripDetail = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlayingReplay(false);
    setReplayIndex(0);
    setSelectedTrip(null);
  };

  // Toggle playback
  const handleTogglePlay = () => {
    if (selectedPoints.length < 2) return;
    if (replayIndex >= selectedPoints.length - 1) {
      setReplayIndex(0);
    }
    setIsPlayingReplay(!isPlayingReplay);
  };

  // Restart playback
  const handleRestartReplay = () => {
    setReplayIndex(0);
    setIsPlayingReplay(true);
  };

  // Seek to specific point index
  const handleSeekReplay = (targetIndex) => {
    const validIdx = Math.max(0, Math.min(targetIndex, selectedPoints.length - 1));
    setReplayIndex(validIdx);
  };

  // Trigger confirmation alert before deleting trip
  const handleDeleteTrip = (tripId) => {
    if (Platform.OS === 'web') {
      const confirmWeb = window.confirm('Are you sure you want to delete this trip from your history?');
      if (confirmWeb) {
        confirmDeleteTrip(tripId);
      }
      return;
    }

    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip from your history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteTrip(tripId) }
      ]
    );
  };

  // Perform permanent deletion from AsyncStorage
  const confirmDeleteTrip = async (tripId) => {
    try {
      await deleteTrip(tripId);
      if (selectedTrip?.id === tripId) {
        handleCloseTripDetail();
      }
      if (comparisonTripA?.id === tripId || comparisonTripB?.id === tripId) {
        handleCloseComparison();
      }
      if (onTripDeleted) {
        onTripDeleted();
      }
    } catch (e) {
      console.error('Failed to delete trip:', e);
    }
  };

  // If comparing two trips, render Side-by-Side Comparison View
  if (isComparing && comparisonResult) {
    const { tripA, tripB, summary, metrics } = comparisonResult;

    return (
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleCloseComparison}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#3b82f6" />
            <Text style={styles.backButtonText}>Close Comparison</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>Trip Comparison</Text>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
          {/* Comparison Header Badge */}
          <View style={styles.comparisonHeaderCard}>
            <ArrowLeftRight size={24} color="#3b82f6" style={{ marginBottom: 8 }} />
            <Text style={styles.comparisonHeaderTitle}>Comparing 2 Journeys</Text>
            <Text style={styles.comparisonHeaderSub}>{summary}</Text>
          </View>

          {/* Side by Side Trip Labels */}
          <View style={styles.sideBySideHeader}>
            <View style={[styles.sideCard, { borderColor: '#3b82f6' }]}>
              <Text style={styles.sideBadge}>Trip A</Text>
              <Text style={styles.sideDate}>{formatDate(tripA.trip.startTime)}</Text>
              <Text style={styles.sideTime}>{formatTime(tripA.trip.startTime)}</Text>
            </View>

            <View style={[styles.sideCard, { borderColor: '#8b5cf6' }]}>
              <Text style={[styles.sideBadge, { color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>Trip B</Text>
              <Text style={styles.sideDate}>{formatDate(tripB.trip.startTime)}</Text>
              <Text style={styles.sideTime}>{formatTime(tripB.trip.startTime)}</Text>
            </View>
          </View>

          {/* Metrics Comparison List */}
          <Text style={styles.sectionTitle}>Detailed Comparison</Text>
          {metrics.map((m, idx) => (
            <View key={idx} style={styles.metricRowCard}>
              <Text style={styles.metricRowLabel}>{m.label}</Text>
              <View style={styles.metricValuesRow}>
                <View style={styles.valCol}>
                  <Text style={styles.valSub}>Trip A</Text>
                  <Text style={styles.valText}>{m.formattedA}</Text>
                </View>
                <View style={styles.valCol}>
                  <Text style={styles.valSub}>Trip B</Text>
                  <Text style={styles.valText}>{m.formattedB}</Text>
                </View>
              </View>

              {/* Difference & Winner */}
              <View style={styles.deltaBox}>
                <Text style={styles.deltaText}>Difference: {m.formattedDiff}</Text>
                {m.highlight !== 'EQUAL' && (
                  <View style={[styles.winnerBadge, { backgroundColor: m.highlight === 'TRIP_A' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(139, 92, 246, 0.2)' }]}>
                    <CheckCircle size={12} color={m.highlight === 'TRIP_A' ? '#3b82f6' : '#8b5cf6'} />
                    <Text style={[styles.winnerText, { color: m.highlight === 'TRIP_A' ? '#3b82f6' : '#8b5cf6' }]}>
                      {m.highlight === 'TRIP_A' ? 'Trip A Higher' : 'Trip B Higher'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // If a trip is selected, render the Detail Replay View + Detailed Report
  if (selectedTrip) {
    const currentPoint = selectedPoints[replayIndex] || null;
    const report = validateTripReport(selectedTrip, selectedStops, selectedPoints);

    return (
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleCloseTripDetail}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#3b82f6" />
            <Text style={styles.backButtonText}>Back to History</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{formatDate(selectedTrip.startTime)}</Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.mapFrame}>
            <MapSection
              homeLocation={selectedTrip.homeLocation}
              stops={selectedStops}
              routePoints={selectedPoints}
              replayMode={true}
              replayCurrentIndex={replayIndex}
              followMarker={followMarker}
            />
          </View>

          {/* Replay Controls / Safe Empty Banner */}
          {selectedPoints.length >= 2 ? (
            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
              <TripReplayControls
                isPlaying={isPlayingReplay}
                onTogglePlay={handleTogglePlay}
                onRestart={handleRestartReplay}
                currentIndex={replayIndex}
                totalPoints={selectedPoints.length}
                onSeek={handleSeekReplay}
                speedMultiplier={speedMultiplier}
                onChangeSpeed={setSpeedMultiplier}
                followMarker={followMarker}
                onToggleFollow={() => setFollowMarker(!followMarker)}
                currentPoint={currentPoint}
                totalDistanceKm={selectedTrip.totalDistance || 0}
              />
            </View>
          ) : (
            <View style={styles.legacyNotice}>
              <AlertCircle size={16} color="#f59e0b" />
              <Text style={styles.legacyNoticeText}>
                Replay Unavailable: Not enough recorded GPS points for this trip.
              </Text>
            </View>
          )}

          {/* Detailed Trip Report Summary Card */}
          <View style={styles.reportCard}>
            <View style={styles.reportCardHeader}>
              <TrendingUp size={18} color="#3b82f6" />
              <Text style={styles.reportCardTitle}>Detailed Trip Report</Text>
            </View>
            <View style={styles.reportGrid}>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Distance</Text>
                <Text style={styles.reportValue}>{formatDistance(report.totalDistanceKm)}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Duration</Text>
                <Text style={styles.reportValue}>{formatDuration(report.durationMins)}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Avg Speed</Text>
                <Text style={styles.reportValue}>{report.avgSpeedKmH} km/h</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Max Speed</Text>
                <Text style={styles.reportValue}>{report.maxSpeedKmH} km/h</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Stops Count</Text>
                <Text style={styles.reportValue}>{report.stopsCount}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Total Dwell</Text>
                <Text style={styles.reportValue}>{formatDuration(report.totalDwellMins)}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>Est. Mode</Text>
                <Text style={styles.reportValue}>{report.travelMode}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.reportLabel}>GPS Points</Text>
                <Text style={styles.reportValue}>{report.gpsPointsCount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.analyticsFrame}>
            <AnalyticsView
              trip={selectedTrip}
              stops={selectedStops}
              routePoints={selectedPoints}
              isTracking={false}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // If no history exists, render the Empty state (NO FAKE TRIPS)
  if (!pastTrips || pastTrips.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color="#475569" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No Past Trips</Text>
        <Text style={styles.emptySubtitle}>You haven't recorded any travel journeys yet.</Text>
      </View>
    );
  }

  const getTravelModeLabel = (item) => {
    let mode = item.travelMode;
    if (!mode || mode === 'UNKNOWN') {
      const dist = item.totalDistance || 0;
      const end = item.endTime || Date.now();
      const durHours = (end - item.startTime) / 3600000;
      const avg = durHours > 0 ? dist / durHours : 0;
      if (avg <= 7) mode = 'WALKING';
      else if (avg <= 25) mode = 'CYCLING';
      else mode = 'VEHICLE';
    }
    if (mode === 'WALKING') return '🚶 Walking';
    if (mode === 'CYCLING') return '🚴 Cycling';
    if (mode === 'VEHICLE') return '🚗 Vehicle';
    return '🗺️ Travel';
  };

  const renderTripItem = ({ item }) => {
    const end = item.endTime || Date.now();
    const durationMins = Math.max(0, (end - item.startTime) / 60000);
    const isSelectedA = comparisonTripA?.id === item.id;

    return (
      <View style={[styles.tripCard, isSelectedA && styles.tripCardSelectedA]}>
        <TouchableOpacity 
          style={styles.tripCardInfo} 
          onPress={() => handleSelectTrip(item)}
          activeOpacity={0.7}
        >
          <View style={styles.tripHeader}>
            <Calendar size={16} color="#3b82f6" style={styles.calendarIcon} />
            <Text style={styles.tripDate}>{formatDate(item.startTime)}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#94a3b8', backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
              {getTravelModeLabel(item)}
            </Text>
          </View>

          <Text style={styles.tripTime}>
            {formatTime(item.startTime)} - {item.endTime ? formatTime(item.endTime) : 'In Progress'} • {formatDuration(durationMins)}
          </Text>

          <View style={styles.statsRow}>
            <Text style={styles.statLabel}>Distance: </Text>
            <Text style={styles.statValue}>{formatDistance(item.totalDistance || 0)}</Text>
            <View style={styles.statDot} />
            <Text style={styles.statLabel}>Stops: </Text>
            <Text style={styles.statValue}>{item.stopsCount || 0}</Text>
          </View>
        </TouchableOpacity>

        {/* Compare Button */}
        <TouchableOpacity 
          style={[styles.compareButton, isSelectedA && styles.compareButtonActive]} 
          onPress={() => handleToggleCompare(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Compare trip from ${formatDate(item.startTime)}`}
          accessibilityHint="Selects this trip for side-by-side comparison"
        >
          <ArrowLeftRight size={16} color={isSelectedA ? '#3b82f6' : '#94a3b8'} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteTrip(item.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Delete trip from ${formatDate(item.startTime)}`}
          accessibilityHint="Permanently deletes this trip record"
        >
          <Trash2 size={18} color="#ef4444" />
        </TouchableOpacity>
        
        <ChevronRight size={18} color="#475569" style={styles.chevron} pointerEvents="none" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
        <Text style={styles.subtitle}>All past recorded travel journeys</Text>
      </View>

      {/* Active Comparison Banner */}
      {comparisonTripA && (
        <View style={styles.compareBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compareBannerTitle}>Trip A Selected</Text>
            <Text style={styles.compareBannerSub}>Select a second trip below to compare side-by-side.</Text>
          </View>
          <TouchableOpacity onPress={handleCloseComparison} style={styles.compareBannerClose}>
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}

      {isLoadingComparison ? (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Generating Trip Comparison...</Text>
        </View>
      ) : (
        <FlatList
          data={pastTrips}
          keyExtractor={item => item.id}
          renderItem={renderTripItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    marginBottom: 16,
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
  listContent: {
    paddingBottom: 24,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tripCardSelectedA: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  tripCardInfo: {
    flex: 1,
    paddingRight: 6,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  calendarIcon: {
    marginRight: 6,
  },
  tripDate: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  tripTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  statValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#475569',
    marginHorizontal: 8,
  },
  compareButton: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  compareButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  deleteButton: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginRight: 8,
  },
  chevron: {
    marginLeft: 2,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  mapFrame: {
    height: 250,
  },
  analyticsFrame: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  legacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  legacyNoticeText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    flex: 1,
  },
  // Detailed Report Styles
  reportCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  reportItem: {
    width: '50%',
  },
  reportLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  reportValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  // Comparison Banner Styles
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  compareBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  compareBannerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  compareBannerClose: {
    padding: 4,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  // Side-by-Side Comparison Screen Styles
  comparisonHeaderCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  comparisonHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  comparisonHeaderSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  sideBySideHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sideCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
  },
  sideBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  sideDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  sideTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 12,
  },
  metricRowCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricRowLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  metricValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  valCol: {
    flex: 1,
  },
  valSub: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  valText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  deltaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    pt: 8,
    paddingTop: 8,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  winnerText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
