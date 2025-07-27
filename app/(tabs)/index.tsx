import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { NotificationService } from "../../services/notificationService";
import MapScreen from "./map";
import { Keyboard } from 'react-native';
import weatherService from "../../services/weatherServices";

type Reminder = {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
  isOutdoor?: boolean;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
    proximity?: number;
  };
};

type WeatherData = {
  area: string;
  forecast: string;
  timestamp: string;
  cached_at: string;
  warning: boolean;
  recommendation: string;
  icon: string;
};

type ReminderWithWeather = Reminder & {
  location?: Location;
  weather?: WeatherData;
  weatherAlert?: string | null;
};

type Location = {
  name: string;
  latitude: number;
  longitude: number;
  proximity?: number;
};

const categoryColors: Record<string, string> = {
  Travel: "#d2e7ed",
  Events: "#fce1f4",
  Work: "#d4efc2",
};

const categories: string[] = ["Travel", "Events", "Work"];

function getColorForCategory(category: string): string {
  return categoryColors[category] || "#f0f0f0";
}

const API_ENDPOINTS = {
  REMINDERS: "http://192.168.219.161:5002/api/reminders", 
  REMINDER_BY_ID: (id: string) => `http://192.168.219.161:5002/api/reminders/${id}`,
  WEATHER_REMINDERS_BATCH: "http://192.168.219.161:5002/api/weather/reminders-batch",
};

export default function RemindersScreen(): React.ReactElement {
  const router = useRouter();

  // State management
  const [reminders, setReminders] = useState<ReminderWithWeather[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isOutdoor, setIsOutdoor] = useState(false);
  const [isMapVisible, setMapVisible] = useState(false);
  const [reminderToAssign, setReminderToAssign] = useState<string | null>(null);
  
  // Delete modal state
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  // Location tracking state
  const [isLocationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
  const [isTrackingLoading, setTrackingLoading] = useState(false);

  // Load reminders and check tracking status on component mount
  useEffect(() => {
    loadReminders();
    checkTrackingStatus();
  }, []);

  // Check tracking status
  const checkTrackingStatus = async () => {
    const isTracking = await NotificationService.getTrackingStatus();
    setLocationTrackingEnabled(isTracking);
  };

  // Toggle location tracking
  const toggleLocationTracking = async () => {
    setTrackingLoading(true);
    
    try {
      if (isLocationTrackingEnabled) {
        await NotificationService.stopLocationTracking();
        setLocationTrackingEnabled(false);
        Alert.alert("Success", "Location tracking disabled");
      } else {
        const success = await NotificationService.startLocationTracking();
        if (success) {
          setLocationTrackingEnabled(true);
          Alert.alert(
            "Success", 
            "Location tracking enabled! You'll get notifications when near your reminders."
          );
        } else {
          Alert.alert(
            "Error", 
            "Failed to enable location tracking. Please check permissions in Settings."
          );
        }
      }
    } catch (error) {
      console.error("Error toggling location tracking:", error);
      Alert.alert("Error", "Failed to toggle location tracking");
    } finally {
      setTrackingLoading(false);
    }
  };

  // Test notification function
  const testNotification = async () => {
    await NotificationService.sendTestNotification();
    Alert.alert("Test Sent", "Check if you received a test notification!");
  };

  // Helper functions
  const resetDeleteModal = () => {
    setDeleteModalVisible(false);
    setSelectedReminder(null);
  };

  const resetModal = () => {
    setModalVisible(false);
    setNewReminderTitle("");
    setSelectedCategory(null);
    setIsOutdoor(false); // This resets to false every time
  };

  // Load reminders function with complete weather API flow
  const loadReminders = async (): Promise<void> => {
    setIsLoading(true);
    try {
      console.log("🔄 Starting to load reminders...");
      
      // Step 1: Fetch reminders
      console.log("📡 Fetching from:", API_ENDPOINTS.REMINDERS);
      const response = await fetch(API_ENDPOINTS.REMINDERS);
      console.log("📡 Reminders response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Reminders fetch failed:", errorText);
        throw new Error(`Failed to fetch reminders: ${response.status}`);
      }

      const data = await response.json();
      console.log("📝 Raw reminders data:", JSON.stringify(data, null, 2));
      console.log("📝 Number of reminders fetched:", data.length);

      // Step 2: Format reminders
      console.log("🔧 Starting to format reminders...");
      const formattedReminders: Reminder[] = data.map((r: any, index: number) => {
        console.log(`🔧 Processing reminder ${index + 1}:`, r);
        console.log(`🔧 Raw isOutdoor value:`, r.isOutdoor, typeof r.isOutdoor);
        
        const formatted = {
          id: r._id,
          title: r.title,
          category: r.category,
          isActive: r.isActive ?? true,
          isOutdoor: r.isOutdoor ?? false, // This might be the issue
          location: r.location,
        };
        console.log(`🔧 Formatted reminder ${index + 1}:`, JSON.stringify(formatted, null, 2));
        return formatted;
      });

      console.log("📋 All formatted reminders:", JSON.stringify(formattedReminders, null, 2));

      // Step 3: Prepare weather request
      const weatherRequestBody = { reminders: formattedReminders };
      console.log("🌤️ Weather request body:", JSON.stringify(weatherRequestBody, null, 2));

      // Step 4: Fetch weather for reminders batch
      console.log("🌤️ Fetching weather data from:", API_ENDPOINTS.WEATHER_REMINDERS_BATCH);
      
      const weatherResponse = await fetch(API_ENDPOINTS.WEATHER_REMINDERS_BATCH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weatherRequestBody),
      });

      console.log("🌤️ Weather response status:", weatherResponse.status);

      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        console.error("❌ Weather API error:", errorText);
        // Don't throw error, just use reminders without weather
        console.warn("⚠️ Using reminders without weather data");
        setReminders(formattedReminders);
        return;
      }

      const weatherData = await weatherResponse.json();
      console.log("🌤️ Weather response data:", JSON.stringify(weatherData, null, 2));

      // Step 5: Check if weather data has the expected structure
      if (weatherData && weatherData.reminders) {
        console.log("✅ Weather data structure is correct");
        console.log("📊 Number of reminders with weather:", weatherData.reminders.length);
        
        // Log each reminder with weather
        weatherData.reminders.forEach((reminder: any, index: number) => {
          console.log(`🔍 Reminder ${index + 1}:`, {
            id: reminder.id,
            title: reminder.title,
            hasWeather: !!reminder.weather,
            hasWeatherAlert: !!reminder.weatherAlert,
            weather: reminder.weather,
            weatherAlert: reminder.weatherAlert
          });
        });
        
        setReminders(weatherData.reminders);
      } else {
        console.warn("⚠️ Unexpected weather data structure:", weatherData);
        // Fallback: set reminders without weather
        setReminders(formattedReminders);
      }

    } catch (error: any) {
      console.error("❌ Error in loadReminders:", error);
      Alert.alert("Error", error.message || "Failed to load reminders");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReminder = async (id: string): Promise<void> => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) {
      console.error("❌ Reminder not found:", id);
      return;
    }

    const updatedReminder = { ...reminder, isActive: !reminder.isActive };
    
    // Optimistic update
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? updatedReminder : r))
    );

    try {
      console.log("🔄 Updating reminder status:", id, !reminder.isActive);
      const response = await fetch(API_ENDPOINTS.REMINDER_BY_ID(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !reminder.isActive }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Reminder status updated:", result);
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to update reminder:", errorText);
        
        // Revert optimistic update
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? reminder : r))
        );
        Alert.alert("Error", "Failed to update reminder status");
      }
    } catch (error) {
      console.error("❌ Network error updating reminder:", error);
      
      // Revert optimistic update
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? reminder : r))
      );
      Alert.alert("Error", "Failed to connect to server");
    }
  };

  const addReminder = async (): Promise<void> => {
    if (!newReminderTitle.trim()) {
      Alert.alert("Error", "Please enter a reminder title");
      return;
    }

    if (!selectedCategory) {
      Alert.alert("Error", "Please select a category");
      return;
    }

    const newReminder = {
      title: newReminderTitle.trim(),
      category: selectedCategory,
      isOutdoor,
      isActive: true,
    };

    // Debug log to see what we're sending
    console.log("🔄 Creating new reminder with isOutdoor:", isOutdoor);
    console.log("🔄 Full reminder object:", JSON.stringify(newReminder, null, 2));
    console.log("🔄 Sending to API endpoint:", API_ENDPOINTS.REMINDERS);

    try {
      const response = await fetch(API_ENDPOINTS.REMINDERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReminder),
      });

      console.log("🔄 Response status:", response.status);
      console.log("🔄 Response headers:", JSON.stringify([...response.headers.entries()]));

      if (response.ok) {
        const savedReminder = await response.json();
        console.log("✅ Reminder created by backend:", JSON.stringify(savedReminder, null, 2));
        console.log("✅ Backend returned isOutdoor:", savedReminder.isOutdoor, typeof savedReminder.isOutdoor);
        
        // Add to local state with proper id conversion
        const reminderToAdd = { ...savedReminder, id: savedReminder._id };
        console.log("✅ Adding to local state:", JSON.stringify(reminderToAdd, null, 2));
        setReminders((prev) => [...prev, reminderToAdd]);
        
        // Reset form
        setModalVisible(false);
        setNewReminderTitle("");
        setSelectedCategory(null);
        setIsOutdoor(false);
        
        // Reload reminders to double-check
        console.log("🔄 Reloading reminders to verify...");
        setTimeout(() => {
          loadReminders();
        }, 1000);
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to create reminder:", response.status, errorText);
        Alert.alert("Error", "Failed to save reminder");
      }
    } catch (error) {
      console.error("❌ Network error creating reminder:", error);
      Alert.alert("Error", "Failed to connect to server");
    }
  };

  const deleteReminder = async (id: string): Promise<void> => {
    try {
      console.log("🔄 Deleting reminder:", id);
      const response = await fetch(API_ENDPOINTS.REMINDER_BY_ID(id), {
        method: "DELETE",
      });

      if (response.ok) {
        console.log("✅ Reminder deleted successfully");
        
        // Remove from local state
        setReminders((prev) => prev.filter((r) => r.id !== id));
        
        // Close delete modal
        setDeleteModalVisible(false);
        setSelectedReminder(null);
        
        Alert.alert("Success", "Reminder deleted successfully");
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to delete reminder:", errorText);
        Alert.alert("Error", "Failed to delete reminder");
      }
    } catch (error) {
      console.error("❌ Network error deleting reminder:", error);
      Alert.alert("Error", "Failed to connect to server");
    }
  };

  const handleReminderPress = (reminder: Reminder): void => {
    setSelectedReminder(reminder);
    setDeleteModalVisible(true);
  };

  const onAssignLocation = async (
    reminderId: string,
    location: { name: string; latitude: number; longitude: number; proximity: number }
  ): Promise<void> => {
    Keyboard.dismiss()
    
    // Optimistic update
    setReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, location } : r))
    );

    try {
      console.log("🔄 Updating location for reminder:", reminderId, location);
      const response = await fetch(API_ENDPOINTS.REMINDER_BY_ID(reminderId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Location updated in backend:", result);
        
        // After location is updated, refresh weather data
        setTimeout(() => {
          loadReminders(); // This will refetch all reminders with weather
        }, 500);
        
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to update location:", errorText);
        
        // Revert optimistic update
        setReminders((prev) =>
          prev.map((r) => (r.id === reminderId ? { ...r, location: undefined } : r))
        );
        Alert.alert("Error", "Failed to update location");
      }
    } catch (error) {
      console.error("❌ Network error updating location:", error);
      
      // Revert optimistic update
      setReminders((prev) =>
        prev.map((r) => (r.id === reminderId ? { ...r, location: undefined } : r))
      );
      Alert.alert("Error", "Failed to connect to server");
    }

    setTimeout(() => {
      setMapVisible(false);
      setReminderToAssign(null);
    }, 100);
  };

  // Enhanced renderWeatherInfo function with better debugging
  const renderWeatherInfo = (weather: WeatherData | undefined, weatherAlert: string | null | undefined) => {
    console.log("🎨 Rendering weather info:", { weather, weatherAlert });
    
    if (!weather && !weatherAlert) {
      console.log("ℹ️ No weather or alert data to display");
      return null;
    }

    return (
      <View style={styles.weatherContainer}>
        {weather && (
          <View style={styles.weatherRow}>
            <Text style={styles.weatherIcon}>{weather.icon}</Text>
            <View style={styles.weatherDetails}>
              <Text style={styles.weatherForecast} numberOfLines={2}>
                {weather.forecast}
              </Text>
              {weather.recommendation && (
                <Text style={styles.weatherRecommendation} numberOfLines={2}>
                  💡 {weather.recommendation}
                </Text>
              )}
              {weather.area && (
                <Text style={styles.weatherArea}>
                  📍 {weather.area}
                </Text>
              )}
            </View>
          </View>
        )}
        
        {weatherAlert && (
          <View style={styles.weatherAlertContainer}>
            <Text style={styles.weatherAlert}>
              ⚠️ {weatherAlert}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Updated renderReminder function with better debugging
  const renderReminder = (item: ReminderWithWeather) => {
    console.log("🎨 Rendering reminder:", {
      id: item.id,
      title: item.title,
      hasLocation: !!item.location,
      hasWeather: !!item.weather,
      hasWeatherAlert: !!item.weatherAlert,
      isOutdoor: item.isOutdoor
    });

    return (
      <TouchableOpacity
        style={styles.reminderBox}
        key={item.id}
        onPress={() => handleReminderPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.reminderContent}>
          <Text style={styles.title}>{item.title}</Text>

          {/* Show if it's an outdoor reminder */}
          {item.isOutdoor && (
            <Text style={styles.locationText}>🌳 Outdoor Activity</Text>
          )}

          {/* Show location name if available */}
          {item.location && (
            <Text style={styles.locationText}>📍 {item.location.name}</Text>
          )}

          {/* Weather info only shown if weather data or alert exists */}
          {(item.weather || item.weatherAlert) &&
            renderWeatherInfo(item.weather, item.weatherAlert)}
          
          {/* Debug info - remove this in production */}
          {__DEV__ && (
            <Text style={{fontSize: 10, color: 'red'}}>
              Debug: Weather={!!item.weather}, Alert={!!item.weatherAlert}, Outdoor={!!item.isOutdoor}
            </Text>
          )}
        </View>

        <View style={styles.reminderActions}>
          <Switch
            value={item.isActive}
            onValueChange={() => toggleReminder(item.id)}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={item.isActive ? "#f5dd4b" : "#f4f3f4"}
          />
          <TouchableOpacity
            style={styles.assignLocationButton}
            onPress={(e) => {
              e.stopPropagation();
              setReminderToAssign(item.id);
              setMapVisible(true);
            }}
          >
            <Text style={styles.assignLocationText}>
              {item.location ? "📍" : "📍+"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={require("../../assets/images/ImageBackground.jpg")}
      style={styles.container}
      imageStyle={{ opacity: 0.2 }}
      resizeMode="cover"
    >
      <Text style={styles.header}>Reminders</Text>

      {/* Location Tracking Settings */}
      <View style={styles.settingsContainer}>
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextContainer}>
            <Text style={styles.settingsTitle}>Location Notifications</Text>
            <Text style={styles.settingsSubtitle}>
              Get notified when near your reminders
            </Text>
          </View>
          {isTrackingLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Switch
              value={isLocationTrackingEnabled}
              onValueChange={toggleLocationTracking}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isLocationTrackingEnabled ? "#f5dd4b" : "#f4f3f4"}
            />
          )}
        </View>
        
        {/* Test button */}
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={testNotification}
          activeOpacity={0.7}
        >
          <Text style={styles.testButtonText}>Test Notification</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {categories.map((category) => {
          const categoryReminders = reminders.filter((r) => r.category === category);

          return (
            <View
              key={category}
              style={[styles.categoryBox, { backgroundColor: getColorForCategory(category) }]}
            >
              <View style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCategory(category);
                      setModalVisible(true);
                    }}
                    style={styles.addButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                {categoryReminders.length > 0 ? (
                  categoryReminders.map((item) => renderReminder(item))
                ) : (
                  <Text style={styles.emptyText}>No reminders in this category.</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Reminder Modal */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={isModalVisible}
        onRequestClose={resetModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>
              Add {selectedCategory} Reminder
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter reminder title"
              value={newReminderTitle}
              onChangeText={setNewReminderTitle}
              autoFocus
              maxLength={100}
            />
            
            {/* Debug info to see current state */}
            <Text style={{ fontSize: 12, color: 'blue', marginBottom: 10 }}>
              Debug: isOutdoor = {isOutdoor ? 'true' : 'false'}
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
              <Text style={{ marginRight: 10 }}>Is Outdoor</Text>
              <Switch
                value={isOutdoor}
                onValueChange={(value) => {
                  console.log("🔄 Switch toggled to:", value);
                  setIsOutdoor(value);
                }}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={isOutdoor ? "#f5dd4b" : "#f4f3f4"}
              />
              <Text style={{ marginLeft: 10, color: isOutdoor ? 'green' : 'red' }}>
                {isOutdoor ? 'ON' : 'OFF'}
              </Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => {
                  console.log("🔄 About to create reminder with isOutdoor:", isOutdoor);
                  addReminder();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Add Reminder</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={resetModal}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Reminder Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={isDeleteModalVisible}
        onRequestClose={resetDeleteModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Delete Reminder</Text>
            <Text style={styles.deleteText}>
              Are you sure you want to delete "{selectedReminder?.title}"?
            </Text>
            <Text style={styles.deleteSubtext}>
              This action cannot be undone.
            </Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.deleteButton]} 
                onPress={() => selectedReminder && deleteReminder(selectedReminder.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.button} 
                onPress={resetDeleteModal}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map Modal */}
      <Modal 
        visible={isMapVisible} 
        animationType="slide" 
        onRequestClose={() => setMapVisible(false)}
      >
        <MapScreen 
          reminders={reminders} 
          onAssignLocation={onAssignLocation}
          reminderToAssign={reminderToAssign}
        />
        <TouchableOpacity 
          style={styles.closeMapButton} 
          onPress={() => setMapVisible(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Close Map</Text>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  // Settings container styles
  settingsContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  settingsTextContainer: {
    flex: 1,
    marginRight: 15,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  settingsSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  testButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "center",
  },
  testButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  categoryBox: {
    padding: 15,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categorySection: {
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  addButtonText: {
    color: "#333",
    fontSize: 24,
    fontWeight: "bold",
  },
  reminderBox: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderContent: {
    flex: 1,
    marginRight: 10,
  },
  reminderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  // Weather-specific styles
  weatherContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(135, 206, 235, 0.1)",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#87CEEB",
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  weatherIcon: {
    fontSize: 24,
    marginRight: 8,
    marginTop: 2,
  },
  weatherDetails: {
    flex: 1,
  },
  weatherForecast: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
    marginBottom: 2,
    lineHeight: 16,
  },
  weatherRecommendation: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 2,
    lineHeight: 14,
  },
  weatherArea: {
    fontSize: 11,
    color: "#888",
    lineHeight: 13,
  },
  weatherAlertContainer: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "rgba(255, 69, 0, 0.1)",
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: "#FF4500",
  },
  weatherAlert: {
    fontSize: 12,
    color: "#FF4500",
    fontWeight: "500",
    lineHeight: 14,
  },
  emptyText: {
    color: "#888",
    fontStyle: "italic",
    paddingVertical: 15,
    textAlign: "center",
  },
  assignLocationButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
  },
  assignLocationText: {
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  input: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  deleteText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  deleteSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  closeMapButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});