import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { Calendar, Trash2, ArrowLeft, ChevronRight, Compass } from 'lucide-react-native';
import { getStopsForTrip, getRoutePointsForTrip, deleteTrip } from '../utils/db';
import { formatDate, formatTime, formatDistance } from '../utils/format';
import MapSection from './MapSection';
import AnalyticsView from './AnalyticsView';

export default function HistoryList({ pastTrips = [], onTripDeleted }) {
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedStops, setSelectedStops] = useState([]);
  const [selectedPoints, setSelectedPoints] = useState([]);

  // Handles loading details for a selected past trip
  const handleSelectTrip = async (trip) => {
    try {
      const stops = await getStopsForTrip(trip.id);
      const points = await getRoutePointsForTrip(trip.id);
      setSelectedStops(stops);
      setSelectedPoints(points);
      setSelectedTrip(trip);
    } catch (e) {
      console.error('Failed to load details for trip:', e);
    }
  };

  // Handles deleting a past trip
  const handleDeleteTrip = async (tripId) => {
    try {
      await deleteTrip(tripId);
      if (selectedTrip?.id === tripId) {
        setSelectedTrip(null);
      }
      onTripDeleted(); // Refresh parent state list
    } catch (e) {
      console.error('Failed to delete trip:', e);
    }
  };

  // If a trip is selected, render the Detail Replay View
  if (selectedTrip) {
    return (
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setSelectedTrip(null)}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#3b82f6" />
            <Text style={styles.backButtonText}>Back to History</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{formatDate(selectedTrip.startTime)}</Text>
        </View>

        <View style={styles.mapFrame}>
          <MapSection
            homeLocation={selectedTrip.homeLocation}
            stops={selectedStops}
            routePoints={selectedPoints}
            replayMode={true}
          />
        </View>

        <View style={styles.analyticsFrame}>
          <AnalyticsView
            trip={selectedTrip}
            stops={selectedStops}
            routePoints={selectedPoints}
            isTracking={false}
          />
        </View>
      </View>
    );
  }

  // If no history exists, render the Empty state
  if (pastTrips.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color="#475569" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No Past Trips</Text>
        <Text style={styles.emptySubtitle}>You haven't recorded any travel journeys yet.</Text>
      </View>
    );
  }

  const renderTripItem = ({ item }) => {
    const end = item.endTime || Date.now();
    const durationHours = ((end - item.startTime) / (60000 * 60)).toFixed(1);

    return (
      <View style={styles.tripCard}>
        <TouchableOpacity 
          style={styles.tripCardInfo} 
          onPress={() => handleSelectTrip(item)}
          activeOpacity={0.7}
        >
          <View style={styles.tripHeader}>
            <Calendar size={16} color="#3b82f6" style={styles.calendarIcon} />
            <Text style={styles.tripDate}>{formatDate(item.startTime)}</Text>
          </View>
          <Text style={styles.tripTime}>
            {formatTime(item.startTime)} - {formatTime(item.endTime)} ({durationHours} hours)
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statLabel}>Distance: </Text>
            <Text style={styles.statValue}>{formatDistance(item.totalDistance)}</Text>
            <View style={styles.statDot} />
            <Text style={styles.statLabel}>Stops: </Text>
            <Text style={styles.statValue}>{item.stopsCount || 0}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteTrip(item.id)}
          activeOpacity={0.7}
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

      <FlatList
        data={pastTrips}
        keyExtractor={item => item.id}
        renderItem={renderTripItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  tripCardInfo: {
    flex: 1,
    paddingRight: 10,
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
  }
});
