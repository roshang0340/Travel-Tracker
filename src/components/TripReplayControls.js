import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Play, Pause, RotateCcw, Navigation, Gauge, Clock } from 'lucide-react-native';
import { formatTime } from '../utils/format';

export default function TripReplayControls({
  isPlaying = false,
  onTogglePlay,
  onRestart,
  currentIndex = 0,
  totalPoints = 0,
  onSeek,
  speedMultiplier = 1,
  onChangeSpeed,
  followMarker = true,
  onToggleFollow,
  currentPoint = null,
  totalDistanceKm = 0
}) {
  const progressPercent = totalPoints > 1 ? Math.min(100, Math.max(0, (currentIndex / (totalPoints - 1)) * 100)) : 0;
  const speedDisplay = currentPoint && currentPoint.speed !== undefined && currentPoint.speed !== null 
    ? `${currentPoint.speed.toFixed(1)} km/h` 
    : '0.0 km/h';

  const nextSpeed = speedMultiplier === 1 ? 2 : speedMultiplier === 2 ? 4 : 1;

  return (
    <View style={styles.container}>
      {/* Telemetry Bar */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryItem}>
          <Clock size={14} color="#94a3b8" />
          <Text style={styles.telemetryText}>
            {currentPoint?.timestamp ? formatTime(currentPoint.timestamp) : '--:--'}
          </Text>
        </View>

        <View style={styles.telemetryDivider} />

        <View style={styles.telemetryItem}>
          <Gauge size={14} color="#06b6d4" />
          <Text style={styles.telemetryText}>{speedDisplay}</Text>
        </View>

        <View style={styles.telemetryDivider} />

        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>Point:</Text>
          <Text style={styles.telemetryText}>{totalPoints > 0 ? `${currentIndex + 1}/${totalPoints}` : '0/0'}</Text>
        </View>
      </View>

      {/* Progress Track / Scrubber */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        
        {/* Interactive Step Clickers / Scrubber buttons */}
        <View style={styles.scrubberTouchOverlay}>
          {[0, 0.25, 0.5, 0.75, 1.0].map((fraction, idx) => {
            const targetIdx = Math.floor(fraction * Math.max(0, totalPoints - 1));
            return (
              <TouchableOpacity
                key={idx}
                style={styles.scrubberStepNode}
                onPress={() => onSeek && onSeek(targetIdx)}
                activeOpacity={0.7}
              />
            );
          })}
        </View>
      </View>

      {/* Primary Action Buttons */}
      <View style={styles.controlsRow}>
        {/* Restart */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onRestart}
          activeOpacity={0.7}
        >
          <RotateCcw size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          style={[styles.playButton, isPlaying ? styles.playButtonActive : styles.playButtonIdle]}
          onPress={onTogglePlay}
          activeOpacity={0.8}
        >
          {isPlaying ? (
            <Pause size={22} color="#ffffff" />
          ) : (
            <Play size={22} color="#ffffff" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>

        {/* Speed Multiplier */}
        <TouchableOpacity
          style={styles.speedButton}
          onPress={() => onChangeSpeed && onChangeSpeed(nextSpeed)}
          activeOpacity={0.7}
        >
          <Text style={styles.speedButtonText}>{`${speedMultiplier}x`}</Text>
        </TouchableOpacity>

        {/* Camera Follow Marker Toggle */}
        <TouchableOpacity
          style={[styles.followButton, followMarker ? styles.followButtonActive : styles.followButtonIdle]}
          onPress={onToggleFollow}
          activeOpacity={0.7}
        >
          <Navigation size={16} color={followMarker ? '#3b82f6' : '#64748b'} />
          <Text style={[styles.followButtonText, { color: followMarker ? '#3b82f6' : '#64748b' }]}>
            {followMarker ? 'Camera: On' : 'Camera: Off'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 'bold',
  },
  telemetryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  telemetryDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#334155',
  },
  progressContainer: {
    height: 14,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  scrubberTouchOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scrubberStepNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  playButtonIdle: {
    backgroundColor: '#2563eb',
  },
  playButtonActive: {
    backgroundColor: '#ef4444',
  },
  secondaryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButton: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#06b6d4',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  followButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  followButtonIdle: {
    borderColor: '#334155',
  },
  followButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
