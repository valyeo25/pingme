import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as ExpoCalendar from 'expo-calendar';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';

// Types
interface CalendarEvent {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    allDay?: boolean;
    location?: string;
    notes?: string;
}

interface MarkedDates {
    [date: string]: {
        marked: boolean;
        dotColor: string;
        activeOpacity?: number;
    };
}

export default function CalendarScreen() {
    const [selectedDate, setSelectedDate] = useState('');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
    const [calendars, setCalendars] = useState<ExpoCalendar.Calendar[]>([]);

    useEffect(() => {
        initializeCalendar();
        checkGoogleSignInStatus();
    }, []);

    const initializeCalendar = async () => {
        try {
            // Request calendar permissions
            const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
            if (status === 'granted') {
                loadDeviceCalendars();
            } else {
                Alert.alert('Permission Needed', 'Calendar permission is required to show your events.');
            }
        } catch (error) {
            console.error('Calendar initialization error:', error);
        }
    };

    const checkGoogleSignInStatus = async () => {
        try {
            const userInfo = await GoogleSignin.getCurrentUser();
            setIsGoogleSignedIn(!!userInfo);
        } catch (error) {
            console.error('Google Sign-In status check failed:', error);
            setIsGoogleSignedIn(false);
        }
    };

    const loadDeviceCalendars = async () => {
        setIsLoading(true);
        try {
            const deviceCalendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
            setCalendars(deviceCalendars);

            // Load events from all calendars
            await loadEventsFromCalendars(deviceCalendars);
        } catch (error) {
            console.error('Error loading calendars:', error);
            Alert.alert('Error', 'Failed to load calendars');
        } finally {
            setIsLoading(false);
        }
    };

    const loadEventsFromCalendars = async (calendars: ExpoCalendar.Calendar[]) => {
        try {
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
            const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0); // End of next month

            let allEvents: CalendarEvent[] = [];
            const marked: MarkedDates = {};

            for (const calendar of calendars) {
                const calendarEvents = await ExpoCalendar.getEventsAsync(
                    [calendar.id],
                    startDate,
                    endDate
                );

                const formattedEvents: CalendarEvent[] = calendarEvents.map(event => ({
                    id: event.id,
                    title: event.title,
                    // Convert Date objects to ISO strings
                    startDate: event.startDate instanceof Date
                        ? event.startDate.toISOString()
                        : event.startDate,
                    endDate: event.endDate instanceof Date
                        ? event.endDate.toISOString()
                        : event.endDate,
                    allDay: event.allDay,
                    location: event.location || undefined, // Convert null to undefined
                    notes: event.notes,
                }));

                allEvents = [...allEvents, ...formattedEvents];

                // Mark dates with events
                formattedEvents.forEach(event => {
                    const dateKey = new Date(event.startDate).toISOString().split('T')[0];
                    marked[dateKey] = {
                        marked: true,
                        dotColor: calendar.color || '#007AFF',
                    };
                });
            }

            setEvents(allEvents);
            setMarkedDates(marked);
        } catch (error) {
            console.error('Error loading events:', error);
        }
    };


    const signInWithGoogle = async () => {
    try {
        console.log('Starting Google Sign-In...');
        setupGoogleSignIn();
        
        // Check Play Services first
        await GoogleSignin.hasPlayServices();
        
        console.log('Attempting Google sign-in...');
        const signInResult = await GoogleSignin.signIn();
        
        // Get user info separately
        const userInfo = await GoogleSignin.getCurrentUser();
        
        if (userInfo && userInfo.user) {
            console.log('Google Sign-In successful!');
            console.log('User:', userInfo.user.name, userInfo.user.email);
            
            setIsGoogleSignedIn(true);
            Alert.alert(
                'Success!', 
                `Connected to Google Calendar as ${userInfo.user.name}`
            );
        } else {
            throw new Error('Failed to get user information');
        }
        
    } catch (error: any) {
        console.error('Google Sign-In error:', error);
        
        if (error.code === 'SIGN_IN_CANCELLED') {
            Alert.alert('Cancelled', 'Google sign-in was cancelled');
        } else if (error.code === 'DEVELOPER_ERROR') {
            Alert.alert(
                'Setup Error', 
                'Google Sign-In configuration issue. Please check the setup.'
            );
        } else {
            Alert.alert('Error', `Failed to connect: ${error.message}`);
        }
    }
};
    // Make sure your Google setup includes calendar scope
    const setupGoogleSignIn = () => {
        GoogleSignin.configure({
            webClientId: '572824445032-o1aj7dn44e9pneh9henbiciufed6sl0n.apps.googleusercontent.com',
            scopes: [
                'profile',
                'email',
                'https://www.googleapis.com/auth/calendar.readonly'
            ],
            offlineAccess: true,
        });
    };

    const signOutGoogle = async () => {
        try {
            await GoogleSignin.signOut();
            setIsGoogleSignedIn(false);
            Alert.alert('Success', 'Google account disconnected');
        } catch (error) {
            console.error('Google Sign-Out error:', error);
        }
    };

    // ADD THIS NEW FUNCTION - This is the Google Calendar sync functionality
    const fetchGoogleCalendarEvents = async () => {
        try {
            // Get current user and tokens
            const userInfo = await GoogleSignin.getCurrentUser();
            if (!userInfo) {
                Alert.alert('Error', 'Not signed in to Google');
                return;
            }

            const tokens = await GoogleSignin.getTokens();
            setIsLoading(true);

            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
                `timeMin=${startDate.toISOString()}&` +
                `timeMax=${endDate.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime`,
                {
                    headers: {
                        Authorization: `Bearer ${tokens.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                const googleEvents: CalendarEvent[] = data.items.map((item: any) => ({
                    id: `google_${item.id}`, // Prefix to distinguish from device events
                    title: item.summary || 'Untitled Event',
                    startDate: item.start.dateTime || item.start.date,
                    endDate: item.end.dateTime || item.end.date,
                    allDay: !item.start.dateTime,
                    location: item.location,
                    notes: item.description,
                }));

                // Remove old Google events and add new ones
                setEvents(prevEvents => {
                    const deviceEvents = prevEvents.filter(event => !event.id.startsWith('google_'));
                    return [...deviceEvents, ...googleEvents];
                });

                // Update marked dates with Google events
                const newMarked: MarkedDates = {};
                googleEvents.forEach(event => {
                    const dateKey = new Date(event.startDate).toISOString().split('T')[0];
                    newMarked[dateKey] = {
                        marked: true,
                        dotColor: '#4285F4', // Google blue
                    };
                });

                setMarkedDates(prevMarked => {
                    // Keep device calendar markers, add Google markers
                    const deviceMarked = Object.fromEntries(
                        Object.entries(prevMarked).filter(([_, value]) => value.dotColor !== '#4285F4')
                    );
                    return { ...deviceMarked, ...newMarked };
                });

                Alert.alert('Success', `Imported ${googleEvents.length} events from Google Calendar`);
            } else {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
            }
        } catch (error: any) {
            console.error('Error fetching Google Calendar events:', error);

            if (error.message.includes('401') || error.message.includes('403')) {
                Alert.alert('Permission Error', 'Calendar access denied. Please reconnect your Google account.');
            } else {
                Alert.alert('Error', 'Failed to import Google Calendar events');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getEventsForDate = (date: string) => {
        return events.filter(event => {
            const eventDate = new Date(event.startDate).toISOString().split('T')[0];
            return eventDate === date;
        });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

    return (
        <ImageBackground
            source={require('../../assets/images/ImageBackground.jpg')}
            style={styles.container}
            imageStyle={{ opacity: 0.2 }}
            resizeMode="cover"
        >
            <Text style={styles.header}>Calendar</Text>

            {/* UPDATED Google Calendar Integration Section */}
            <View style={styles.googleSection}>
                <Text style={styles.sectionTitle}>Google Calendar</Text>
                {!isGoogleSignedIn ? (
                    <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle}>
                        <Text style={styles.googleButtonText}>Connect Google Calendar</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.connectedSection}>
                        <View style={styles.connectedInfo}>
                            <Text style={styles.connectedText}>✅ Google Calendar Connected</Text>
                        </View>
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={styles.syncButton}
                                onPress={fetchGoogleCalendarEvents}
                                disabled={isLoading}
                            >
                                <Text style={styles.syncButtonText}>
                                    {isLoading ? 'Importing...' : 'Import Events'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.disconnectButton} onPress={signOutGoogle}>
                                <Text style={styles.disconnectButtonText}>Disconnect</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Calendar Component */}
            <View style={styles.calendarContainer}>
                <Calendar
                    current={new Date().toISOString().split('T')[0]}
                    markedDates={{
                        ...markedDates,
                        ...(selectedDate && {
                            [selectedDate]: {
                                ...markedDates[selectedDate],
                                selected: true,
                                selectedColor: '#007AFF',
                            },
                        }),
                    }}
                    onDayPress={(day) => {
                        setSelectedDate(day.dateString);
                    }}
                    theme={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        calendarBackground: 'rgba(255, 255, 255, 0.9)',
                        textSectionTitleColor: '#b6c1cd',
                        selectedDayBackgroundColor: '#007AFF',
                        selectedDayTextColor: '#ffffff',
                        todayTextColor: '#007AFF',
                        dayTextColor: '#2d4150',
                        textDisabledColor: '#d9e1e8',
                        dotColor: '#00adf5',
                        selectedDotColor: '#ffffff',
                        arrowColor: '#007AFF',
                        monthTextColor: '#007AFF',
                        indicatorColor: '#007AFF',
                        textDayFontWeight: '500',
                        textMonthFontWeight: 'bold',
                        textDayHeaderFontWeight: '500',
                        textDayFontSize: 16,
                        textMonthFontSize: 18,
                        textDayHeaderFontSize: 14,
                    }}
                />
            </View>

            {/* Events for Selected Date */}
            <ScrollView style={styles.eventsContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.eventsHeader}>
                    {selectedDate
                        ? `Events for ${new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}`
                        : 'Select a date to view events'
                    }
                </Text>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>Loading events...</Text>
                    </View>
                ) : selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((event) => (
                        <View key={event.id} style={styles.eventCard}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            {!event.allDay && (
                                <Text style={styles.eventTime}>
                                    {formatTime(event.startDate)} - {formatTime(event.endDate)}
                                </Text>
                            )}
                            {event.location && (
                                <Text style={styles.eventLocation}>📍 {event.location}</Text>
                            )}
                            {event.notes && (
                                <Text style={styles.eventNotes}>{event.notes}</Text>
                            )}
                        </View>
                    ))
                ) : selectedDate ? (
                    <Text style={styles.noEventsText}>No events for this date</Text>
                ) : (
                    <Text style={styles.noEventsText}>Select a date to view events</Text>
                )}
            </ScrollView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 80,
        paddingHorizontal: 20,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    googleSection: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    googleButton: {
        backgroundColor: '#4285F4',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    googleButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    connectedSection: {
        // UPDATED - Removed flexDirection: 'row' to stack vertically
        justifyContent: 'space-between',
        alignItems: 'stretch',
    },
    // NEW STYLES ADDED
    connectedInfo: {
        marginBottom: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    syncButton: {
        backgroundColor: '#4285F4',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    syncButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    // END NEW STYLES
    connectedText: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: '600',
    },
    disconnectButton: {
        backgroundColor: '#FF3B30',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    disconnectButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    calendarContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 20,
    },
    eventsContainer: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 10,
        padding: 15,
        maxHeight: 300,
    },
    eventsHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
        textAlign: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    eventCard: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    eventTime: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    eventLocation: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    eventNotes: {
        fontSize: 14,
        color: '#888',
        fontStyle: 'italic',
    },
    noEventsText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#666',
        paddingVertical: 20,
        fontStyle: 'italic',
    },
});