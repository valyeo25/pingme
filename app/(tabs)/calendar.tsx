import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
    Alert,
    ImageBackground,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';

// Types
interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    description?: string;
    color: string;
}

interface MarkedDates {
    [date: string]: {
        marked: boolean;
        dotColor: string;
        selected?: boolean;
        selectedColor?: string;
    };
}

const EVENT_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Light Yellow
];

export default function CalendarScreen() {
    const [selectedDate, setSelectedDate] = useState('');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    
    // Form states
    const [eventTitle, setEventTitle] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [selectedColor, setSelectedColor] = useState(EVENT_COLORS[0]);

    useEffect(() => {
        loadEvents();
    }, []);

    useEffect(() => {
        updateMarkedDates();
    }, [events]);

    const loadEvents = async () => {
        try {
            const storedEvents = await AsyncStorage.getItem('calendar_events');
            if (storedEvents) {
                const parsedEvents = JSON.parse(storedEvents);
                setEvents(parsedEvents);
            }
        } catch (error) {
            console.error('Error loading events:', error);
        }
    };

    const saveEvents = async (newEvents: CalendarEvent[]) => {
        try {
            await AsyncStorage.setItem('calendar_events', JSON.stringify(newEvents));
            setEvents(newEvents);
        } catch (error) {
            console.error('Error saving events:', error);
            Alert.alert('Error', 'Failed to save event');
        }
    };

    const updateMarkedDates = () => {
        const marked: MarkedDates = {};
        events.forEach(event => {
            marked[event.date] = {
                marked: true,
                dotColor: event.color,
            };
        });
        setMarkedDates(marked);
    };

    const generateId = () => {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    };

    const resetForm = () => {
        setEventTitle('');
        setEventTime('');
        setEventDescription('');
        setSelectedColor(EVENT_COLORS[0]);
    };

    const openAddModal = () => {
        if (!selectedDate) {
            Alert.alert('Select Date', 'Please select a date first');
            return;
        }
        resetForm();
        setIsAddModalVisible(true);
    };

    const openEditModal = (event: CalendarEvent) => {
        setEditingEvent(event);
        setEventTitle(event.title);
        setEventTime(event.time);
        setEventDescription(event.description || '');
        setSelectedColor(event.color);
        setIsEditModalVisible(true);
    };

    const closeModals = () => {
        setIsAddModalVisible(false);
        setIsEditModalVisible(false);
        setEditingEvent(null);
        resetForm();
    };

    const addEvent = async () => {
        if (!eventTitle.trim()) {
            Alert.alert('Missing Title', 'Please enter an event title');
            return;
        }

        const newEvent: CalendarEvent = {
            id: generateId(),
            title: eventTitle.trim(),
            date: selectedDate,
            time: eventTime.trim() || 'All Day',
            description: eventDescription.trim(),
            color: selectedColor,
        };

        const updatedEvents = [...events, newEvent];
        await saveEvents(updatedEvents);
        closeModals();
        Alert.alert('Success', 'Event added successfully!');
    };

    const updateEvent = async () => {
        if (!eventTitle.trim() || !editingEvent) {
            Alert.alert('Missing Title', 'Please enter an event title');
            return;
        }

        const updatedEvent: CalendarEvent = {
            ...editingEvent,
            title: eventTitle.trim(),
            time: eventTime.trim() || 'All Day',
            description: eventDescription.trim(),
            color: selectedColor,
        };

        const updatedEvents = events.map(event => 
            event.id === editingEvent.id ? updatedEvent : event
        );
        
        await saveEvents(updatedEvents);
        closeModals();
        Alert.alert('Success', 'Event updated successfully!');
    };

    const deleteEvent = async (eventId: string) => {
        Alert.alert(
            'Delete Event',
            'Are you sure you want to delete this event?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const updatedEvents = events.filter(event => event.id !== eventId);
                        await saveEvents(updatedEvents);
                        Alert.alert('Success', 'Event deleted successfully!');
                    },
                },
            ]
        );
    };

    const getEventsForDate = (date: string) => {
        return events.filter(event => event.date === date);
    };

    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

    const EventModal = ({ visible, onClose, onSave, title }: {
        visible: boolean;
        onClose: () => void;
        onSave: () => void;
        title: string;
    }) => (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={onSave}>
                        <Text style={styles.modalSaveText}>Save</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Event Title *</Text>
                        <TextInput
                            style={styles.textInput}
                            value={eventTitle}
                            onChangeText={setEventTitle}
                            placeholder="Enter event title"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Time</Text>
                        <TextInput
                            style={styles.textInput}
                            value={eventTime}
                            onChangeText={setEventTime}
                            placeholder="e.g. 2:00 PM or leave empty for all day"
                            placeholderTextColor="#999"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            value={eventDescription}
                            onChangeText={setEventDescription}
                            placeholder="Enter event description (optional)"
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Color</Text>
                        <View style={styles.colorPicker}>
                            {EVENT_COLORS.map(color => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && styles.selectedColor
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                />
                            ))}
                        </View>
                    </View>

                    {selectedDate && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Date</Text>
                            <Text style={styles.dateText}>
                                {new Date(selectedDate).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );

    return (
        <ImageBackground
            source={require('../../assets/images/ImageBackground.jpg')}
            style={styles.container}
            imageStyle={{ opacity: 0.2 }}
            resizeMode="cover"
        >
            <Text style={styles.header}>My Calendar</Text>

            {/* Calendar Stats */}
            <View style={styles.statsSection}>
                <Text style={styles.statsText}>
                    📅 {events.length} events total
                </Text>
                {selectedDate && (
                    <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                        <Text style={styles.addButtonText}>+ Add Event</Text>
                    </TouchableOpacity>
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
                            month: 'short',
                            day: 'numeric'
                        })}`
                        : 'Select a date to view events'
                    }
                </Text>

                {selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            style={[styles.eventCard, { borderLeftColor: event.color }]}
                            onPress={() => openEditModal(event)}
                        >
                            <View style={styles.eventContent}>
                                <Text style={styles.eventTitle}>{event.title}</Text>
                                <Text style={styles.eventTime}>{event.time}</Text>
                                {event.description && (
                                    <Text style={styles.eventDescription}>{event.description}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => deleteEvent(event.id)}
                            >
                                <Text style={styles.deleteButtonText}>×</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                ) : selectedDate ? (
                    <View style={styles.noEventsContainer}>
                        <Text style={styles.noEventsText}>No events for this date</Text>
                        <TouchableOpacity style={styles.addEventButton} onPress={openAddModal}>
                            <Text style={styles.addEventButtonText}>+ Add Your First Event</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={styles.noEventsText}>Select a date to view or add events</Text>
                )}
            </ScrollView>

            {/* Add Event Modal */}
            <EventModal
                visible={isAddModalVisible}
                onClose={closeModals}
                onSave={addEvent}
                title="Add New Event"
            />

            {/* Edit Event Modal */}
            <EventModal
                visible={isEditModalVisible}
                onClose={closeModals}
                onSave={updateEvent}
                title="Edit Event"
            />
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
    statsSection: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statsText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    addButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
    },
    addButtonText: {
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
        maxHeight: 280,
    },
    eventsHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
        textAlign: 'center',
    },
    eventCard: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    eventContent: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 3,
    },
    eventTime: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    eventDescription: {
        fontSize: 14,
        color: '#888',
        fontStyle: 'italic',
    },
    deleteButton: {
        backgroundColor: '#FF4444',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    deleteButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    noEventsContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    noEventsText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#666',
        marginBottom: 15,
        fontStyle: 'italic',
    },
    addEventButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    addEventButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingTop: 60,
    },
    modalCancelText: {
        color: '#FF4444',
        fontSize: 16,
        fontWeight: '600',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalSaveText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    colorPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    selectedColor: {
        borderColor: '#333',
    },
    dateText: {
        fontSize: 16,
        color: '#666',
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderRadius: 8,
    },
});