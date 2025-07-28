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
  ActivityIndicator,
} from "react-native";
import { NotificationService } from "../../services/notificationService";
import MapScreen from "./map";
import { Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Category = {
  id: string;
  name: string;
  color: string;
};

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
  aiGenerated?: boolean;
  reason?: string;
  priority?: string;
  relatedEvent?: string;
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

// Default categories
const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Travel', color: '#45B7D1' },
  { id: '2', name: 'Personal', color: '#FF6B6B' },
  { id: '3', name: 'Work', color: '#4ECDC4' }
  ,
];

const CATEGORY_COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF9999', '#66B2FF',
  '#99FF99', '#FFB366', '#FF66FF', '#66FFB2', '#B366FF',
  '#FFD700', '#87CEEB', '#20B2AA', '#F0E68C', '#FFB6C1'
];

const API_ENDPOINTS = {
  REMINDERS: "http://10.0.2.2:5002/api/reminders", 
  REMINDER_BY_ID: (id: string) => `http://10.0.2.2:5002/api/reminders/${id}`,
  WEATHER_REMINDERS_BATCH: "http://10.0.2.2:5002/api/weather/reminders-batch",
  SYNC_AI_REMINDERS: "http://10.0.2.2:5002/api/reminders/sync-ai",
  AI_STATS: "http://10.0.2.2:5002/api/reminders/stats/ai",
};

export default function RemindersScreen(): React.ReactElement {
  const router = useRouter();

  // State management
  const [reminders, setReminders] = useState<ReminderWithWeather[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isOutdoor, setIsOutdoor] = useState(false);
  const [isMapVisible, setMapVisible] = useState(false);
  const [reminderToAssign, setReminderToAssign] = useState<string | null>(null);
  
  // Category management state
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryColor, setSelectedCategoryColor] = useState(CATEGORY_COLOR_OPTIONS[0]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Delete modal state
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  // Location tracking state
  const [isLocationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
  const [isTrackingLoading, setTrackingLoading] = useState(false);

  // AI Sync state
  const [aiRemindersCount, setAIRemindersCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadCategories();
    loadReminders();
    checkTrackingStatus();
    checkForAIRemindersToSync();
  }, []);

  const checkForAIRemindersToSync = async (): Promise<number> => {
    try {
      const storedAIReminders = await AsyncStorage.getItem('suggested_reminders');
      if (storedAIReminders) {
        const aiReminders = JSON.parse(storedAIReminders);
        setAIRemindersCount(aiReminders.length);
        return aiReminders.length;
      }
    } catch (error) {
      console.error('Error checking AI reminders:', error);
    }
    setAIRemindersCount(0);
    return 0;
  };

  const loadAIReminders = async (): Promise<Reminder[]> => {
    try {
      const storedAIReminders = await AsyncStorage.getItem('suggested_reminders');
      if (storedAIReminders) {
        const aiReminders = JSON.parse(storedAIReminders);
        return aiReminders.map((reminder: any) => ({
          id: reminder.id,
          title: reminder.title,
          category: reminder.category,
          isActive: reminder.isActive ?? true,
          isOutdoor: reminder.isOutdoor ?? false,
          aiGenerated: true,
          reason: reminder.reason,
          priority: reminder.priority,
          relatedEvent: reminder.relatedEvent,
        }));
      }
    } catch (error) {
      console.error('Error loading AI reminders:', error);
    }
    return [];
  };

  const syncAIRemindersToBackend = async (): Promise<void> => {
    if (isSyncing) return;

    try {
      setIsSyncing(true);
      console.log("🔄 Starting AI reminders sync...");
      
      const storedAIReminders = await AsyncStorage.getItem('suggested_reminders');
      if (!storedAIReminders) {
        Alert.alert("No AI Reminders", "No AI reminders found to sync.");
        return;
      }

      const aiReminders = JSON.parse(storedAIReminders);
      if (aiReminders.length === 0) {
        Alert.alert("No AI Reminders", "No AI reminders found to sync.");
        return;
      }

      const response = await fetch(API_ENDPOINTS.SYNC_AI_REMINDERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiReminders }),
      });

      if (response.ok) {
        const result = await response.json();
        await AsyncStorage.removeItem('suggested_reminders');
        setAIRemindersCount(0);
        await loadReminders();
        
        Alert.alert(
          "Sync Complete! 🎉", 
          `${result.synced} AI reminders synced!\nSkipped: ${result.skipped}\nErrors: ${result.errors}`
        );
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Sync failed: ${response.status}`);
      }
    } catch (error: any) {
      console.error("❌ Error syncing AI reminders:", error);
      Alert.alert("Sync Error", `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Category management functions
  const loadCategories = async () => {
    try {
      const storedCategories = await AsyncStorage.getItem('reminder_categories');
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const saveCategories = async (newCategories: Category[]) => {
    try {
      await AsyncStorage.setItem('reminder_categories', JSON.stringify(newCategories));
      setCategories(newCategories);
    } catch (error) {
      console.error('Error saving categories:', error);
      Alert.alert('Error', 'Failed to save categories');
    }
  };

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setNewCategoryName(category.name);
      setSelectedCategoryColor(category.color);
    } else {
      setEditingCategory(null);
      setNewCategoryName("");
      setSelectedCategoryColor(CATEGORY_COLOR_OPTIONS[0]);
    }
    setCategoryModalVisible(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalVisible(false);
    setEditingCategory(null);
    setNewCategoryName("");
    setSelectedCategoryColor(CATEGORY_COLOR_OPTIONS[0]);
  };

  const addOrUpdateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    // Check for duplicate names (except when editing)
    const isDuplicate = categories.some((cat) => 
      cat.name.toLowerCase() === newCategoryName.trim().toLowerCase() && 
      cat.id !== editingCategory?.id
    );

    if (isDuplicate) {
      Alert.alert("Error", "A category with this name already exists");
      return;
    }

    let updatedCategories: Category[];

    if (editingCategory) {
      // Update existing category
      updatedCategories = categories.map((cat) =>
        cat.id === editingCategory.id
          ? { ...cat, name: newCategoryName.trim(), color: selectedCategoryColor }
          : cat
      );
    } else {
      // Add new category
      const newCategory: Category = {
        id: Date.now().toString(),
        name: newCategoryName.trim(),
        color: selectedCategoryColor,
      };
      updatedCategories = [...categories, newCategory];
    }

    await saveCategories(updatedCategories);
    closeCategoryModal();
    Alert.alert("Success", editingCategory ? "Category updated!" : "Category added!");
  };

  const deleteCategory = (categoryId: string) => {
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return;

    // Check if category is being used by any reminders
    const isUsed = reminders.some(reminder => reminder.category === categoryToDelete.name);
    
    if (isUsed) {
      Alert.alert(
        "Cannot Delete",
        "This category is being used by one or more reminders. Please reassign or delete those reminders first."
      );
      return;
    }

    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${categoryToDelete.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedCategories = categories.filter(cat => cat.id !== categoryId);
            await saveCategories(updatedCategories);
            Alert.alert("Success", "Category deleted!");
          },
        },
      ]
    );
  };

  const getColorForCategory = (categoryName: string): string => {
    const category = categories.find(cat => cat.name === categoryName);
    return category ? category.color : "#f0f0f0";
  };

  // Check tracking status
  const checkTrackingStatus = async () => {
    try {
      const isTracking = await NotificationService.getTrackingStatus();
      setLocationTrackingEnabled(isTracking);
    } catch (error) {
      console.error("Error checking tracking status:", error);
    }
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
    try {
      await NotificationService.sendTestNotification();
      Alert.alert("Test Sent", "Check if you received a test notification!");
    } catch (error) {
      console.error("Error sending test notification:", error);
      Alert.alert("Error", "Failed to send test notification");
    }
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
    setIsOutdoor(false);
  };

  // Load reminders function with complete weather API flow
  const loadReminders = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Load server reminders
      const response = await fetch(API_ENDPOINTS.REMINDERS);
      let serverReminders: Reminder[] = [];
      
      if (response.ok) {
        const data = await response.json();
        serverReminders = data.map((r: any) => ({
          id: r._id,
          title: r.title,
          category: r.category,
          isActive: r.isActive ?? true,
          isOutdoor: Boolean(r.isOutdoor),
          location: r.location,
          aiGenerated: r.aiGenerated ?? false,
          reason: r.reason,
          priority: r.priority,
          relatedEvent: r.relatedEvent,
        }));
      }

      // Load local AI reminders
      const localAIReminders = await loadAIReminders();
      setAIRemindersCount(localAIReminders.length);
      
      // Combine both types
      const allReminders = [...serverReminders, ...localAIReminders];

      // Filter outdoor reminders with locations for weather data
      const outdoorRemindersWithLocation = allReminders.filter(
        (reminder) => reminder.isOutdoor && 
                      reminder.location && 
                      reminder.location.latitude && 
                      reminder.location.longitude &&
                      reminder.location.name !== undefined
      );

      console.log(`🌤️ Found ${outdoorRemindersWithLocation.length} outdoor reminders with locations`);

      let remindersWithWeather = allReminders;

      // Fetch weather data for outdoor reminders if any exist
      if (outdoorRemindersWithLocation.length > 0) {
        try {
          console.log("🌦️ Fetching weather data...");
          
          const weatherResponse = await fetch(API_ENDPOINTS.WEATHER_REMINDERS_BATCH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reminders: outdoorRemindersWithLocation.map(r => ({
                id: r.id,
                title: r.title,
                location: r.location,
                isOutdoor: r.isOutdoor
              }))
            }),
          });

          if (weatherResponse.ok) {
            const weatherData = await weatherResponse.json();
            console.log("✅ Weather data received:", weatherData);
            
            // Map weather data back to reminders
            remindersWithWeather = allReminders.map(reminder => {
              if (reminder.isOutdoor && reminder.location) {
                const weatherInfo = weatherData.reminders?.find((wr: any) => wr.id === reminder.id);
                if (weatherInfo) {
                  return {
                    ...reminder,
                    weather: weatherInfo.weather,
                    weatherAlert: weatherInfo.weatherAlert
                  };
                }
              }
              return reminder;
            });
            
            console.log(`🌈 Weather attached to ${weatherData.reminders?.length || 0} reminders`);
          } else {
            console.error("❌ Weather API failed:", weatherResponse.status, await weatherResponse.text());
          }
        } catch (weatherError) {
          console.error("❌ Weather fetch error:", weatherError);
        }
      }

      setReminders(remindersWithWeather);
      
    } catch (error) {
      console.error("❌ Error loading reminders:", error);
      Alert.alert("Error", "Failed to load reminders");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReminder = async (id: string): Promise<void> => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    const updatedReminder = { ...reminder, isActive: !reminder.isActive };
    
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? updatedReminder : r))
    );

    try {
      const response = await fetch(API_ENDPOINTS.REMINDER_BY_ID(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !reminder.isActive }),
      });

      if (!response.ok) {
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? reminder : r))
        );
        Alert.alert("Error", "Failed to update reminder status");
      }
    } catch (error) {
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

    try {
      const response = await fetch(API_ENDPOINTS.REMINDERS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReminder),
      });

      if (response.ok) {
        resetModal();
        setTimeout(() => {
          loadReminders();
        }, 500);
      } else {
        Alert.alert("Error", "Failed to save reminder");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to connect to server");
    }
  };

  const deleteReminder = async (id: string): Promise<void> => {
    try {
      const response = await fetch(API_ENDPOINTS.REMINDER_BY_ID(id), {
        method: "DELETE",
      });

      if (response.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        resetDeleteModal();
        Alert.alert("Success", "Reminder deleted successfully");
      } else {
        Alert.alert("Error", "Failed to delete reminder");
      }
    } catch (error) {
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
    Keyboard.dismiss();
    
    setReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, location } : r))
    );

    try {
      const response = await fetch(API_ENDPOINTS.REMINDER_BY_ID(reminderId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });

      if (response.ok) {
        setTimeout(() => {
          loadReminders();
        }, 500);
      } else {
        setReminders((prev) =>
          prev.map((r) => (r.id === reminderId ? { ...r, location: undefined } : r))
        );
        Alert.alert("Error", "Failed to update location");
      }
    } catch (error) {
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

  const renderWeatherInfo = (weather: WeatherData | undefined, weatherAlert: string | null | undefined) => {
    if (!weather && !weatherAlert) {
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

  const renderReminder = (item: ReminderWithWeather) => {
    return (
      <TouchableOpacity
        style={styles.verticalContent}
        key={item.id}
        onPress={() => handleReminderPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.reminderBox}>
          <View style={styles.reminderContent}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.title}</Text>
              {item.aiGenerated && (
                <View style={styles.aiGeneratedBadge}>
                  <Text style={styles.aiGeneratedText}>🤖 AI</Text>
                </View>
              )}
            </View>

            {item.reason && (
              <Text style={styles.aiReasonText}>💡 {item.reason}</Text>
            )}

            {item.relatedEvent && (
              <Text style={styles.relatedEventText}>📅 Related: {item.relatedEvent}</Text>
            )}

            {item.location && (
              <Text style={styles.locationText}>📍 {item.location.name}</Text>
            )}

            {item.isOutdoor && (
              <Text style={styles.locationText}>🌳 Outdoor Activity</Text>
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
        </View>
        {(item.weather || item.weatherAlert) &&
          renderWeatherInfo(item.weather, item.weatherAlert)}
      </TouchableOpacity>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading reminders...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/ImageBackground.jpg")}
      style={styles.container}
      imageStyle={{ opacity: 0.2 }}
      resizeMode="cover"
    >
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Reminders</Text>
        <View style={styles.headerActions}>
          {aiRemindersCount > 0 && (
            <TouchableOpacity 
              style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
              onPress={syncAIRemindersToBackend}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>⬆️ Sync {aiRemindersCount}</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.manageCategoriesButton}
            onPress={() => openCategoryModal()}
          >
            <Text style={styles.manageCategoriesText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {categories.map((category) => {
          const categoryReminders = reminders.filter((r) => r.category === category.name);

          return (
            <View
              key={category.id}
              style={[styles.categoryBox, { backgroundColor: category.color }]}
            >
              <View style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{category.name}</Text>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      onPress={() => openCategoryModal(category)}
                      style={styles.editCategoryButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editCategoryText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedCategory(category.name);
                        setModalVisible(true);
                      }}
                      style={styles.addButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
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
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
              <Text style={{ marginRight: 10 }}>Is Outdoor</Text>
              <Switch
                value={isOutdoor}
                onValueChange={setIsOutdoor}
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
                onPress={addReminder}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Add Reminder</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.modalCancelButton]} 
                onPress={resetModal}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Management Modal */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={isCategoryModalVisible}
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Category name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              maxLength={50}
            />
            
            <Text style={styles.colorPickerLabel}>Choose Color:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.colorPickerContainer}
            >
              {CATEGORY_COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedCategoryColor === color && styles.selectedColorOption
                  ]}
                  onPress={() => setSelectedCategoryColor(color)}
                />
              ))}
            </ScrollView>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={addOrUpdateCategory}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {editingCategory ? 'Update' : 'Add'} Category
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.modalCancelButton]} 
                onPress={closeCategoryModal}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {editingCategory && (
              <TouchableOpacity 
                style={[styles.button, styles.deleteButton, { marginTop: 10 }]} 
                onPress={() => {
                  closeCategoryModal();
                  deleteCategory(editingCategory.id);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Delete Category</Text>
              </TouchableOpacity>
            )}
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
  },
  manageCategoriesButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
  },
  manageCategoriesText: {
    fontSize: 18,
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
    flex: 1,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editCategoryButton: {
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  editCategoryText: {
    fontSize: 16,
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
    padding: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reminderContent: {
    flex: 1,

  },
  reminderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionButtonsContainer: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
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
  weatherContainer: {
    marginTop: 6,
    padding: 8,
    backgroundColor: "rgba(135, 206, 235, 0.1)",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#87CEEB",
    alignSelf: 'stretch',
    width: '100%',
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: 'flex-start',
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
    minWidth: 40,
    alignItems: "center",
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
  colorPickerLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
    alignSelf: "flex-start",
    color: "#333",
  },
  colorPickerContainer: {
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedColorOption: {
    borderColor: "#000",
    borderWidth: 3,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    backgroundColor: "#539ceaff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "grey",
  },
  deleteButton: {
    backgroundColor: "#f6726bff",
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
  reminderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  verticalContent: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  calendarWrapper: {
    backgroundColor: '#ffffff',
    marginHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  },
  syncButton: {
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 80,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  aiGeneratedBadge: {
    backgroundColor: "#9C27B0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  aiGeneratedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  aiReasonText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 4,
  },
  relatedEventText: {
    fontSize: 12,
    color: "#007AFF",
    marginBottom: 4,
  },
});

/*
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
      
        
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={testNotification}
          activeOpacity={0.7}
        >
          <Text style={styles.testButtonText}>Test Notification</Text>
        </TouchableOpacity>
      </View>
*/