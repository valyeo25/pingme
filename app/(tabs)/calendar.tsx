import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const EVENT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

const MemoizedTextInput = React.memo((props: any) => <TextInput {...props} />);

const EventModal = React.memo(({ visible, onClose, onSave, title, modalType, selectedDate }: {
    visible: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    title: string;
    modalType: 'add' | 'edit';
    selectedDate: string;
}) => {
    const [localTitle, setLocalTitle] = useState('');
    const [localTime, setLocalTime] = useState('');
    const [localDescription, setLocalDescription] = useState('');
    const [localColor, setLocalColor] = useState(EVENT_COLORS[0]);

    useEffect(() => {
        if (!visible) {
            setLocalTitle('');
            setLocalTime('');
            setLocalDescription('');
            setLocalColor(EVENT_COLORS[0]);
        }
    }, [visible]);

    const handleSave = useCallback(() => {
        onSave({
            title: localTitle,
            time: localTime,
            description: localDescription,
            color: localColor,
            date: selectedDate,
        });
    }, [localTitle, localTime, localDescription, localColor, onSave, selectedDate]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={handleSave}><Text style={styles.modalSaveText}>Save</Text></TouchableOpacity>
                </View>
                <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Event Title *</Text>
                        <MemoizedTextInput style={styles.textInput} value={localTitle} onChangeText={setLocalTitle} placeholder="Enter event title" placeholderTextColor="#999" autoCorrect={false} autoCapitalize="words" returnKeyType="next" blurOnSubmit={false} />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Time</Text>
                        <MemoizedTextInput style={styles.textInput} value={localTime} onChangeText={setLocalTime} placeholder="e.g. 2:00 PM or leave empty for all day" placeholderTextColor="#999" autoCorrect={false} autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <MemoizedTextInput style={[styles.textInput, styles.textArea]} value={localDescription} onChangeText={setLocalDescription} placeholder="Enter event description (optional)" placeholderTextColor="#999" multiline numberOfLines={3} autoCorrect autoCapitalize="sentences" returnKeyType="done" textAlignVertical="top" />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Color</Text>
                        <View style={styles.colorPicker}>
                            {EVENT_COLORS.map(color => (
                                <TouchableOpacity key={color} style={[styles.colorOption, { backgroundColor: color }, localColor === color && styles.selectedColor]} onPress={() => setLocalColor(color)} />
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
});

function CalendarScreen() {
    const renderCount = useRef(0);
    renderCount.current += 1;

    const [selectedDate, setSelectedDate] = useState('');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [eventsLoaded, setEventsLoaded] = useState(false);

    useEffect(() => {
        if (!eventsLoaded) loadEvents();
    }, [eventsLoaded]);

    const loadEvents = async () => {
        try {
            const storedEvents = await AsyncStorage.getItem('calendar_events');
            if (storedEvents) setEvents(JSON.parse(storedEvents));
            setEventsLoaded(true);
        } catch (error) {
            console.error('Error loading events:', error);
            setEventsLoaded(true);
        }
    };

    const saveEvents = useCallback(async (newEvents: CalendarEvent[]) => {
        try {
            await AsyncStorage.setItem('calendar_events', JSON.stringify(newEvents));
            setEvents(newEvents);
        } catch (error) {
            console.error('Error saving events:', error);
            Alert.alert('Error', 'Failed to save event');
        }
    }, []);

    const generateId = useCallback(() => Date.now().toString() + Math.random().toString(36).substr(2, 9), []);

    const openAddModal = useCallback(() => {
        if (!selectedDate) return Alert.alert('Select Date', 'Please select a date first');
        setIsAddModalVisible(true);
    }, [selectedDate]);

    const openEditModal = useCallback((event: CalendarEvent) => {
        setEditingEvent(event);
        setIsEditModalVisible(true);
    }, []);

    const closeModals = useCallback(() => {
        setIsAddModalVisible(false);
        setIsEditModalVisible(false);
        setEditingEvent(null);
    }, []);

    const addEvent = useCallback(async (formData: any) => {
        if (!formData.title.trim()) return Alert.alert('Missing Title', 'Please enter an event title');
        const newEvent: CalendarEvent = {
            id: generateId(),
            title: formData.title.trim(),
            date: formData.date,
            time: formData.time.trim() || 'All Day',
            description: formData.description.trim(),
            color: formData.color,
        };
        await saveEvents([...events, newEvent]);
        closeModals();
        Alert.alert('Success', 'Event added successfully!');
    }, [events, generateId, saveEvents, closeModals]);

    const updateEvent = useCallback(async (formData: any) => {
        if (!formData.title.trim() || !editingEvent) return Alert.alert('Missing Title', 'Please enter an event title');
        const updatedEvent = { ...editingEvent, ...formData, time: formData.time.trim() || 'All Day' };
        await saveEvents(events.map(e => e.id === editingEvent.id ? updatedEvent : e));
        closeModals();
        Alert.alert('Success', 'Event updated successfully!');
    }, [editingEvent, events, saveEvents, closeModals]);

    const deleteEvent = useCallback((eventId: string) => {
        Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await saveEvents(events.filter(e => e.id !== eventId));
                    Alert.alert('Success', 'Event deleted successfully!');
                }
            }
        ]);
    }, [events, saveEvents]);

    const markedDates = useMemo(() => {
        const marked: MarkedDates = {};
        events.forEach(event => {
            marked[event.date] = { marked: true, dotColor: event.color };
        });
        return marked;
    }, [events]);

    const calendarMarkedDates = useMemo(() => ({
        ...markedDates,
        ...(selectedDate && {
            [selectedDate]: {
                ...markedDates[selectedDate],
                selected: true,
                selectedColor: '#007AFF',
            },
        })
    }), [markedDates, selectedDate]);

    const selectedDateEvents = useMemo(() => selectedDate ? events.filter(e => e.date === selectedDate) : [], [events, selectedDate]);

    return (
        <ImageBackground source={require('../../assets/images/ImageBackground.jpg')} style={styles.container} imageStyle={{ opacity: 0.2 }} resizeMode="cover">
            <Text style={styles.header}>My Calendar</Text>
            <View style={styles.statsSection}>
                <Text style={styles.statsText}>📅 {events.length} events total</Text>
                {selectedDate && <TouchableOpacity style={styles.addButton} onPress={openAddModal}><Text style={styles.addButtonText}>+ Add Event</Text></TouchableOpacity>}
            </View>
            <View style={styles.calendarContainer}>
                <Calendar current={new Date().toISOString().split('T')[0]} markedDates={calendarMarkedDates} onDayPress={day => setSelectedDate(day.dateString)} theme={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', calendarBackground: 'rgba(255, 255, 255, 0.9)', textSectionTitleColor: '#b6c1cd', selectedDayBackgroundColor: '#007AFF', selectedDayTextColor: '#ffffff', todayTextColor: '#007AFF', dayTextColor: '#2d4150', textDisabledColor: '#d9e1e8', dotColor: '#00adf5', selectedDotColor: '#ffffff', arrowColor: '#007AFF', monthTextColor: '#007AFF', indicatorColor: '#007AFF', textDayFontWeight: '500', textMonthFontWeight: 'bold', textDayHeaderFontWeight: '500', textDayFontSize: 16, textMonthFontSize: 18, textDayHeaderFontSize: 14 }} />
            </View>
            <ScrollView style={styles.eventsContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.eventsHeader}>{selectedDate ? `Events for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}` : 'Select a date to view events'}</Text>
                {selectedDateEvents.length > 0 ? selectedDateEvents.map(event => (
                    <TouchableOpacity key={event.id} style={[styles.eventCard, { borderLeftColor: event.color }]} onPress={() => openEditModal(event)}>
                        <View style={styles.eventContent}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            <Text style={styles.eventTime}>{event.time}</Text>
                            {event.description && <Text style={styles.eventDescription}>{event.description}</Text>}
                        </View>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => deleteEvent(event.id)}>
                            <Text style={styles.deleteButtonText}>×</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                )) : selectedDate ? (
                    <View style={styles.noEventsContainer}>
                        <Text style={styles.noEventsText}>No events for this date</Text>
                        <TouchableOpacity style={styles.addEventButton} onPress={openAddModal}>
                            <Text style={styles.addEventButtonText}>+ Add Your First Event</Text>
                        </TouchableOpacity>
                    </View>
                ) : <Text style={styles.noEventsText}>Select a date to view or add events</Text>}
            </ScrollView>
            <EventModal visible={isAddModalVisible} onClose={closeModals} onSave={addEvent} title="Add New Event" modalType="add" selectedDate={selectedDate} />
            <EventModal visible={isEditModalVisible} onClose={closeModals} onSave={updateEvent} title="Edit Event" modalType="edit" selectedDate={selectedDate} />
        </ImageBackground>
    );
}

export default React.memo(CalendarScreen);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 50,
        paddingHorizontal: 10,
    },
    header: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    statsSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    statsText: {
        fontSize: 16,
        color: '#444',
    },
    addButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    calendarContainer: {
        marginBottom: 10,
        borderRadius: 8,
        overflow: 'hidden',
    },
    eventsContainer: {
        flex: 1,
        paddingTop: 10,
    },
    eventsHeader: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
    },
    eventCard: {
        backgroundColor: '#fff',
        borderLeftWidth: 6,
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    eventContent: {
        flex: 1,
        paddingRight: 10,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    eventTime: {
        fontSize: 14,
        color: '#555',
        marginBottom: 4,
    },
    eventDescription: {
        fontSize: 14,
        color: '#666',
    },
    deleteButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    deleteButtonText: {
        fontSize: 18,
        color: '#ff3b30',
        fontWeight: 'bold',
    },
    noEventsContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    noEventsText: {
        fontSize: 16,
        color: '#888',
        marginBottom: 10,
    },
    addEventButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    addEventButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#f9f9f9',
        paddingTop: 60,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalCancelText: {
        fontSize: 16,
        color: '#888',
    },
    modalSaveText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
    modalContent: {
        paddingHorizontal: 20,
    },
    inputGroup: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 6,
    },
    textInput: {
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 6,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    textArea: {
        height: 80,
    },
    colorPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    colorOption: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedColor: {
        borderColor: '#000',
    },
});
