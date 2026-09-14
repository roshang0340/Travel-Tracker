import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Configure Notifications Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Anti-Spam / Deduplication Cache (Cooldown Window: 10 seconds)
const recentNotificationKeys = new Map();
const DUP_COOLDOWN_MS = 10000;

/**
 * Requests push/local notification permissions from the OS.
 * @returns {Promise<boolean>} True if granted
 */
export async function requestNotificationPermissions() {
  try {
    if (Platform.OS === 'web') {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'default') {
          const res = await Notification.requestPermission();
          return res === 'granted';
        }
      }
      return false;
    } else {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    }
  } catch (error) {
    console.error('Failed to request notification permissions:', error);
    return false;
  }
}

/**
 * Base method to send a local notification with deduplication and user preference checks.
 * @param {string} title - Notification Title
 * @param {string} body - Notification Body message
 * @param {string} [eventKey] - Unique key to deduplicate rapid duplicate triggers
 * @param {boolean} [isEnabled=true] - User's notification preference flag
 * @returns {Promise<boolean>} True if notification was sent
 */
export async function sendLocalNotification(title, body, eventKey = null, isEnabled = true) {
  if (!isEnabled) return false;

  // Deduplication check
  if (eventKey) {
    const lastSent = recentNotificationKeys.get(eventKey);
    const now = Date.now();
    if (lastSent && (now - lastSent) < DUP_COOLDOWN_MS) {
      return false;
    }
    recentNotificationKeys.set(eventKey, now);
  }

  try {
    if (Platform.OS === 'web') {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
        return true;
      } else {
        return true;
      }
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          sound: true,
        },
        trigger: null, // immediate
      });
      return true;
    }
  } catch (error) {
    console.error('Failed to dispatch local notification:', error);
    return false;
  }
}

// ============================================================================
// REUSABLE MEANINGFUL EVENT NOTIFICATION HELPERS
// ============================================================================

/**
 * 1. Notification Event: Tracking Started
 */
export async function notifyTrackingStarted(tripId, isEnabled = true) {
  return sendLocalNotification(
    'Tracking Started',
    'Your travel route is now being recorded.',
    `tracking_started_${tripId || Date.now()}`,
    isEnabled
  );
}

/**
 * 2. Notification Event: Stop Confirmed
 */
export async function notifyStopDetected(placeName, isEnabled = true) {
  const nameStr = placeName && placeName !== 'Resolving Address...' ? placeName : 'a new location';
  return sendLocalNotification(
    'New Stop Confirmed',
    `You have dwelled at ${nameStr}.`,
    `stop_confirmed_${nameStr}`,
    isEnabled
  );
}

/**
 * 3. Notification Event: Left Home Geofence
 */
export async function notifyLeftHome(homeName = 'Home', isEnabled = true) {
  return sendLocalNotification(
    'Left Home Area',
    `You have departed from ${homeName}. Geofence active.`,
    'left_home_geofence_event',
    isEnabled
  );
}

/**
 * 4. Notification Event: Arrived Home Geofence
 */
export async function notifyArrivedHome(homeName = 'Home', isEnabled = true) {
  return sendLocalNotification(
    'Arrived Home',
    `Welcome back to ${homeName}! Trip completed and recorded.`,
    'arrived_home_geofence_event',
    isEnabled
  );
}

/**
 * 5. Notification Event: Trip Completed
 */
export async function notifyTripCompleted(tripId, totalDistanceKm = 0, isEnabled = true) {
  const distStr = totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(2)} km traveled.` : 'Trip completed and saved.';
  return sendLocalNotification(
    'Trip Completed',
    distStr,
    `trip_completed_${tripId || Date.now()}`,
    isEnabled
  );
}
