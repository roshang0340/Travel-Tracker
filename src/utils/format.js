/**
 * Formats a distance in kilometers to a human-readable string.
 * @param {number} km - Distance in kilometers.
 * @returns {string} Formatted distance (e.g., "450 m", "1.25 km").
 */
export function formatDistance(km) {
  if (km === undefined || km === null || isNaN(km)) {
    return '0 m';
  }
  const meters = km * 1000;
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${km.toFixed(2)} km`;
}

/**
 * Formats a duration in minutes to a human-readable string.
 * @param {number} minutes - Duration in minutes.
 * @returns {string} Formatted duration (e.g., "5m", "1h 15m").
 */
export function formatDuration(minutes) {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) {
    return '0m';
  }
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Formats a timestamp into a 12-hour time string (e.g., "10:45 AM").
 * @param {number|Date} timestamp - The timestamp or Date object.
 * @returns {string} Formatted time.
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Formats a timestamp into a date string (e.g., "Jun 18, 2026").
 * @param {number|Date} timestamp - The timestamp or Date object.
 * @returns {string} Formatted date.
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}
