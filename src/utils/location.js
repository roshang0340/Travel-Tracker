/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) {
    return 0;
  }
  
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // In meters
}

/**
 * Checks if a point is within a specified radius of another point.
 * @param {Object} p1 - { lat, lng }
 * @param {Object} p2 - { lat, lng }
 * @param {number} radiusInMeters - Geofence radius
 * @returns {boolean} True if within radius
 */
export function isWithinRadius(p1, p2, radiusInMeters) {
  if (!p1 || !p2) return false;
  const dist = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
  return dist <= radiusInMeters;
}

/**
 * Detects place category based on Nominatim address details.
 * @param {Object} address - Nominatim address details object
 * @returns {string} Place type (e.g. restaurant, mall, park, hotel, work, store, general)
 */
function getPlaceTypeFromAddress(address) {
  if (!address) return 'general';
  
  const tags = Object.keys(address);
  
  const foodTags = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court'];
  const shopTags = ['mall', 'supermarket', 'department_store', 'convenience', 'shop', 'boutique', 'clothes'];
  const healthTags = ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'];
  const leisureTags = ['park', 'garden', 'playground', 'stadium', 'gym', 'museum', 'tourism', 'hotel', 'motel'];
  
  for (const tag of tags) {
    if (foodTags.includes(tag) || foodTags.includes(address[tag])) return 'restaurant';
    if (shopTags.includes(tag) || shopTags.includes(address[tag])) return 'mall';
    if (healthTags.includes(tag) || healthTags.includes(address[tag])) return 'hospital';
    if (leisureTags.includes(tag) || leisureTags.includes(address[tag])) return 'park';
  }
  
  if (address.building === 'office' || address.office) return 'work';
  if (address.house_number || address.residential) return 'home';
  
  return 'store';
}

/**
 * Reverse geocodes coordinates to a human-readable name and type.
 * Uses OpenStreetMap Nominatim with a generic English fallback if the fetch fails or is throttled.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Object containing placeName and placeType
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TravelTrackerExpoApp/1.0 (Contact: developer@example.com)'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      let placeName = '';
      let placeType = 'general';
      
      if (data.address) {
        // Find the most descriptive name
        placeName = data.name ||
                    data.address.amenity ||
                    data.address.shop ||
                    data.address.tourism ||
                    data.address.building ||
                    data.address.road ||
                    data.address.suburb ||
                    'Unknown Place';
        
        placeType = getPlaceTypeFromAddress(data.address);
      } else {
        placeName = data.display_name ? data.display_name.split(',')[0] : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
      
      return {
        placeName: placeName,
        placeType: placeType
      };
    }
  } catch (error) {
    console.warn('OSM Nominatim Geocoder failed. Using fallback.', error);
  }

  // Fallback if network is unavailable or rate limited
  return {
    placeName: `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    placeType: 'general'
  };
}

/**
 * Analyzes the entire route path points array to extract and detect stops.
 * Stops are defined as clusters of coordinates staying within 200m for 5+ minutes.
 * @param {Array} routePoints - List of recorded coordinates { lat, lng, timestamp }
 * @param {Array} currentStops - Existing stops in state (keeps geocoded names)
 * @returns {Array} List of detected stops
 */
export function extractStopsFromRoutePoints(routePoints, currentStops = []) {
  const detectedStops = [];
  if (!routePoints || routePoints.length === 0) return detectedStops;

  let activeDwellGroup = [];

  for (let i = 0; i < routePoints.length; i++) {
    const pt = routePoints[i];

    if (activeDwellGroup.length === 0) {
      activeDwellGroup.push(pt);
      continue;
    }

    const firstPt = activeDwellGroup[0];
    const dist = getDistance(firstPt.lat, firstPt.lng, pt.lat, pt.lng);

    if (dist <= 200) {
      activeDwellGroup.push(pt);
    } else {
      // User left the 200m radius. Check if the dwell qualifies as a stop (>= 5 minutes = 300,000ms)
      const lastPt = activeDwellGroup[activeDwellGroup.length - 1];
      const durationMs = lastPt.timestamp - firstPt.timestamp;
      const durationMins = durationMs / 60000;

      if (durationMins >= 5) {
        // Look up if we already resolved this stop name
        const existing = currentStops.find(s => Math.abs(s.arrivalTime - firstPt.timestamp) < 10000);
        detectedStops.push({
          id: `stop_${firstPt.timestamp}`,
          tripId: pt.tripId,
          placeName: existing?.placeName || 'Detecting Location...',
          placeType: existing?.placeType || 'general',
          lat: firstPt.lat,
          lng: firstPt.lng,
          arrivalTime: firstPt.timestamp,
          departureTime: lastPt.timestamp,
          durationMinutes: Math.round(durationMins),
          isFinalized: true
        });
      }
      
      // Reset dwell group to current point
      activeDwellGroup = [pt];
    }
  }

  // Handle active/ongoing dwell at the end of the line
  if (activeDwellGroup.length > 0) {
    const firstPt = activeDwellGroup[0];
    const lastPt = activeDwellGroup[activeDwellGroup.length - 1];
    const durationMs = lastPt.timestamp - firstPt.timestamp;
    const durationMins = durationMs / 60000;

    if (durationMins >= 5) {
      const existing = currentStops.find(s => Math.abs(s.arrivalTime - firstPt.timestamp) < 10000);
      detectedStops.push({
        id: `stop_${firstPt.timestamp}`,
        tripId: lastPt.tripId,
        placeName: existing?.placeName || 'Detecting Location...',
        placeType: existing?.placeType || 'general',
        lat: firstPt.lat,
        lng: firstPt.lng,
        arrivalTime: firstPt.timestamp,
        departureTime: lastPt.timestamp,
        durationMinutes: Math.round(durationMins),
        isFinalized: false
      });
    }
  }

  return detectedStops;
}
