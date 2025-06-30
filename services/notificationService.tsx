import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Background location task name
const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Type definitions for React Native compatibility
interface LocationReminder {
    id: string;
    title: string;
    category: string;
    isActive: boolean;
    location: {
        latitude: number;
        longitude: number;
    };
}

interface BackgroundLocationData {
    locations: Location.LocationObject[];
}

// Store triggered reminders to avoid spam notifications
const triggeredReminders = new Set<string>();

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Convert to meters
    return distance;
}

// Check if user is near any reminders
async function checkNearbyReminders(currentLocation: Location.LocationObject): Promise<void> {
    try {
        // Replace with your actual API endpoint
        const response = await fetch('http://172.29.224.1:5000/api/reminders');
        if (!response.ok) {
            console.log('Failed to fetch reminders:', response.status);
            return;
        }

        const reminders: LocationReminder[] = await response.json();

        // Filter active reminders with locations
        const activeReminders = reminders.filter(
            (reminder): reminder is LocationReminder =>
                reminder.isActive &&
                reminder.location !== undefined &&
                reminder.location.latitude !== undefined &&
                reminder.location.longitude !== undefined
        );

        for (const reminder of activeReminders) {
            const distance = calculateDistance(
                currentLocation.coords.latitude,
                currentLocation.coords.longitude,
                reminder.location.latitude,
                reminder.location.longitude
            );

            // If within 100 meters and not already triggered
            if (distance <= 100 && !triggeredReminders.has(reminder.id)) {
                await sendLocationNotification(reminder);
                triggeredReminders.add(reminder.id);

                // Remove from triggered set after 10 minutes to allow re-triggering
                setTimeout(() => {
                    triggeredReminders.delete(reminder.id);
                }, 10 * 60 * 1000);
            }

            // Remove from triggered set if user moves away (>200m)
            if (distance > 200) {
                triggeredReminders.delete(reminder.id);
            }
        }
    } catch (error) {
        console.error('Error checking nearby reminders:', error);
    }
}

// Send notification for location-based reminder
async function sendLocationNotification(reminder: LocationReminder): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: reminder.title,
                data: {
                    reminderId: reminder.id,
                    category: reminder.category,
                    type: 'location_reminder'
                },
                sound: true,
            },
            trigger: null, // Send immediately
        });

        console.log(`✅ Notification sent for reminder: ${reminder.title}`);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
    if (error) {
        console.error('Background location task error:', error);
        return;
    }

    if (data) {
        const { locations } = data as BackgroundLocationData;
        const currentLocation = locations[0];

        if (currentLocation) {
            console.log('📍 Background location update:', currentLocation.coords);
            await checkNearbyReminders(currentLocation);
        }
    }
});
// Notification service class with React Native TypeScript compatibility
export class NotificationService {
    // Request notification permissions
    static async requestPermissions(): Promise<boolean> {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('❌ Notification permission denied');
                return false;
            }

            console.log('✅ Notification permissions granted');
            return true;
        } catch (error) {
            console.error('Error requesting notification permissions:', error);
            return false;
        }
    }

    // Request location permissions
    static async requestLocationPermissions(): Promise<boolean> {
        try {
            // Request foreground location permission
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

            if (foregroundStatus !== 'granted') {
                console.log('❌ Foreground location permission denied');
                return false;
            }

            // Request background location permission
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

            if (backgroundStatus !== 'granted') {
                console.log('❌ Background location permission denied');
                return false;
            }

            console.log('✅ Location permissions granted');
            return true;
        } catch (error) {
            console.error('Error requesting location permissions:', error);
            return false;
        }
    }

    // Start location tracking
    static async startLocationTracking(): Promise<boolean> {
        try {
            // Check if permissions are granted
            const notificationPermission = await this.requestPermissions();
            const locationPermission = await this.requestLocationPermissions();

            if (!notificationPermission || !locationPermission) {
                console.log('❌ Required permissions not granted');
                return false;
            }

            // Check if task is already registered
            const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);

            if (isTaskRegistered) {
                console.log('🔄 Stopping existing location tracking...');
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            }

            // Platform-specific configuration
            const locationOptions: Location.LocationTaskOptions = {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 30000, // Check every 30 seconds
                distanceInterval: 50, // Or when moved 50 meters
                showsBackgroundLocationIndicator: Platform.OS === 'ios',
                foregroundService: {
                    notificationTitle: 'Location Reminders Active',
                    notificationBody: 'Tracking location for reminders',
                    notificationColor: '#007AFF',
                },
            };

            // Start background location updates
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, locationOptions);

            console.log('✅ Location tracking started successfully');
            return true;
        } catch (error) {
            console.error('❌ Error starting location tracking:', error);
            return false;
        }
    }

    // Stop location tracking
    static async stopLocationTracking(): Promise<void> {
        try {
            const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);

            if (isTaskRegistered) {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                console.log('✅ Location tracking stopped');
            } else {
                console.log('ℹ️ Location tracking was not active');
            }

            // Clear triggered reminders
            triggeredReminders.clear();
        } catch (error) {
            console.error('❌ Error stopping location tracking:', error);
        }
    }

    // Check current tracking status
    static async getTrackingStatus(): Promise<boolean> {
        try {
            return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        } catch (error) {
            console.error('❌ Error checking tracking status:', error);
            return false;
        }
    }

    // Send a test notification
    static async sendTestNotification(): Promise<void> {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "🧪 Test Notification",
                    body: "Location reminders are working!",
                    data: { test: true },
                    sound: true,
                },
                trigger: null,
            });

            console.log('✅ Test notification sent');
        } catch (error) {
            console.error('❌ Error sending test notification:', error);
        }
    }

    // Get notification permissions status
    static async getNotificationPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
        return await Notifications.getPermissionsAsync();
    }

    // Get location permissions status
    static async getLocationPermissions(): Promise<{
        foreground: Location.PermissionStatus;
        background: Location.PermissionStatus;
    }> {
        const foreground = await Location.getForegroundPermissionsAsync();
        const background = await Location.getBackgroundPermissionsAsync();

        return {
            foreground: foreground.status,
            background: background.status,
        };
    }
}