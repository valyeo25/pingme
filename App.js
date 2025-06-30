import React, { useEffect, useState } from "react";
import { StyleSheet, View, Alert, Platform } from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { getDistance } from "geolib";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_TASK_NAME = "background-location-task";

type Reminder = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

let currentReminders: Reminder[] = []; // Shared across foreground and background

export default function App() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // 🔹 Request permissions and load saved reminders
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required.");
        return;
      }

      const notifStatus = await Notifications.requestPermissionsAsync();
      if (notifStatus.status !== "granted") {
        Alert.alert("Permission denied", "Notification permission is required.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc);

      const stored = await AsyncStorage.getItem("reminders");
      if (stored) {
        const parsed: Reminder[] = JSON.parse(stored);
        setReminders(parsed);
        currentReminders = parsed;
      }
    })();
  }, []);

  // 🔹 Handle map tap to add reminder
  const handleMapPress = async (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    const newReminder: Reminder = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: Date.now(),
    };

    const updatedReminders = [...reminders, newReminder];
    setReminders(updatedReminders);
    currentReminders = updatedReminders;

    await AsyncStorage.setItem("reminders", JSON.stringify(updatedReminders));

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!hasStarted) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 10000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Location Reminder",
          notificationBody: "Tracking your location...",
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      {userLocation && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
        >
          {reminders.map((r, index) => (
            <Marker
              key={index}
              coordinate={{ latitude: r.latitude, longitude: r.longitude }}
              title={`Reminder #${index + 1}`}
              description={new Date(r.timestamp).toLocaleString()}
            />
          ))}
        </MapView>
      )}
    </View>
  );
}

// 🔹 Background location task (runs even when app is closed)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Task error:", error);
    return;
  }

  const { locations } = data as Location.LocationObject & { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0 || currentReminders.length === 0) return;

  const current = locations[0].coords;

  for (const reminder of currentReminders) {
    const distance = getDistance(
      { latitude: current.latitude, longitude: current.longitude },
      { latitude: reminder.latitude, longitude: reminder.longitude }
    );

    if (distance < 50) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "You’ve arrived!",
          body: "You’re at a saved reminder location 📍",
        },
        trigger: null,
      });

      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      break;
    }
  }
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

