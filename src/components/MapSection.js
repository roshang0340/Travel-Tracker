import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { Home, MapPin, Eye } from 'lucide-react-native';

// Try to import native maps, fall back if on web
let MapView, Marker, Polyline;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
  } catch (e) {
    console.warn('Native react-native-maps could not be loaded. Falling back to Web Leaflet map.', e);
  }
}

export default function MapSection({
  homeLocation,
  currentLocation,
  routePoints = [],
  stops = [],
  isTracking,
  replayMode = false // true when viewing past trip detail
}) {
  const mapRef = useRef(null);

  // Web Leaflet map states
  const mapContainerId = useRef(`map_${Math.floor(Math.random() * 1000000)}`).current;
  const leafletMapRef = useRef(null);
  const markerGroupRef = useRef(null);
  const polylineRef = useRef(null);

  // Auto-center map on location changes (Native only)
  useEffect(() => {
    if (Platform.OS !== 'web' && MapView && mapRef.current) {
      const target = currentLocation || homeLocation;
      if (target) {
        mapRef.current.animateToRegion({
          latitude: target.lat,
          longitude: target.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    }
  }, [currentLocation, homeLocation]);

  // LEAFLET MAP INTEGRATION FOR WEB
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        setupLeafletMap();
      };
      document.head.appendChild(script);
    } else if (window.L) {
      setupLeafletMap();
    }

    // Injected Keyframe Styles for Blinking dot
    if (!document.getElementById('leaflet-blinking-styles')) {
      const style = document.createElement('style');
      style.id = 'leaflet-blinking-styles';
      style.innerHTML = `
        @keyframes pulse-live {
          0% { transform: scale(0.9); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); opacity: 0.9; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.9); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .custom-live-dot {
          animation: pulse-live 1.8s infinite;
        }
      `;
      document.head.appendChild(style);
    }

    function setupLeafletMap() {
      const L = window.L;
      if (!L) return;

      const container = document.getElementById(mapContainerId);
      if (!container) return;

      // Initialize map instance if not already done
      if (!leafletMapRef.current) {
        const map = L.map(container, {
          zoomControl: true,
          attributionControl: false
        });
        leafletMapRef.current = map;

        // Apply dark styled open-source tile layer (CartoDB Dark Matter fits dark mode aesthetics beautifully!)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20
        }).addTo(map);

        markerGroupRef.current = L.layerGroup().addTo(map);
      }

      const map = leafletMapRef.current;
      const markerGroup = markerGroupRef.current;

      // Clear old markers
      markerGroup.clearLayers();

      // Collect coordinates to fit bounds
      const fitPoints = [];

      // Add Home Location (Green Pin)
      if (homeLocation) {
        fitPoints.push([homeLocation.lat, homeLocation.lng]);
        const homeIcon = L.divIcon({
          html: `<div style="background-color: #10b981; border: 2px solid #0f172a; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">H</div>`,
          className: 'leaflet-custom-home',
          iconSize: [22, 22]
        });
        L.marker([homeLocation.lat, homeLocation.lng], { icon: homeIcon })
          .bindPopup(`<b>Home Location</b><br/>${homeLocation.name || 'Saved Home'}`)
          .addTo(markerGroup);
      }

      // Add Stops (Blue Pins)
      stops.forEach(stop => {
        fitPoints.push([stop.lat, stop.lng]);
        const stopIcon = L.divIcon({
          html: `<div style="background-color: #3b82f6; border: 2px solid #0f172a; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 9px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">S</div>`,
          className: 'leaflet-custom-stop',
          iconSize: [20, 20]
        });
        L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .bindPopup(`<b>${stop.placeName}</b><br/>Duration: ${stop.durationMinutes} mins<br/>Type: ${stop.placeType}`)
          .addTo(markerGroup);
      });

      // Add Current Live Location (Red Pulse Pin)
      if (!replayMode && currentLocation) {
        fitPoints.push([currentLocation.lat, currentLocation.lng]);
        const liveIcon = L.divIcon({
          html: `<div class="custom-live-dot" style="background-color: #ef4444; border: 2px solid #ffffff; border-radius: 50%; width: 14px; height: 14px;"></div>`,
          className: 'leaflet-custom-live',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker([currentLocation.lat, currentLocation.lng], { icon: liveIcon })
          .bindPopup('<b>Current Location</b>')
          .addTo(markerGroup);
      }

      // Draw Route Polyline
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      if (routePoints.length > 1) {
        const pathCoords = routePoints.map(p => {
          fitPoints.push([p.lat, p.lng]);
          return [p.lat, p.lng];
        });

        polylineRef.current = L.polyline(pathCoords, {
          color: '#2563eb',
          weight: 6,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);
      }

      // Auto fit map bounds to show route and stops
      if (fitPoints.length > 0) {
        const bounds = L.latLngBounds(fitPoints);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else {
        // Fallback center
        map.setView([12.9716, 77.5946], 13);
      }
    }
  }, [currentLocation, homeLocation, routePoints, stops, replayMode]);

  // Clean up Leaflet map instance on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  if (Platform.OS !== 'web' && MapView) {
    // NATIVE GOOGLE MAPS
    const initialRegion = currentLocation || homeLocation || { lat: 12.9716, lng: 77.5946 };
    const polylineCoords = routePoints.map(p => ({
      latitude: p.lat,
      longitude: p.lng
    }));

    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: initialRegion.lat,
            longitude: initialRegion.lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          userInterfaceStyle="dark"
        >
          {homeLocation && (
            <Marker
              coordinate={{ latitude: homeLocation.lat, longitude: homeLocation.lng }}
              title="Home"
              description="Your saved home location"
            >
              <View style={[styles.markerContainer, styles.homeMarker]}>
                <Home size={16} color="#fff" />
              </View>
            </Marker>
          )}

          {stops.map((stop, idx) => (
            <Marker
              key={stop.id || idx}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={stop.placeName}
              description={`Spent: ${stop.durationMinutes} mins`}
            >
              <View style={[styles.markerContainer, styles.stopMarker]}>
                <MapPin size={16} color="#fff" />
              </View>
            </Marker>
          ))}

          {!replayMode && currentLocation && (
            <Marker
              coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
              title="You Are Here"
            >
              <View style={styles.liveMarkerOuter}>
                <View style={styles.liveMarkerInner} />
              </View>
            </Marker>
          )}

          {polylineCoords.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#2563eb"
              strokeWidth={6}
            />
          )}
        </MapView>
      </View>
    );
  }

  // WEB INTERACTIVE LEAFLET OPENSTREETMAP PREVIEW
  return (
    <View style={styles.webContainer}>
      <View style={styles.webMapHeader}>
        <Eye size={14} color="#94a3b8" />
        <Text style={styles.webMapHeaderTitle}>
          {replayMode ? 'Journey Replay Map (OpenStreetMap)' : 'Live Interactive Map (OpenStreetMap)'}
        </Text>
      </View>
      <View style={styles.mapContainerOuter}>
        {/* Leaflet map container div */}
        <div id={mapContainerId} style={{ width: '100%', height: '100%', outline: 'none' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMarker: {
    backgroundColor: '#10b981',
  },
  stopMarker: {
    backgroundColor: '#3b82f6',
  },
  liveMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: 'hidden',
  },
  webMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  webMapHeaderTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapContainerOuter: {
    flex: 1,
    position: 'relative',
    minHeight: 250,
    backgroundColor: '#0f172a',
  }
});
