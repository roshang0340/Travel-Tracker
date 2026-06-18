import React from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { Utensils, ShoppingBag, Activity, Trees, Briefcase, Home, ShoppingCart, MapPin, Clock } from 'lucide-react-native';
import { formatTime, formatDuration } from '../utils/format';

// Map place category type to Lucide icons
const getPlaceIcon = (type) => {
  switch (type) {
    case 'restaurant': return <Utensils size={18} color="#f59e0b" />;
    case 'mall': return <ShoppingBag size={18} color="#3b82f6" />;
    case 'hospital': return <Activity size={18} color="#ef4444" />;
    case 'park': return <Trees size={18} color="#10b981" />;
    case 'work': return <Briefcase size={18} color="#8b5cf6" />;
    case 'home': return <Home size={18} color="#10b981" />;
    case 'store': return <ShoppingCart size={18} color="#eab308" />;
    default: return <MapPin size={18} color="#94a3b8" />;
  }
};

export default function StopsList({ stops = [], isTracking }) {
  if (!isTracking) {
    return (
      <View style={styles.emptyContainer}>
        <MapPin size={48} color="#475569" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No Active Trip</Text>
        <Text style={styles.emptySubtitle}>Start tracking on the Map tab to begin recording your stops.</Text>
      </View>
    );
  }

  if (stops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Clock size={48} color="#475569" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Tracking Active</Text>
        <Text style={styles.emptySubtitle}>
          No stops recorded yet. If you stay within a 200m area for more than 5 minutes, a stop will automatically be recorded here.
        </Text>
      </View>
    );
  }

  const renderStopItem = ({ item, index }) => {
    return (
      <View style={styles.stopCard}>
        <View style={styles.stopHeader}>
          <View style={styles.iconContainer}>
            {getPlaceIcon(item.placeType)}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.placeName}>{item.placeName}</Text>
            <Text style={styles.timeText}>
              Arrived: {formatTime(item.arrivalTime)}
              {item.departureTime ? ` • Departed: ${formatTime(item.departureTime)}` : ' (Current Stop)'}
            </Text>
          </View>
          <View style={styles.durationContainer}>
            <Text style={styles.durationText}>{formatDuration(item.durationMinutes)}</Text>
          </View>
        </View>
        
        {/* Subtle timeline connector line */}
        {index < stops.length - 1 && <View style={styles.connector} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stops Visited</Text>
        <Text style={styles.subtitle}>List of stops for your current active trip</Text>
      </View>

      <FlatList
        data={stops}
        keyExtractor={item => item.id}
        renderItem={renderStopItem}
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
  stopCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  durationContainer: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  connector: {
    position: 'absolute',
    left: 34,
    bottom: -13,
    width: 2,
    height: 14,
    backgroundColor: '#334155',
    zIndex: -1,
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
