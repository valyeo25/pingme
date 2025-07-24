// map.tsx - Fixed version with proper error handling types

import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { MapPressEvent, Marker, Region } from "react-native-maps";

// --- Type Definitions ---
type Reminder = {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
  location?: {
    latitude: number;
    longitude: number;
    proximity?: number;
  };
};

type MapScreenProps = {
  reminders: Reminder[];
  onAssignLocation: (
    reminderId: string,
    location: { latitude: number; longitude: number; proximity: number }
  ) => Promise<void>;
  reminderToAssign: string | null;
};

type SearchResult = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
};

export default function MapScreen({
  reminders,
  onAssignLocation,
}: MapScreenProps): React.ReactElement {
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedProximity, setSelectedProximity] = useState<number>(10);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchMarker, setSearchMarker] = useState<{ latitude: number; longitude: number; title: string } | null>(null);

  const mapRef = useRef<MapView>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          // Set default location (Singapore) if permission denied
          setRegion({
            latitude: 1.3521,
            longitude: 103.8198,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        // Validate coordinates before setting
        if (loc?.coords?.latitude && loc?.coords?.longitude) {
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        } else {
          throw new Error("Invalid location data received");
        }
      } catch (error) {
        console.error("Location error:", error);
        setErrorMsg("Could not get location. Using default location.");
        // Default to Singapore
        setRegion({
          latitude: 1.3521,
          longitude: 103.8198,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    })();
  }, []);

  // Search function with better error handling
  const searchLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { 
          headers: { "User-Agent": "LocationReminderApp/1.0" },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setShowSearchResults(Array.isArray(data) && data.length > 0);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Search error:", error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        Alert.alert("Search Timeout", "Search request timed out. Please try again.");
      } else {
        Alert.alert("Search Error", "Could not fetch search results. Please try again.");
      }
      
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced input
  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocation(text), 500);
  };

  // Select a search result with validation
  const handleSearchResultSelect = (result: SearchResult) => {
    try {
      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);
      
      // Validate coordinates
      if (isNaN(latitude) || isNaN(longitude) || 
          latitude < -90 || latitude > 90 || 
          longitude < -180 || longitude > 180) {
        Alert.alert("Invalid Location", "The selected location has invalid coordinates.");
        return;
      }
      
      const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      setRegion(newRegion);
      setSearchMarker({ latitude, longitude, title: result.display_name.split(",")[0] });
      mapRef.current?.animateToRegion(newRegion, 1000);
      setSearchQuery(result.display_name.split(",")[0]);
      setSearchResults([]);
      setShowSearchResults(false);
      Keyboard.dismiss();
    } catch (error) {
      console.error("Error selecting search result:", error);
      Alert.alert("Error", "Could not select this location. Please try another.");
    }
  };

  // Map press: pick location with validation
  const handleMapPress = (event: MapPressEvent) => {
    if (showSearchResults) {
      setShowSearchResults(false);
      return;
    }
    
    try {
      const coordinate = event.nativeEvent.coordinate;
      
      // Validate coordinates
      if (!coordinate || 
          typeof coordinate.latitude !== 'number' || 
          typeof coordinate.longitude !== 'number' ||
          isNaN(coordinate.latitude) || 
          isNaN(coordinate.longitude)) {
        Alert.alert("Invalid Location", "Could not get valid coordinates for this location.");
        return;
      }
      
      setSelectedLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude
      });
      setModalVisible(true);
    } catch (error) {
      console.error("Map press error:", error);
      Alert.alert("Error", "Could not select this location. Please try again.");
    }
  };

  // Assign location to reminder with validation
  const handleAssignLocation = async (reminderId: string) => {
    if (!selectedLocation) {
      Alert.alert("Error", "No location selected.");
      return;
    }
    
    try {
      await onAssignLocation(reminderId, {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        proximity: selectedProximity,
      });
      setSelectedLocation(null);
      setModalVisible(false);
      setSelectedProximity(10);
    } catch (error) {
      console.error("Error assigning location:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      Alert.alert("Error", `Could not assign location to reminder: ${errorMessage}`);
    }
  };

  // Render valid reminders only
  const validReminders = (reminders || []).filter(r => 
    r?.location?.latitude != null && 
    r?.location?.longitude != null &&
    !isNaN(r.location.latitude) &&
    !isNaN(r.location.longitude)
  );

  if (!region) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Loading map...</Text>
        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search locations..."
            value={searchQuery}
            onChangeText={handleSearchInput}
            onFocus={() => searchQuery.length >= 3 && setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            returnKeyType="search"
            onSubmitEditing={() => searchLocation(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { 
              setSearchQuery(""); 
              setSearchResults([]); 
              setShowSearchResults(false); 
              setSearchMarker(null);
            }}>
              <Text style={{ fontSize: 16, padding: 5 }}>✕</Text>
            </TouchableOpacity>
          )}
          {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
        
        {showSearchResults && searchResults.length > 0 && (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.place_id}
            style={styles.searchResults}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => handleSearchResultSelect(item)} 
                style={styles.searchItem}
              >
                <Text numberOfLines={2}>{item.display_name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onPress={handleMapPress}
        showsUserLocation
        onRegionChangeComplete={(r) => setRegion(r)}
      >
        {/* Search marker */}
        {searchMarker && (
          <Marker 
            coordinate={searchMarker} 
            title={searchMarker.title} 
            pinColor="green" 
          />
        )}
        
        {/* Reminder markers */}
        {validReminders.map(reminder => (
          <Marker
            key={reminder.id}
            coordinate={{ 
              latitude: reminder.location!.latitude, 
              longitude: reminder.location!.longitude 
            }}
            title={reminder.title}
            description={reminder.category}
            pinColor="orange"
          />
        ))}
        
        {/* Selected location marker */}
        {selectedLocation && (
          <Marker 
            coordinate={selectedLocation} 
            pinColor="blue" 
            title="Selected Location" 
          />
        )}
      </MapView>

      {/* Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Set Proximity & Choose Reminder
            </Text>
            
            <Text>Proximity:</Text>
            <View style={styles.proximityOptions}>
              {[1, 10, 25, 50].map(proximity => (
                <TouchableOpacity
                  key={proximity}
                  onPress={() => setSelectedProximity(proximity)}
                  style={[
                    styles.proximityButton, 
                    selectedProximity === proximity && styles.proximitySelected
                  ]}
                >
                  <Text style={selectedProximity === proximity ? { color: "white" } : undefined}>
                    {proximity}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={{ marginTop: 10, marginBottom: 5 }}>Select Reminder:</Text>
            <FlatList
              data={reminders || []}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.reminderItem} 
                  onPress={() => handleAssignLocation(item.id)}
                >
                  <Text>{item.title} ({item.category})</Text>
                </TouchableOpacity>
              )}
            />
            
            <TouchableOpacity 
              onPress={() => setModalVisible(false)} 
              style={{ marginTop: 15, alignItems: 'center' }}
            >
              <Text style={{ color: "red", fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  map: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "red", marginTop: 10 },
  searchContainer: { 
    position: "absolute", 
    top: 50, 
    left: 20, 
    right: 20, 
    zIndex: 1000 
  },
  searchBar: { 
    backgroundColor: "white", 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 10, 
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  searchInput: { flex: 1 },
  searchResults: { 
    backgroundColor: "white", 
    maxHeight: 200,
    borderRadius: 10,
    marginTop: 5,
    elevation: 3,
  },
  searchItem: { 
    padding: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: "#eee" 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.5)", 
    justifyContent: "center", 
    padding: 20 
  },
  modalContent: { 
    backgroundColor: "white", 
    padding: 20, 
    borderRadius: 10, 
    maxHeight: "80%" 
  },
  proximityOptions: { 
    flexDirection: "row", 
    marginVertical: 10 
  },
  proximityButton: { 
    borderWidth: 1, 
    borderColor: "#007AFF", 
    borderRadius: 20, 
    padding: 8, 
    marginHorizontal: 5 
  },
  proximitySelected: { 
    backgroundColor: "#007AFF" 
  },
  reminderItem: { 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: "#eee",
    backgroundColor: "#f9f9f9",
    marginVertical: 2,
    borderRadius: 5,
  },
});