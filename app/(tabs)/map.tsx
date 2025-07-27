// map.tsx - Updated with Singapore areas for weather support

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

// Singapore areas from your weather API
const SINGAPORE_AREAS = [
  { name: 'Ang Mo Kio', coordinates: { latitude: 1.375, longitude: 103.839 } },
  { name: 'Bedok', coordinates: { latitude: 1.321, longitude: 103.924 } },
  { name: 'Bishan', coordinates: { latitude: 1.350772, longitude: 103.839 } },
  { name: 'Boon Lay', coordinates: { latitude: 1.304, longitude: 103.701 } },
  { name: 'Bukit Batok', coordinates: { latitude: 1.353, longitude: 103.754 } },
  { name: 'Bukit Merah', coordinates: { latitude: 1.277, longitude: 103.819 } },
  { name: 'Bukit Panjang', coordinates: { latitude: 1.362, longitude: 103.77195 } },
  { name: 'Bukit Timah', coordinates: { latitude: 1.325, longitude: 103.791 } },
  { name: 'Central Water Catchment', coordinates: { latitude: 1.38, longitude: 103.805 } },
  { name: 'Changi', coordinates: { latitude: 1.357, longitude: 103.987 } },
  { name: 'Choa Chu Kang', coordinates: { latitude: 1.377, longitude: 103.745 } },
  { name: 'City', coordinates: { latitude: 1.292, longitude: 103.844 } },
  { name: 'Clementi', coordinates: { latitude: 1.315, longitude: 103.76 } },
  { name: 'Geylang', coordinates: { latitude: 1.318, longitude: 103.884 } },
  { name: 'Hougang', coordinates: { latitude: 1.361218, longitude: 103.886 } },
  { name: 'Jalan Bahar', coordinates: { latitude: 1.347, longitude: 103.67 } },
  { name: 'Jurong East', coordinates: { latitude: 1.326, longitude: 103.737 } },
  { name: 'Jurong Island', coordinates: { latitude: 1.266, longitude: 103.699 } },
  { name: 'Jurong West', coordinates: { latitude: 1.34039, longitude: 103.705 } },
  { name: 'Kallang', coordinates: { latitude: 1.312, longitude: 103.862 } },
  { name: 'Lim Chu Kang', coordinates: { latitude: 1.423, longitude: 103.717332 } },
  { name: 'Mandai', coordinates: { latitude: 1.419, longitude: 103.812 } },
  { name: 'Marine Parade', coordinates: { latitude: 1.297, longitude: 103.891 } },
  { name: 'Novena', coordinates: { latitude: 1.327, longitude: 103.826 } },
  { name: 'Pasir Ris', coordinates: { latitude: 1.37, longitude: 103.948 } },
  { name: 'Paya Lebar', coordinates: { latitude: 1.358, longitude: 103.914 } },
  { name: 'Pioneer', coordinates: { latitude: 1.315, longitude: 103.675 } },
  { name: 'Pulau Tekong', coordinates: { latitude: 1.403, longitude: 104.053 } },
  { name: 'Pulau Ubin', coordinates: { latitude: 1.404, longitude: 103.96 } },
  { name: 'Punggol', coordinates: { latitude: 1.401, longitude: 103.904 } },
  { name: 'Queenstown', coordinates: { latitude: 1.291, longitude: 103.78576 } },
  { name: 'Seletar', coordinates: { latitude: 1.404, longitude: 103.869 } },
  { name: 'Sembawang', coordinates: { latitude: 1.445, longitude: 103.818495 } },
  { name: 'Sengkang', coordinates: { latitude: 1.384, longitude: 103.891443 } },
  { name: 'Sentosa', coordinates: { latitude: 1.243, longitude: 103.832 } },
  { name: 'Serangoon', coordinates: { latitude: 1.357, longitude: 103.865 } },
  { name: 'Southern Islands', coordinates: { latitude: 1.208, longitude: 103.842 } },
  { name: 'Sungei Kadut', coordinates: { latitude: 1.413, longitude: 103.756 } },
  { name: 'Tampines', coordinates: { latitude: 1.345, longitude: 103.944 } },
  { name: 'Tanglin', coordinates: { latitude: 1.308, longitude: 103.813 } },
  { name: 'Tengah', coordinates: { latitude: 1.374, longitude: 103.715 } },
  { name: 'Toa Payoh', coordinates: { latitude: 1.334304, longitude: 103.856327 } },
  { name: 'Tuas', coordinates: { latitude: 1.294947, longitude: 103.635 } },
  { name: 'Western Islands', coordinates: { latitude: 1.205926, longitude: 103.746 } },
  { name: 'Western Water Catchment', coordinates: { latitude: 1.405, longitude: 103.689 } },
  { name: 'Woodlands', coordinates: { latitude: 1.432, longitude: 103.786528 } },
  { name: 'Yishun', coordinates: { latitude: 1.418, longitude: 103.839 } },
];

// --- Type Definitions ---
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
  weather?: {
    area: string;
    forecast: string;
    timestamp: string;
    cached_at: string;
    warning: boolean;
    recommendation: string;
    icon: string;
  };
  weatherAlert?: string | null;
};

// Updated interface to match RemindersScreen expectations
type MapScreenProps = {
  reminders: Reminder[]; // This now matches ReminderWithWeather[]
  onAssignLocation: (
    reminderId: string,
    location: { 
      name: string; 
      latitude: number; 
      longitude: number; 
      proximity: number 
    }
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
  reminderToAssign,
}: MapScreenProps): React.ReactElement {
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ 
    latitude: number; 
    longitude: number; 
    areaName?: string;
  } | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedProximity, setSelectedProximity] = useState<number>(100);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchMarker, setSearchMarker] = useState<{ 
    latitude: number; 
    longitude: number; 
    title: string;
    areaName?: string;
  } | null>(null);

  // Singapore area search
  const [filteredAreas, setFilteredAreas] = useState(SINGAPORE_AREAS);
  const [showAreaResults, setShowAreaResults] = useState(false);

  const mapRef = useRef<MapView>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const toRadians = (degrees: number) => degrees * (Math.PI/180);

  // Find nearest Singapore area for any coordinate
  const findNearestArea = (latitude: number, longitude: number) => {
    let nearestArea = SINGAPORE_AREAS[0];
    let minDistance = Infinity;

    SINGAPORE_AREAS.forEach(area => {
      const distance = calculateDistance(
        latitude, 
        longitude, 
        area.coordinates.latitude, 
        area.coordinates.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestArea = area;
      }
    });

    return { area: nearestArea, distance: minDistance };
  };

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          // Set default location (Singapore)
          setRegion({
            latitude: 1.3521,
            longitude: 103.8198,
            latitudeDelta: 0.3,
            longitudeDelta: 0.3,
          });
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
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
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        });
      }
    })();
  }, []);

  // Enhanced search function that includes Singapore areas
  const performSearch = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setFilteredAreas([]);
      setShowSearchResults(false);
      setShowAreaResults(false);
      return;
    }
    
    // Filter Singapore areas
    const matchingAreas = SINGAPORE_AREAS.filter(area =>
      area.name.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredAreas(matchingAreas);
    setShowAreaResults(matchingAreas.length > 0);

    // Also search general locations if query is longer
    if (query.length >= 3) {
      setIsSearching(true);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=sg`,
          { 
            headers: { "User-Agent": "LocationReminderApp/1.0" },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          setSearchResults(Array.isArray(data) ? data : []);
          setShowSearchResults(Array.isArray(data) && data.length > 0);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
        setShowSearchResults(false);
      } finally {
        setIsSearching(false);
      }
    }
  };

  // Debounced input
  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => performSearch(text), 300);
  };

  // Select a Singapore area
  const handleAreaSelect = (area: typeof SINGAPORE_AREAS[0]) => {
    const newRegion = { 
      latitude: area.coordinates.latitude, 
      longitude: area.coordinates.longitude, 
      latitudeDelta: 0.005, 
      longitudeDelta: 0.005 
    };
    setRegion(newRegion);
    setSearchMarker({ 
      latitude: area.coordinates.latitude, 
      longitude: area.coordinates.longitude, 
      title: area.name,
      areaName: area.name
    });
    mapRef.current?.animateToRegion(newRegion, 1000);
    setSearchQuery(area.name);
    setFilteredAreas([]);
    setShowAreaResults(false);
    setShowSearchResults(false);
    Keyboard.dismiss();
  };

  // Select a search result
  const handleSearchResultSelect = (result: SearchResult) => {
    try {
      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        Alert.alert("Invalid Location", "The selected location has invalid coordinates.");
        return;
      }

      // Find nearest Singapore area
      const { area } = findNearestArea(latitude, longitude);
      
      const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      setRegion(newRegion);
      setSearchMarker({ 
        latitude, 
        longitude, 
        title: result.display_name.split(",")[0],
        areaName: area.name
      });
      mapRef.current?.animateToRegion(newRegion, 1000);
      setSearchQuery(result.display_name.split(",")[0]);
      setSearchResults([]);
      setShowSearchResults(false);
      setShowAreaResults(false);
      Keyboard.dismiss();
    } catch (error) {
      console.error("Error selecting search result:", error);
      Alert.alert("Error", "Could not select this location. Please try another.");
    }
  };

  // Map press: pick location and find nearest area
  const handleMapPress = (event: MapPressEvent) => {
    if (showSearchResults || showAreaResults) {
      setShowSearchResults(false);
      setShowAreaResults(false);
      return;
    }
    
    try {
      const coordinate = event.nativeEvent.coordinate;
      
      if (!coordinate || isNaN(coordinate.latitude) || isNaN(coordinate.longitude)) {
        Alert.alert("Invalid Location", "Could not get valid coordinates for this location.");
        return;
      }

      // Find nearest Singapore area
      const { area, distance } = findNearestArea(coordinate.latitude, coordinate.longitude);
      
      setSelectedLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        areaName: area.name
      });
      setModalVisible(true);
    } catch (error) {
      console.error("Map press error:", error);
      Alert.alert("Error", "Could not select this location. Please try again.");
    }
  };

  // Assign location to reminder with area name
  const handleAssignLocation = async (reminderId: string) => {
    if (!selectedLocation) {
      Alert.alert("Error", "No location selected.");
      return;
    }
    
    try {
      // Use the area name for weather compatibility
      const locationData = {
        name: selectedLocation.areaName || 'Unknown Area',
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        proximity: selectedProximity,
      };

      console.log('🗺️ Assigning location with area name:', locationData);
      
      await onAssignLocation(reminderId, locationData);
      setSelectedLocation(null);
      setModalVisible(false);
      setSelectedProximity(100);
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
            placeholder="Search Singapore areas or locations..."
            value={searchQuery}
            onChangeText={handleSearchInput}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                performSearch(searchQuery);
              }
            }}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { 
              setSearchQuery(""); 
              setSearchResults([]); 
              setFilteredAreas([]);
              setShowSearchResults(false); 
              setShowAreaResults(false);
              setSearchMarker(null);
            }}>
              <Text style={{ fontSize: 16, padding: 5 }}>✕</Text>
            </TouchableOpacity>
          )}
          {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
        
        {/* Singapore Areas Results */}
        {showAreaResults && filteredAreas.length > 0 && (
          <FlatList
            data={filteredAreas}
            keyExtractor={(item) => item.name}
            style={[styles.searchResults, { backgroundColor: '#e8f5e8' }]}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => handleAreaSelect(item)} 
                style={styles.searchItem}
              >
                <Text style={{ fontWeight: 'bold' }}>📍 {item.name}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Singapore Area (Weather Available)</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {/* General Search Results */}
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
        {/* Singapore area markers */}
        {SINGAPORE_AREAS.map((area, index) => (
          <Marker
            key={`area-${index}`}
            coordinate={area.coordinates}
            title={area.name}
            description="Singapore Area - Weather Available"
            pinColor="blue"
            onPress={() => handleAreaSelect(area)}
          />
        ))}

        {/* Search marker */}
        {searchMarker && (
          <Marker 
            coordinate={searchMarker} 
            title={searchMarker.title}
            description={searchMarker.areaName ? `Nearest: ${searchMarker.areaName}` : undefined}
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
            description={`${reminder.category} • ${reminder.location!.name || 'Location'}`}
            pinColor="orange"
          />
        ))}
        
        {/* Selected location marker */}
        {selectedLocation && (
          <Marker 
            coordinate={selectedLocation} 
            pinColor="red" 
            title="Selected Location"
            description={selectedLocation.areaName ? `Area: ${selectedLocation.areaName}` : undefined}
          />
        )}
      </MapView>

      {/* Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "bold", marginBottom: 10, fontSize: 16 }}>
              Assign Location to Reminder
            </Text>
            
            {selectedLocation?.areaName && (
              <View style={{ backgroundColor: '#e8f5e8', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                <Text style={{ fontWeight: 'bold', color: '#2d5a2d' }}>
                  📍 Singapore Area: {selectedLocation.areaName}
                </Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  Weather data will be available for this location
                </Text>
              </View>
            )}
            
            <Text style={{ marginBottom: 5 }}>Notification Distance:</Text>
            <View style={styles.proximityOptions}>
              {[10, 50, 100, 200, 500].map(proximity => (
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
            
            <Text style={{ marginTop: 15, marginBottom: 5, fontWeight: 'bold' }}>
              {reminderToAssign ? 'Confirm Assignment:' : 'Select Reminder:'}
            </Text>
            
            <FlatList
              data={reminderToAssign ? reminders.filter(r => r.id === reminderToAssign) : reminders}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.reminderItem,
                    reminderToAssign === item.id && { backgroundColor: '#007AFF' }
                  ]} 
                  onPress={() => handleAssignLocation(item.id)}
                >
                  <Text style={reminderToAssign === item.id ? { color: 'white' } : undefined}>
                    {item.title} ({item.category})
                    {item.isOutdoor && ' 🌳'}
                  </Text>
                </TouchableOpacity>
              )}
            />
            
            <TouchableOpacity 
              onPress={() => setModalVisible(false)} 
              style={{ marginTop: 15, alignItems: 'center', padding: 10 }}
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
    marginVertical: 10,
    flexWrap: 'wrap'
  },
  proximityButton: { 
    borderWidth: 1, 
    borderColor: "#007AFF", 
    borderRadius: 20, 
    padding: 8, 
    marginHorizontal: 3,
    marginVertical: 2
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