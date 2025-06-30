import * as Location from "expo-location";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Keyboard,
  Alert,
} from "react-native";
import MapView, { Marker, Region, MapPressEvent } from "react-native-maps";

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
  const [selectedProximity, setSelectedProximity] = useState<number>(10); // default proximity
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  // Search function
  const searchLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { "User-Agent": "LocationReminderApp" } }
      );
      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(data.length > 0);
    } catch (e) {
      console.error("Search error:", e);
      Alert.alert("Search Error", "Could not fetch search results.");
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

  // Select a search result
  const handleSearchResultSelect = (result: SearchResult) => {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    const newRegion = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
    setRegion(newRegion);
    setSearchMarker({ latitude, longitude, title: result.display_name.split(",")[0] });
    mapRef.current?.animateToRegion(newRegion, 1000);
    setSearchQuery(result.display_name.split(",")[0]);
    setSearchResults([]);
    setShowSearchResults(false);
    Keyboard.dismiss();
  };

  // Map press: pick location
  const handleMapPress = (event: MapPressEvent) => {
    if (showSearchResults) {
      setShowSearchResults(false);
      return;
    }
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setModalVisible(true);
  };

  // Assign location to reminder
  const handleAssignLocation = async (reminderId: string) => {
    if (!selectedLocation) return;
    await onAssignLocation(reminderId, {
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      proximity: selectedProximity,
    });
    setSelectedLocation(null);
    setModalVisible(false);
    setSelectedProximity(10);
  };

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
            placeholder="Search..."
            value={searchQuery}
            onChangeText={handleSearchInput}
            onFocus={() => searchQuery.length >= 3 && setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            returnKeyType="search"
            onSubmitEditing={() => searchLocation(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); setShowSearchResults(false); }}>
              <Text style={{ fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
          {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
        {showSearchResults && (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.place_id}
            style={styles.searchResults}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSearchResultSelect(item)} style={styles.searchItem}>
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
        {/* Markers */}
        {searchMarker && <Marker coordinate={searchMarker} title={searchMarker.title} pinColor="green" />}
        {(reminders ?? []).filter(r => r.location).map(r => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.location!.latitude, longitude: r.location!.longitude }}
            title={r.title}
            description={r.category}
            pinColor="orange"
          />
        ))}
        {selectedLocation && <Marker coordinate={selectedLocation} pinColor="blue" title="Selected" />}
      </MapView>

      {/* Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>Set Proximity & Choose Reminder</Text>
            <Text>Proximity:</Text>
            <View style={styles.proximityOptions}>
              {[1, 10, 25, 50].map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSelectedProximity(p)}
                  style={[styles.proximityButton, selectedProximity === p && styles.proximitySelected]}
                >
                  <Text style={selectedProximity === p ? { color: "white" } : undefined}>{p}m</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FlatList
              data={reminders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.reminderItem} onPress={() => handleAssignLocation(item.id)}>
                  <Text>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 10 }}>
              <Text style={{ color: "red" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  map: { 
    flex: 1 
  },

  loader: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },

  error: { 
    color: "red" 
  },

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
    borderRadius: 20 
  },

  searchInput: { 
    flex: 1 
  },

  searchResults: { 
    backgroundColor: "white", 
    maxHeight: 200 
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
    padding: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: "#eee" 
  },
});
