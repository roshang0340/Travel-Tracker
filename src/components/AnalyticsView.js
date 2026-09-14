import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Path, Ellipse, G, Circle } from 'react-native-svg';
import { Compass, MapPin, Clock, Award, ArrowRight, Home, CheckCircle, Gauge, Zap, PauseCircle, Activity, BarChart2, TrendingUp, Layers, Target, Plus, Trash2, CheckCircle2 } from 'lucide-react-native';
import { formatDistance, formatDuration, formatTime } from '../utils/format';
import { calculateAverageSpeed } from '../utils/location';
import { calculateAllInsights } from '../utils/insights';
import { getGoals, saveGoal, deleteGoal } from '../utils/db';
import { calculateAllGoalsProgress, validateGoalInput, GOAL_TYPES, GOAL_PERIODS } from '../utils/goals';

/**
 * Computes coordinates along a winding S-shaped Cubic Bezier road curve.
 * Viewport size is x: 0-500, y: 0-250
 */
function getWindingRoadPoint(t) {
  t = Math.max(0, Math.min(1, t));
  
  let p0, p1, p2, p3, tPrime;
  
  if (t < 0.33) {
    tPrime = t / 0.33;
    p0 = { x: 40, y: 200 };
    p1 = { x: 120, y: 200 };
    p2 = { x: 120, y: 110 };
    p3 = { x: 200, y: 110 };
  } else if (t < 0.66) {
    tPrime = (t - 0.33) / 0.33;
    p0 = { x: 200, y: 110 };
    p1 = { x: 280, y: 110 };
    p2 = { x: 280, y: 180 };
    p3 = { x: 360, y: 180 };
  } else {
    tPrime = (t - 0.66) / 0.34;
    p0 = { x: 360, y: 180 };
    p1 = { x: 440, y: 180 };
    p2 = { x: 440, y: 70 };
    p3 = { x: 470, y: 70 };
  }
  
  const mt = 1 - tPrime;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = tPrime * tPrime;
  const t3 = t2 * tPrime;
  
  const x = mt3 * p0.x + 3 * mt2 * tPrime * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
  const y = mt3 * p0.y + 3 * mt2 * tPrime * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
  
  return { x, y };
}

/**
 * Minimalist, vector-only trip path trace component.
 * Renders actual recorded route points on a clean SVG grid.
 */
function RouteTraceView({ homeLocation, stops = [], routePoints = [], isTracking }) {
  const allCoords = [];
  if (homeLocation) allCoords.push({ lat: homeLocation.lat, lng: homeLocation.lng });
  stops.forEach(s => allCoords.push({ lat: s.lat, lng: s.lng }));
  routePoints.forEach(r => allCoords.push({ lat: r.lat, lng: r.lng }));

  if (allCoords.length === 0) {
    return (
      <View style={styles.noTraceWrapper}>
        <Text style={styles.noTraceText}>No route path recorded yet.</Text>
      </View>
    );
  }

  // Calculate bounding box of coordinates
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  allCoords.forEach(c => {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  });

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const paddingFactor = 0.20;

  if (latSpan === 0 || isNaN(latSpan)) {
    minLat -= 0.002;
    maxLat += 0.002;
  } else {
    minLat -= latSpan * paddingFactor;
    maxLat += latSpan * paddingFactor;
  }

  if (lngSpan === 0 || isNaN(lngSpan)) {
    minLng -= 0.002;
    maxLng += 0.002;
  } else {
    minLng -= lngSpan * paddingFactor;
    maxLng += lngSpan * paddingFactor;
  }

  const svgWidth = 320;
  const svgHeight = 280;
  const drawPadding = 30;

  const getXY = (lat, lng) => {
    const latDiff = maxLat - minLat || 1;
    const lngDiff = maxLng - minLng || 1;

    const x = drawPadding + ((lng - minLng) / lngDiff) * (svgWidth - 2 * drawPadding);
    const y = svgHeight - drawPadding - ((lat - minLat) / latDiff) * (svgHeight - 2 * drawPadding);
    return { x, y };
  };

  let pathD = '';
  routePoints.forEach((p, idx) => {
    const { x, y } = getXY(p.lat, p.lng);
    if (idx === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  const homeXY = homeLocation ? getXY(homeLocation.lat, homeLocation.lng) : null;
  const liveXY = isTracking && routePoints.length > 0 ? getXY(routePoints[routePoints.length - 1].lat, routePoints[routePoints.length - 1].lng) : null;

  const startPt = routePoints.length > 0 ? routePoints[0] : null;
  const startXY = startPt ? getXY(startPt.lat, startPt.lng) : null;

  return (
    <View style={styles.traceContainer}>
      <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <Rect width={svgWidth} height={svgHeight} fill="#0b0f19" rx={6} />

        {[1, 2, 3, 4, 5].map((i) => (
          <Line
            key={`v-${i}`}
            x1={(svgWidth / 6) * i}
            y1={0}
            x2={(svgWidth / 6) * i}
            y2={svgHeight}
            stroke="#1e293b"
            strokeWidth="0.8"
            strokeDasharray="4,4"
          />
        ))}
        {[1, 2, 3, 4, 5].map((i) => (
          <Line
            key={`h-${i}`}
            x1={0}
            y1={(svgHeight / 6) * i}
            x2={svgWidth}
            y2={(svgHeight / 6) * i}
            stroke="#1e293b"
            strokeWidth="0.8"
            strokeDasharray="4,4"
          />
        ))}

        {pathD && (
          <Path
            d={pathD}
            fill="none"
            stroke="#020617"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(0, 3.5)"
            opacity={0.6}
          />
        )}

        {pathD !== '' && (
          <Path
            d={pathD}
            fill="none"
            stroke="#2563eb"
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {startXY && (
          <g>
            <Circle cx={startXY.x} cy={startXY.y} r={9} fill="rgba(37, 99, 235, 0.25)" />
            <Circle cx={startXY.x} cy={startXY.y} r={4.5} fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
            
            <g transform={`translate(${startXY.x - 25}, ${startXY.y - 24})`}>
              <Rect width={50} height={16} rx={3} fill="#0f172a" stroke="#ffffff" strokeWidth="1" opacity={0.95} />
              <SvgText
                x={25}
                y={11}
                fill="#ffffff"
                fontSize={8}
                fontWeight="bold"
                textAnchor="middle"
              >
                Start
              </SvgText>
            </g>
          </g>
        )}

        {homeXY && (
          <g>
            <Circle cx={homeXY.x} cy={homeXY.y} r={3} fill="#0f172a" />
            <g transform={`translate(${homeXY.x}, ${homeXY.y})`}>
              <Path
                d="M 0,0 C -4,-6 -7,-9 -7,-14 C -7,-18 -4,-21 0,-21 C 4,-21 7,-18 7,-14 C 7,-9 4,-6 0,0 Z"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={1}
              />
              <Circle cx={0} cy={-14} r={2.5} fill="#ffffff" />
            </g>
            
            <g transform={`translate(${homeXY.x - 35}, ${homeXY.y + 6})`}>
              <Rect width={70} height={18} rx={4} fill="#0f172a" stroke="#10b981" strokeWidth="1.2" opacity={0.95} />
              <SvgText
                x={35}
                y={12}
                fill="#10b981"
                fontSize={8}
                fontWeight="bold"
                textAnchor="middle"
              >
                Home
              </SvgText>
            </g>
          </g>
        )}

        {stops.map((stop, index) => {
          const { x, y } = getXY(stop.lat, stop.lng);
          const displayName = stop.placeName || 'Stop';
          const shortName = displayName.length > 15 ? displayName.substring(0, 13) + '..' : displayName;
          const labelText = `${shortName} (${stop.durationMinutes || 0}m)`;
          const textWidth = Math.max(80, labelText.length * 5.2 + 8);

          return (
            <g key={stop.id || index}>
              <Circle cx={x} cy={y} r={3} fill="#0f172a" />
              
              <g transform={`translate(${x}, ${y})`}>
                <Path
                  d="M 0,0 C -4,-6 -7,-9 -7,-14 C -7,-18 -4,-21 0,-21 C 4,-21 7,-18 7,-14 C 7,-9 4,-6 0,0 Z"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                <Circle cx={0} cy={-14} r={2.5} fill="#ffffff" />
              </g>

              <g transform={`translate(${x + 10}, ${y - 18})`}>
                <Rect
                  width={textWidth}
                  height={18}
                  rx={4}
                  fill="#0f172a"
                  stroke="#2563eb"
                  strokeWidth={1.2}
                  opacity={0.95}
                />
                <SvgText
                  x={textWidth / 2}
                  y={12}
                  fill="#ffffff"
                  fontSize={8}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {labelText}
                </SvgText>
              </g>
            </g>
          );
        })}

        {liveXY && (
          <g>
            <Circle cx={liveXY.x} cy={liveXY.y} r={12} fill="rgba(239, 68, 68, 0.3)" />
            <Circle cx={liveXY.x} cy={liveXY.y} r={4.5} fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
          </g>
        )}
      </Svg>
    </View>
  );
}

export default function AnalyticsView({ trip, stops = [], routePoints = [], isTracking, allTrips = [] }) {
  const [dashboardViewMode, setDashboardViewMode] = useState('dashboard'); // 'trip' | 'dashboard'

  // Memoize deterministic local travel insights calculation
  const insights = useMemo(() => calculateAllInsights(allTrips, stops), [allTrips, stops]);

  // Personal Goals State
  const [userGoals, setUserGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalType, setGoalType] = useState(GOAL_TYPES.DISTANCE);
  const [goalPeriod, setGoalPeriod] = useState(GOAL_PERIODS.WEEKLY);
  const [goalTargetInput, setGoalTargetInput] = useState('');

  // Fetch goals on component mount / allTrips change
  useEffect(() => {
    async function loadUserGoals() {
      const stored = await getGoals();
      setUserGoals(stored);
    }
    loadUserGoals();
  }, [allTrips]);

  // Calculate dynamic goals progress from completed trips
  const goalsProgressList = useMemo(() => {
    return calculateAllGoalsProgress(userGoals, allTrips);
  }, [userGoals, allTrips]);

  const handleCreateGoal = async () => {
    const valRes = validateGoalInput(goalType, goalTargetInput, goalPeriod);
    if (!valRes.isValid) {
      Alert.alert('Invalid Goal', valRes.reason);
      return;
    }

    const newGoal = {
      id: `goal_${Date.now()}`,
      type: goalType,
      target: valRes.target,
      period: goalPeriod,
      createdAt: Date.now(),
      enabled: true
    };

    await saveGoal(newGoal);
    const updated = await getGoals();
    setUserGoals(updated);
    setGoalTargetInput('');
    setShowGoalForm(false);
  };

  const handleDeleteGoal = async (goalId) => {
    await deleteGoal(goalId);
    const updated = await getGoals();
    setUserGoals(updated);
  };

  // Empty State Check: If no trip data and no past trips exist
  const hasTripData = trip || (allTrips && allTrips.length > 0) || stops.length > 0 || routePoints.length > 0;

  if (!hasTripData) {
    return (
      <View style={styles.emptyContainer}>
        <Compass size={48} color="#475569" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No Trip Data Available</Text>
        <Text style={styles.emptySubtitle}>
          Start tracking on the Map tab or record travel journeys to unlock the Advanced Analytics Dashboard.
        </Text>
      </View>
    );
  }

  // ============================================================================
  // ALL-TIME OVERALL TRAVEL DASHBOARD CALCULATIONS (MEMOIZED)
  // ============================================================================
  const allTimeMetrics = useMemo(() => {
    const totalTripsCount = allTrips.length;
    const overallDistanceKm = allTrips.reduce((sum, t) => sum + (t.totalDistance || 0), 0);
    
    const overallTravelTimeMins = allTrips.reduce((sum, t) => {
      if (!t.startTime) return sum;
      const end = t.endTime || Date.now();
      return sum + Math.max(0, (end - t.startTime) / 60000);
    }, 0);

    const avgTripDistanceKm = totalTripsCount > 0 ? overallDistanceKm / totalTripsCount : 0;
    const avgTripDurationMins = totalTripsCount > 0 ? overallTravelTimeMins / totalTripsCount : 0;
    const overallAvgSpeedKmH = overallTravelTimeMins > 0 ? overallDistanceKm / (overallTravelTimeMins / 60) : 0;

    // Max Speed Recorded across current routePoints and stored trip metadata
    const maxSpeedFromCurrent = routePoints.length > 0 ? Math.max(...routePoints.map(p => p.speed || 0), 0) : 0;
    const overallMaxSpeedKmH = Math.max(maxSpeedFromCurrent, ...allTrips.map(t => t.maxSpeed || 0), overallAvgSpeedKmH);

    // Stop Statistics Across All Trips
    const overallStopsCount = allTrips.reduce((sum, t) => sum + (t.stopsCount || 0), 0);

    // Travel Mode Analysis Breakdown (WALKING, CYCLING, VEHICLE)
    const modeStats = {
      WALKING: { count: 0, distanceKm: 0, durationMins: 0 },
      CYCLING: { count: 0, distanceKm: 0, durationMins: 0 },
      VEHICLE: { count: 0, distanceKm: 0, durationMins: 0 }
    };

    allTrips.forEach(t => {
      let mode = t.travelMode;
      if (!mode || mode === 'UNKNOWN') {
        const dist = t.totalDistance || 0;
        const end = t.endTime || Date.now();
        const durHours = (end - t.startTime) / 3600000;
        const avg = durHours > 0 ? dist / durHours : 0;
        if (avg <= 7) mode = 'WALKING';
        else if (avg <= 25) mode = 'CYCLING';
        else mode = 'VEHICLE';
      }

      if (modeStats[mode]) {
        modeStats[mode].count += 1;
        modeStats[mode].distanceKm += t.totalDistance || 0;
        const end = t.endTime || Date.now();
        modeStats[mode].durationMins += Math.max(0, (end - t.startTime) / 60000);
      }
    });

    return {
      totalTripsCount,
      overallDistanceKm,
      overallTravelTimeMins,
      avgTripDistanceKm,
      avgTripDurationMins,
      overallAvgSpeedKmH,
      overallMaxSpeedKmH,
      overallStopsCount,
      modeStats
    };
  }, [allTrips, routePoints]);

  const {
    totalTripsCount,
    overallDistanceKm,
    overallTravelTimeMins,
    avgTripDistanceKm,
    avgTripDurationMins,
    overallAvgSpeedKmH,
    overallMaxSpeedKmH,
    overallStopsCount,
    modeStats
  } = allTimeMetrics;

  // ============================================================================
  // SINGLE TRIP SPECIFIC METRICS
  // ============================================================================
  const totalDistance = trip?.totalDistance || 0;
  let durationMinutes = 0;
  if (trip?.startTime) {
    const endTime = trip.endTime || Date.now();
    durationMinutes = Math.max(0, (endTime - trip.startTime) / 60000);
  }
  const avgSpeedKmH = calculateAverageSpeed(
    totalDistance,
    trip?.startTime || 0,
    trip?.endTime || Date.now()
  );
  let maxSpeedKmH = 0;
  if (routePoints && routePoints.length > 0) {
    const speeds = routePoints.map(p => p.speed || 0);
    maxSpeedKmH = Math.max(...speeds, 0);
  }
  const stopsCount = stops.length;
  const totalStopDurationMinutes = stops.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  let longestStop = null;
  if (stops.length > 0) {
    longestStop = [...stops].sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0))[0];
  }

  // Render Custom SVG Bar Chart of Stop Durations
  const renderBarChart = () => {
    if (stops.length === 0) {
      return (
        <View style={styles.noChartContainer}>
          <Text style={styles.noChartText}>No confirmed stops recorded to chart.</Text>
        </View>
      );
    }

    const svgWidth = 320;
    const svgHeight = 150;
    const chartHeight = 110;
    const paddingLeft = 30;
    const paddingRight = 10;
    const chartWidth = svgWidth - paddingLeft - paddingRight;

    const maxDuration = Math.max(...stops.map(s => s.durationMinutes || 0), 1);
    const barWidth = Math.min(30, (chartWidth / stops.length) * 0.6);
    const spacing = (chartWidth - barWidth * stops.length) / (stops.length + 1);

    return (
      <View style={styles.chartWrapper}>
        <Text style={styles.sectionTitle}>Stop Durations (Minutes)</Text>
        <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <Line
            x1={paddingLeft}
            y1={chartHeight}
            x2={svgWidth - paddingRight}
            y2={chartHeight}
            stroke="#475569"
            strokeWidth="1"
          />

          {stops.map((stop, index) => {
            const duration = stop.durationMinutes || 0;
            const barHeight = (duration / maxDuration) * (chartHeight - 30);
            const finalBarHeight = duration > 0 ? Math.max(barHeight, 6) : 0;
            const x = paddingLeft + spacing + index * (barWidth + spacing);
            const y = chartHeight - finalBarHeight;

            const name = stop.placeName || 'Stop';
            const displayName = name.length > 6 ? name.substring(0, 5) + '..' : name;

            return (
              <g key={stop.id || index}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={finalBarHeight}
                  fill="#3b82f6"
                  rx="3"
                />
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 6}
                  fill="#f8fafc"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {`${duration}m`}
                </SvgText>
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight + 16}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {displayName}
                </SvgText>
              </g>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Render Visual Winding Road stop graph
  const renderJourneyFlow = () => {
    const roadPathD = "M 40,200 C 120,200 120,110 200,110 C 280,110 280,180 360,180 C 440,180 440,70 470,70";

    const nodes = [];
    nodes.push({
      type: 'start',
      label: 'Start',
      sublabel: formatTime(trip?.startTime),
      color: '#06b6d4'
    });

    stops.forEach((stop, index) => {
      const name = stop.placeName || 'Stop';
      const shortName = name.length > 12 ? name.substring(0, 10) + '..' : name;
      nodes.push({
        type: 'stop',
        label: shortName,
        sublabel: `${stop.durationMinutes || 0}m spent`,
        color: index % 3 === 0 ? '#eab308' : index % 3 === 1 ? '#ef4444' : '#a855f7'
      });
    });

    nodes.push({
      type: 'end',
      label: trip?.endTime ? 'Returned' : 'Tracking',
      sublabel: trip?.endTime ? formatTime(trip.endTime) : 'Active',
      color: trip?.endTime ? '#10b981' : '#3b82f6'
    });

    const totalNodes = nodes.length;

    return (
      <View style={styles.flowWrapper}>
        <Text style={styles.sectionTitle}>Journey Stop-Route Visualization</Text>
        
        <View style={styles.svgContainerOuter}>
          <Svg width="100%" height={260} viewBox="0 0 500 250">
            <Path
              d={roadPathD}
              fill="none"
              stroke="#090d16"
              strokeWidth={26}
              strokeLinecap="round"
              transform="translate(0, 4)"
              opacity={0.6}
            />

            <Path
              d={roadPathD}
              fill="none"
              stroke="#475569"
              strokeWidth={24}
              strokeLinecap="round"
            />

            <Path
              d={roadPathD}
              fill="none"
              stroke="#1e293b"
              strokeWidth={20}
              strokeLinecap="round"
            />

            <Path
              d={roadPathD}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2}
              strokeDasharray="8,6"
              strokeLinecap="round"
              opacity={0.8}
            />

            {nodes.map((node, index) => {
              const t = totalNodes > 1 ? index / (totalNodes - 1) : 0.5;
              const { x, y } = getWindingRoadPoint(t);
              const pinPathD = `M 0,0 C -5,-8 -9,-12 -9,-17 C -9,-22 -5,-25 0,-25 C 5,-25 9,-22 9,-17 C 9,-12 5,-8 0,0 Z`;

              const isEven = index % 2 === 0;
              const textYOffset = isEven ? -32 : 18;
              const subtextYOffset = isEven ? -22 : 28;

              return (
                <G key={index}>
                  <Ellipse
                    cx={x}
                    cy={y + 1}
                    rx={5}
                    ry={2}
                    fill="#000000"
                    opacity={0.4}
                  />

                  <G transform={`translate(${x}, ${y})`}>
                    <Path
                      d={pinPathD}
                      fill={node.color}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                    />
                    <Circle
                      cx={0}
                      cy={-17}
                      r={3}
                      fill="#ffffff"
                    />
                  </G>

                  <SvgText
                    x={x}
                    y={y + textYOffset}
                    fill="#f8fafc"
                    fontSize="9.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    paintOrder="stroke"
                  >
                    {node.label}
                  </SvgText>

                  <SvgText
                    x={x}
                    y={y + subtextYOffset}
                    fill="#94a3b8"
                    fontSize="8"
                    fontWeight="500"
                    textAnchor="middle"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    paintOrder="stroke"
                  >
                    {node.sublabel}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      </View>
    );
  };

  // Build Chronological Timeline Items
  const timelineEvents = [];
  
  if (trip?.startTime) {
    timelineEvents.push({
      type: 'start',
      time: trip.startTime,
      title: 'Started Trip',
      subtitle: 'Left starting location'
    });
  }

  stops.forEach(stop => {
    timelineEvents.push({
      type: 'stop_arrive',
      time: stop.arrivalTime,
      title: `Arrived at ${stop.placeName || 'Stop'}`,
      subtitle: (stop.placeType || 'GENERAL').toUpperCase()
    });
    
    if (stop.departureTime && stop.departureTime !== stop.arrivalTime) {
      timelineEvents.push({
        type: 'stop_depart',
        time: stop.departureTime,
        title: `Left ${stop.placeName || 'Stop'}`,
        subtitle: `Duration: ${formatDuration(stop.durationMinutes || 0)}`
      });
    }
  });

  if (trip?.endTime) {
    timelineEvents.push({
      type: 'end',
      time: trip.endTime,
      title: 'Welcome Home!',
      subtitle: 'Auto-Stopped tracking'
    });
  } else if (isTracking) {
    timelineEvents.push({
      type: 'active',
      time: Date.now(),
      title: 'Current Position',
      subtitle: 'Tracking in progress...'
    });
  }

  timelineEvents.sort((a, b) => a.time - b.time);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Travel Intelligence Dashboard</Text>
        <Text style={styles.subtitle}>
          {dashboardViewMode === 'dashboard' ? 'Overall travel analytics across all trips' : (isTracking ? 'Live stats for current trip' : 'Overview of selected trip')}
        </Text>
      </View>

      {/* View Mode Switcher */}
      {allTrips && allTrips.length > 0 && (
        <View style={styles.viewModeSwitcher}>
          <TouchableOpacity
            style={[styles.switcherTab, dashboardViewMode === 'dashboard' && styles.switcherTabActive]}
            onPress={() => setDashboardViewMode('dashboard')}
            activeOpacity={0.8}
          >
            <BarChart2 size={14} color={dashboardViewMode === 'dashboard' ? '#3b82f6' : '#94a3b8'} />
            <Text style={[styles.switcherText, dashboardViewMode === 'dashboard' && styles.switcherTextActive]}>
              All-Time Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switcherTab, dashboardViewMode === 'trip' && styles.switcherTabActive]}
            onPress={() => setDashboardViewMode('trip')}
            activeOpacity={0.8}
          >
            <Activity size={14} color={dashboardViewMode === 'trip' ? '#3b82f6' : '#94a3b8'} />
            <Text style={[styles.switcherText, dashboardViewMode === 'trip' && styles.switcherTextActive]}>
              Single Trip Detail
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {dashboardViewMode === 'dashboard' ? (
        <>
          {/* 1. Overall Travel Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <TrendingUp size={18} color="#3b82f6" />
              <Text style={styles.metricVal}>{totalTripsCount}</Text>
              <Text style={styles.metricLbl}>Total Trips</Text>
            </View>
            <View style={styles.metricCard}>
              <Compass size={18} color="#10b981" />
              <Text style={styles.metricVal}>{formatDistance(overallDistanceKm)}</Text>
              <Text style={styles.metricLbl}>Total Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Clock size={18} color="#8b5cf6" />
              <Text style={styles.metricVal}>{formatDuration(overallTravelTimeMins)}</Text>
              <Text style={styles.metricLbl}>Total Duration</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Gauge size={18} color="#06b6d4" />
              <Text style={styles.metricVal}>{overallAvgSpeedKmH.toFixed(1)} km/h</Text>
              <Text style={styles.metricLbl}>Overall Avg Speed</Text>
            </View>
            <View style={styles.metricCard}>
              <Zap size={18} color="#ef4444" />
              <Text style={styles.metricVal}>{overallMaxSpeedKmH.toFixed(1)} km/h</Text>
              <Text style={styles.metricLbl}>Max Speed</Text>
            </View>
            <View style={styles.metricCard}>
              <MapPin size={18} color="#f59e0b" />
              <Text style={styles.metricVal}>{overallStopsCount}</Text>
              <Text style={styles.metricLbl}>Total Stops</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Compass size={18} color="#3b82f6" />
              <Text style={styles.metricVal}>{formatDistance(avgTripDistanceKm)}</Text>
              <Text style={styles.metricLbl}>Avg Trip Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Clock size={18} color="#eab308" />
              <Text style={styles.metricVal}>{formatDuration(avgTripDurationMins)}</Text>
              <Text style={styles.metricLbl}>Avg Trip Duration</Text>
            </View>
          </View>

          {/* 2. Travel Mode Distribution Breakdown */}
          <View style={styles.modeBreakdownCard}>
            <Text style={styles.sectionTitle}>Travel Mode Distribution</Text>

            {[
              { key: 'WALKING', title: '🚶 Walking', color: '#10b981' },
              { key: 'CYCLING', title: '🚴 Cycling', color: '#06b6d4' },
              { key: 'VEHICLE', title: '🚗 Vehicle', color: '#3b82f6' }
            ].map(m => {
              const data = modeStats[m.key];
              const pct = overallDistanceKm > 0 ? Math.min(100, Math.round((data.distanceKm / overallDistanceKm) * 100)) : 0;
              return (
                <View key={m.key} style={styles.modeRow}>
                  <View style={styles.modeHeader}>
                    <Text style={styles.modeTitle}>{m.title}</Text>
                    <Text style={styles.modeMeta}>{data.count} trips • {formatDistance(data.distanceKm)} ({pct}%)</Text>
                  </View>
                  <View style={styles.modeTrack}>
                    <View style={[styles.modeFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* 3. Smart Travel Insights Section */}
          <View style={styles.insightsSectionCard}>
            <View style={styles.insightsSectionHeader}>
              <Zap size={18} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Smart Travel Insights</Text>
            </View>

            {insights.hasData ? (
              <>
                {/* Natural Language Factual Summary Box */}
                {insights.summary.length > 0 && (
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryBoxTitle}>Travel Pattern Summary</Text>
                    {insights.summary.map((stmt, idx) => (
                      <View key={idx} style={styles.summaryBulletRow}>
                        <Text style={styles.summaryBullet}>•</Text>
                        <Text style={styles.summaryText}>{stmt}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Insight Badges Grid */}
                <View style={styles.insightGrid}>
                  <View style={styles.insightBadgeCard}>
                    <Text style={styles.badgeCardLabel}>Frequent Travel Day</Text>
                    <Text style={styles.badgeCardValue}>
                      {insights.frequentDay.dayName !== 'INSUFFICIENT_DATA' ? insights.frequentDay.label : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.insightBadgeCard}>
                    <Text style={styles.badgeCardLabel}>Recent Travel Trend</Text>
                    <Text style={[
                      styles.badgeCardValue,
                      insights.trend.status === 'INCREASING' ? { color: '#10b981' } :
                      insights.trend.status === 'DECREASING' ? { color: '#ef4444' } : { color: '#3b82f6' }
                    ]}>
                      {insights.trend.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.insightGrid}>
                  <View style={styles.insightBadgeCard}>
                    <Text style={styles.badgeCardLabel}>Travel Consistency</Text>
                    <Text style={styles.badgeCardValue}>{insights.consistency.label}</Text>
                  </View>

                  <View style={styles.insightBadgeCard}>
                    <Text style={styles.badgeCardLabel}>Avg Stop Dwell</Text>
                    <Text style={styles.badgeCardValue}>
                      {insights.stopInsights.totalStopsCount > 0 ? `${insights.stopInsights.avgStopDurationMins} mins / stop` : 'No stops recorded'}
                    </Text>
                  </View>
                </View>

                {/* Longest vs Shortest Journey Extremes */}
                {insights.longestTrip && insights.shortestTrip && (
                  <View style={styles.extremesCard}>
                    <View style={styles.extremeCol}>
                      <Text style={styles.extremeLabel}>Longest Journey</Text>
                      <Text style={styles.extremeValue}>{insights.longestTrip.label}</Text>
                    </View>
                    <View style={styles.extremeDivider} />
                    <View style={styles.extremeCol}>
                      <Text style={styles.extremeLabel}>Shortest Journey</Text>
                      <Text style={styles.extremeValue}>{insights.shortestTrip.label}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.insufficientBox}>
                <Text style={styles.insufficientText}>Record a few trips to unlock smart travel insights.</Text>
              </View>
            )}
          </View>

          {/* 4. Personal Travel Goals & Progress Section */}
          <View style={styles.goalsSectionCard}>
            <View style={styles.goalsSectionHeader}>
              <View style={styles.goalsHeaderLeft}>
                <Target size={18} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Personal Travel Goals</Text>
              </View>
              <TouchableOpacity
                style={styles.btnAddGoal}
                onPress={() => setShowGoalForm(!showGoalForm)}
                activeOpacity={0.8}
              >
                <Plus size={14} color="#fff" />
                <Text style={styles.btnAddGoalText}>{showGoalForm ? 'Cancel' : 'Set Goal'}</Text>
              </TouchableOpacity>
            </View>

            {/* Goal Form */}
            {showGoalForm && (
              <View style={styles.goalFormBox}>
                <Text style={styles.formGroupLabel}>Target Type</Text>
                <View style={styles.formTypeRow}>
                  <TouchableOpacity
                    style={[styles.typeChip, goalType === GOAL_TYPES.DISTANCE && styles.typeChipActive]}
                    onPress={() => setGoalType(GOAL_TYPES.DISTANCE)}
                  >
                    <Text style={[styles.typeChipText, goalType === GOAL_TYPES.DISTANCE && styles.typeChipTextActive]}>
                      Distance (km)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeChip, goalType === GOAL_TYPES.TRIP_COUNT && styles.typeChipActive]}
                    onPress={() => setGoalType(GOAL_TYPES.TRIP_COUNT)}
                  >
                    <Text style={[styles.typeChipText, goalType === GOAL_TYPES.TRIP_COUNT && styles.typeChipTextActive]}>
                      Trip Count
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.formGroupLabel}>Goal Period</Text>
                <View style={styles.formTypeRow}>
                  <TouchableOpacity
                    style={[styles.typeChip, goalPeriod === GOAL_PERIODS.WEEKLY && styles.typeChipActive]}
                    onPress={() => setGoalPeriod(GOAL_PERIODS.WEEKLY)}
                  >
                    <Text style={[styles.typeChipText, goalPeriod === GOAL_PERIODS.WEEKLY && styles.typeChipTextActive]}>
                      Weekly Target
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeChip, goalPeriod === GOAL_PERIODS.MONTHLY && styles.typeChipActive]}
                    onPress={() => setGoalPeriod(GOAL_PERIODS.MONTHLY)}
                  >
                    <Text style={[styles.typeChipText, goalPeriod === GOAL_PERIODS.MONTHLY && styles.typeChipTextActive]}>
                      Monthly Target
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.formGroupLabel}>
                  {goalType === GOAL_TYPES.DISTANCE ? 'Distance Target (km)' : 'Total Trips Target'}
                </Text>
                <TextInput
                  style={styles.goalInput}
                  value={goalTargetInput}
                  onChangeText={setGoalTargetInput}
                  keyboardType="numeric"
                  placeholder={goalType === GOAL_TYPES.DISTANCE ? 'e.g. 50' : 'e.g. 10'}
                  placeholderTextColor="#64748b"
                />

                <TouchableOpacity
                  style={styles.btnSaveGoal}
                  onPress={handleCreateGoal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSaveGoalText}>Save Goal</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List of Active Goals */}
            {goalsProgressList.length > 0 ? (
              goalsProgressList.map(item => {
                const { goal, currentValue, target, percentage, state } = item;
                const isDistance = goal.type === GOAL_TYPES.DISTANCE;
                const periodLabel = goal.period === GOAL_PERIODS.WEEKLY ? 'Weekly' : 'Monthly';
                const currentStr = isDistance ? `${currentValue.toFixed(1)} km` : `${currentValue} trips`;
                const targetStr = isDistance ? `${target.toFixed(1)} km` : `${target} trips`;

                let stateBadgeColor = '#3b82f6';
                let stateText = 'In Progress 🏃';
                if (state === 'COMPLETED') {
                  stateBadgeColor = '#10b981';
                  stateText = 'Completed 🏆';
                } else if (state === 'NOT_STARTED') {
                  stateBadgeColor = '#64748b';
                  stateText = 'Not Started ⏳';
                }

                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={styles.goalCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalTitle}>
                          {periodLabel} {isDistance ? 'Distance' : 'Trips'} Goal
                        </Text>
                        <Text style={styles.goalSub}>
                          Target: {targetStr} ({periodLabel})
                        </Text>
                      </View>

                      <View style={[styles.stateBadge, { backgroundColor: `${stateBadgeColor}20`, borderColor: stateBadgeColor }]}>
                        <Text style={[styles.stateBadgeText, { color: stateBadgeColor }]}>{stateText}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.btnDeleteGoal}
                        onPress={() => handleDeleteGoal(goal.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.goalProgressTrack}>
                      <View style={[styles.goalProgressFill, { width: `${percentage}%`, backgroundColor: stateBadgeColor }]} />
                    </View>

                    <View style={styles.goalCardFooter}>
                      <Text style={styles.goalProgressText}>
                        {currentStr} / {targetStr}
                      </Text>
                      <Text style={styles.goalPercentText}>{percentage}%</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.insufficientBox}>
                <Text style={styles.insufficientText}>
                  No personal travel goals set yet. Tap 'Set Goal' to create a weekly or monthly target.
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          {/* Single Trip Overview Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Compass size={18} color="#3b82f6" />
              <Text style={styles.metricVal}>{formatDistance(totalDistance)}</Text>
              <Text style={styles.metricLbl}>Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Clock size={18} color="#10b981" />
              <Text style={styles.metricVal}>{formatDuration(durationMinutes)}</Text>
              <Text style={styles.metricLbl}>Duration</Text>
            </View>
            <View style={styles.metricCard}>
              <Gauge size={18} color="#8b5cf6" />
              <Text style={styles.metricVal}>{avgSpeedKmH.toFixed(1)} km/h</Text>
              <Text style={styles.metricLbl}>Avg Speed</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Zap size={18} color="#ef4444" />
              <Text style={styles.metricVal}>{maxSpeedKmH.toFixed(1)} km/h</Text>
              <Text style={styles.metricLbl}>Max Speed</Text>
            </View>
            <View style={styles.metricCard}>
              <MapPin size={18} color="#f59e0b" />
              <Text style={styles.metricVal}>{stopsCount}</Text>
              <Text style={styles.metricLbl}>Stops</Text>
            </View>
            <View style={styles.metricCard}>
              <PauseCircle size={18} color="#06b6d4" />
              <Text style={styles.metricVal}>{formatDuration(totalStopDurationMinutes)}</Text>
              <Text style={styles.metricLbl}>Stop Time</Text>
            </View>
          </View>

          {/* Smart Classification Badge */}
          <View style={styles.smartCard}>
            <View style={styles.smartBadgeCol}>
              <Text style={styles.smartBadgeLabel}>Movement State</Text>
              <Text style={styles.smartBadgeValue}>{trip?.movementState || (isTracking ? 'MOVING' : 'STATIONARY')}</Text>
            </View>
            <View style={styles.smartBadgeDivider} />
            <View style={styles.smartBadgeCol}>
              <Text style={styles.smartBadgeLabel}>Estimated Mode</Text>
              <Text style={styles.smartBadgeValue}>{trip?.travelMode || 'UNKNOWN'}</Text>
            </View>
          </View>

          {/* Longest Stop Highlight */}
          {longestStop && (
            <View style={styles.highlightCard}>
              <Award size={24} color="#f59e0b" style={styles.highlightIcon} />
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightLbl}>Longest Stop</Text>
                <Text style={styles.highlightVal}>{longestStop.placeName || 'Unknown Location'}</Text>
                <Text style={styles.highlightSub}>{formatDuration(longestStop.durationMinutes || 0)} spent at location</Text>
              </View>
            </View>
          )}

          {/* Route Path Trace Map Card */}
          <View style={styles.mapPreviewCard}>
            <Text style={styles.sectionTitle}>Recorded Route Trace</Text>
            <RouteTraceView
              homeLocation={trip?.homeLocation}
              stops={stops}
              routePoints={routePoints}
              isTracking={isTracking}
            />
          </View>

          {/* Visual stops flow diagram */}
          {renderJourneyFlow()}

          {/* Bar Chart Section */}
          {renderBarChart()}

          {/* Timeline Section */}
          <View style={styles.timelineWrapper}>
            <Text style={styles.sectionTitle}>Journey Timeline</Text>
            
            {timelineEvents.map((event, index) => {
              let dotColor = '#3b82f6';
              if (event.type === 'start' || event.type === 'end') {
                dotColor = '#10b981';
              } else if (event.type === 'active') {
                dotColor = '#ef4444';
              } else if (event.type === 'stop_depart') {
                dotColor = '#64748b';
              }

              return (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineTimeCol}>
                    <Text style={styles.timelineTime}>{formatTime(event.time)}</Text>
                  </View>
                  
                  <View style={styles.timelineLineCol}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                    {index < timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  
                  <View style={styles.timelineContentCol}>
                    <Text style={styles.timelineEventTitle}>{event.title}</Text>
                    <Text style={styles.timelineEventSubtitle}>{event.subtitle}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
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
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 6,
  },
  metricLbl: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  highlightCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  highlightIcon: {
    marginRight: 12,
  },
  highlightInfo: {
    flex: 1,
  },
  highlightLbl: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  highlightVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  highlightSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 14,
  },
  mapPreviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  traceContainer: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  noTraceWrapper: {
    backgroundColor: '#0b0f19',
    height: 280,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTraceText: {
    color: '#64748b',
    fontSize: 12,
  },
  flowWrapper: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  svgContainerOuter: {
    alignItems: 'center',
  },
  chartWrapper: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noChartContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noChartText: {
    color: '#64748b',
    fontSize: 12,
  },
  timelineWrapper: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineTimeCol: {
    width: 65,
  },
  timelineTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  timelineLineCol: {
    alignItems: 'center',
    marginHorizontal: 8,
    position: 'relative',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    top: 10,
    width: 2,
    bottom: -16,
    backgroundColor: '#334155',
  },
  timelineContentCol: {
    flex: 1,
  },
  timelineEventTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  timelineEventSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
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
  smartCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  smartBadgeCol: {
    alignItems: 'center',
    flex: 1,
  },
  smartBadgeLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  smartBadgeValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  smartBadgeDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  switcherTabActive: {
    backgroundColor: '#0f172a',
  },
  switcherText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  switcherTextActive: {
    color: '#3b82f6',
  },
  modeBreakdownCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeRow: {
    marginBottom: 14,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  modeMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  modeTrack: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modeFill: {
    height: '100%',
    borderRadius: 4,
  },
  insightsSectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  insightsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryBoxTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f59e0b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  summaryBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 6,
  },
  summaryBullet: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  summaryText: {
    color: '#f8fafc',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  insightGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  insightBadgeCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeCardLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  badgeCardValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  extremesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  extremeCol: {
    flex: 1,
    alignItems: 'center',
  },
  extremeLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  extremeValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  extremeDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#334155',
  },
  insufficientBox: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
  },
  insufficientText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  goalsSectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  goalsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  goalsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnAddGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  btnAddGoalText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  goalFormBox: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formGroupLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  formTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  typeChipTextActive: {
    color: '#3b82f6',
  },
  goalInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 12,
  },
  btnSaveGoal: {
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveGoalText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  goalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  goalSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  stateBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  stateBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  btnDeleteGoal: {
    padding: 4,
  },
  goalProgressTrack: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalProgressText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  goalPercentText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
});
