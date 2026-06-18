import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Path, Ellipse, G, Circle } from 'react-native-svg';
import { Compass, MapPin, Clock, Award, ArrowRight, Home, CheckCircle } from 'lucide-react-native';
import { formatDistance, formatDuration, formatTime } from '../utils/format';

/**
 * Computes coordinates along a winding S-shaped Cubic Bezier road curve.
 * Viewport size is x: 0-500, y: 0-250
 * @param {number} t - Parametric time from 0 to 1
 * @returns {Object} {x, y} coordinate
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
 * Displays only the solid blue route path line and pin markers on a clean dark grid,
 * bypassing heavy background maps for a premium, stylized aesthetic.
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
  const paddingFactor = 0.20; // 20% padding

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
  const svgHeight = 280; // Taller portrait layout matching real map route aesthetic
  const drawPadding = 30; // Extra padding to fit tooltip cards

  // Convert coordinate to relative SVG coordinate
  const getXY = (lat, lng) => {
    const latDiff = maxLat - minLat || 1;
    const lngDiff = maxLng - minLng || 1;

    const x = drawPadding + ((lng - minLng) / lngDiff) * (svgWidth - 2 * drawPadding);
    const y = svgHeight - drawPadding - ((lat - minLat) / latDiff) * (svgHeight - 2 * drawPadding);
    return { x, y };
  };

  // Generate path coordinates
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

  // Start node coordinates
  const startPt = routePoints.length > 0 ? routePoints[0] : null;
  const startXY = startPt ? getXY(startPt.lat, startPt.lng) : null;
  const startName = (startPt && startPt.lat && Math.abs(startPt.lat - 11.9961) < 0.005) ? "Thumbur" : "Start";

  return (
    <View style={styles.traceContainer}>
      <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* Dark background card */}
        <Rect width={svgWidth} height={svgHeight} fill="#0b0f19" rx={6} />

        {/* Grid Lines */}
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

        {/* 1. Travel Route Line Shadow */}
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

        {/* 2. Traveled Route Line (Solid Royal Blue, Google style) */}
        {pathD && (
          <Path
            d={pathD}
            fill="none"
            stroke="#2563eb"
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* 3. Start Point Node (White Circle + Tooltip) */}
        {startXY && (
          <g>
            <Circle cx={startXY.x} cy={startXY.y} r={9} fill="rgba(37, 99, 235, 0.25)" />
            <Circle cx={startXY.x} cy={startXY.y} r={4.5} fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
            
            <g transform={`translate(${startXY.x - 35}, ${startXY.y - 28})`}>
              <Rect width={70} height={16} rx={3} fill="#0f172a" stroke="#ffffff" strokeWidth="1" opacity={0.95} />
              <SvgText
                x={35}
                y={11}
                fill="#ffffff"
                fontSize={8}
                fontWeight="bold"
                textAnchor="middle"
              >
                {startName}
              </SvgText>
            </g>
          </g>
        )}

        {/* 4. Home Node (Green Pin + Label below) */}
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
            
            <g transform={`translate(${homeXY.x - 50}, ${homeXY.y + 6})`}>
              <Rect width={100} height={18} rx={4} fill="#0f172a" stroke="#10b981" strokeWidth="1.2" opacity={0.95} />
              <SvgText
                x={50}
                y={12}
                fill="#10b981"
                fontSize={8}
                fontWeight="bold"
                textAnchor="middle"
              >
                Villupuram Center
              </SvgText>
            </g>
          </g>
        )}

        {/* 5. Stop Nodes (Blue Pin + Custom Tooltip Pill to the right) */}
        {stops.map((stop, index) => {
          const { x, y } = getXY(stop.lat, stop.lng);
          const displayName = stop.placeName === 'Villupuram Railway Junction' ? 'Villupuram Junction' : stop.placeName;
          const shortName = displayName.length > 20 ? displayName.substring(0, 18) + '..' : displayName;
          const labelText = `${shortName} (${stop.durationMinutes}m)`;
          const textWidth = Math.max(90, labelText.length * 5.2 + 10);

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

        {/* 6. Live Blinking Indicator Node */}
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

export default function AnalyticsView({ trip, stops = [], routePoints = [], isTracking }) {
  if (!trip && stops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Compass size={48} color="#475569" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No Trip Data Available</Text>
        <Text style={styles.emptySubtitle}>Start tracking or select a past trip from History to view analytics.</Text>
      </View>
    );
  }

  // Calculate Metrics
  const totalDistance = trip?.totalDistance || 0;
  const stopsCount = stops.length;
  
  // Total Time Away
  let totalTimeStr = '0m';
  if (trip?.startTime) {
    const end = trip.endTime || Date.now();
    const diffMins = (end - trip.startTime) / 60000;
    totalTimeStr = formatDuration(diffMins);
  }

  // Longest Stop
  let longestStop = null;
  if (stops.length > 0) {
    longestStop = [...stops].sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  }

  // Render Custom SVG Bar Chart
  const renderBarChart = () => {
    if (stops.length === 0) {
      return (
        <View style={styles.noChartContainer}>
          <Text style={styles.noChartText}>No stops visited yet to chart.</Text>
        </View>
      );
    }

    const svgWidth = 320;
    const svgHeight = 150;
    const chartHeight = 110;
    const paddingLeft = 30;
    const paddingRight = 10;
    const chartWidth = svgWidth - paddingLeft - paddingRight;

    const maxDuration = Math.max(...stops.map(s => s.durationMinutes), 1);
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
            const barHeight = (stop.durationMinutes / maxDuration) * (chartHeight - 30);
            const finalBarHeight = stop.durationMinutes > 0 ? Math.max(barHeight, 6) : 0;
            const x = paddingLeft + spacing + index * (barWidth + spacing);
            const y = chartHeight - finalBarHeight;

            const displayName = stop.placeName.length > 6 ? stop.placeName.substring(0, 5) + '..' : stop.placeName;

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
                  {`${stop.durationMinutes}m`}
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

  // Render Visual Winding Road stop graph matching uploaded image
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
      const shortName = stop.placeName.length > 12 ? stop.placeName.substring(0, 10) + '..' : stop.placeName;
      nodes.push({
        type: 'stop',
        label: shortName,
        sublabel: `${stop.durationMinutes}m spent`,
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
                    {node.subtext || node.sublabel}
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
      title: `Arrived at ${stop.placeName}`,
      subtitle: stop.placeType.toUpperCase()
    });
    
    if (stop.departureTime && stop.departureTime !== stop.arrivalTime) {
      timelineEvents.push({
        type: 'stop_depart',
        time: stop.departureTime,
        title: `Left ${stop.placeName}`,
        subtitle: `Duration: ${formatDuration(stop.durationMinutes)}`
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
        <Text style={styles.title}>Trip Analytics</Text>
        <Text style={styles.subtitle}>
          {isTracking ? 'Live stats for current trip' : 'Overview of recorded trip'}
        </Text>
      </View>

      {/* Grid of Key Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Compass size={20} color="#3b82f6" />
          <Text style={styles.metricVal}>{formatDistance(totalDistance)}</Text>
          <Text style={styles.metricLbl}>Distance</Text>
        </View>

        <View style={styles.metricCard}>
          <MapPin size={20} color="#10b981" />
          <Text style={styles.metricVal}>{stopsCount}</Text>
          <Text style={styles.metricLbl}>Stops</Text>
        </View>

        <View style={styles.metricCard}>
          <Clock size={20} color="#8b5cf6" />
          <Text style={styles.metricVal}>{totalTimeStr}</Text>
          <Text style={styles.metricLbl}>Time Away</Text>
        </View>
      </View>

      {/* Longest Stop Highlight */}
      {longestStop && (
        <View style={styles.highlightCard}>
          <Award size={20} color="#f59e0b" style={styles.highlightIcon} />
          <View style={styles.highlightInfo}>
            <Text style={styles.highlightLbl}>Longest Dwell Stop</Text>
            <Text style={styles.highlightVal}>{longestStop.placeName}</Text>
            <Text style={styles.highlightSub}>{formatDuration(longestStop.durationMinutes)} spent</Text>
          </View>
        </View>
      )}

      {/* Winding road-style Journey Map Visualization rendering only the blue line route trace! */}
      <View style={styles.mapPreviewCard}>
        <Text style={styles.sectionTitle}>Journey Map Visualization</Text>
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
    marginBottom: 16,
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
    fontSize: 16,
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
    justifyContent: 'center',
    paddingVertical: 10,
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
    color: '#94a3b8',
    fontSize: 12,
  },
  timelineWrapper: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineTimeCol: {
    width: 65,
    paddingRight: 8,
    alignItems: 'flex-end',
  },
  timelineTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  timelineLineCol: {
    width: 20,
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  timelineLine: {
    position: 'absolute',
    top: 10,
    bottom: -10,
    width: 2,
    backgroundColor: '#334155',
    zIndex: 1,
  },
  timelineContentCol: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 16,
  },
  timelineEventTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  timelineEventSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
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
