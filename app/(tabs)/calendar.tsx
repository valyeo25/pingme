import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GeminiService, { ReminderSuggestion } from '../../services/geminiService';
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
    ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';

const geminiService = new GeminiService();

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

// AI Suggestions Modal Component
const ReminderSuggestionsModal = React.memo(({ visible, onClose, suggestions, onCreateReminder, isLoading }: {
    visible: boolean;
    onClose: () => void;
    suggestions: ReminderSuggestion[];
    onCreateReminder: (suggestion: ReminderSuggestion) => void;
    isLoading: boolean;
}) => {
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return '#FF4444';
            case 'medium': return '#FFA500';
            case 'low': return '#4CAF50';
            default: return '#999';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Work': return '💼';
            case 'Travel': return '✈️';
            case 'Personal': return '👤';
            default: return '📝';
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.suggestionsModalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.modalCancelText}>Close</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>🤖 AI Reminder Suggestions</Text>
                    <View style={{ width: 50 }} />
                </View>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>AI is analyzing your calendar...</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.suggestionsContent}>
                        {suggestions.length > 0 ? (
                            <>
                                <Text style={styles.suggestionsHeader}>
                                    Here are some helpful reminders:
                                </Text>
                                {suggestions.map((suggestion) => (
                                    <View key={suggestion.id} style={styles.suggestionCard}>
                                        <View style={styles.suggestionHeader}>
                                            <View style={styles.suggestionTitleRow}>
                                                <Text style={styles.categoryIcon}>
                                                    {getCategoryIcon(suggestion.category)}
                                                </Text>
                                                <Text style={styles.suggestionTitle}>
                                                    {suggestion.title}
                                                </Text>
                                                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(suggestion.priority) }]}>
                                                    <Text style={styles.priorityText}>{suggestion.priority.toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            {suggestion.isOutdoor && (
                                                <Text style={styles.outdoorBadge}>🌳 Outdoor</Text>
                                            )}
                                        </View>
                                        
                                        <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                                        
                                        {suggestion.relatedEvent && (
                                            <Text style={styles.relatedEvent}>
                                                📅 Related to: {suggestion.relatedEvent}
                                            </Text>
                                        )}
                                        
                                        {suggestion.suggestedDate && (
                                            <Text style={styles.suggestedDate}>
                                                🗓️ Suggested for: {new Date(suggestion.suggestedDate).toLocaleDateString()}
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </>
                        ) : (
                            <View style={styles.noSuggestionsContainer}>
                                <Text style={styles.noSuggestionsText}>
                                    🤔 No new suggestions at the moment. Add more calendar events to get personalized reminders!
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                )}
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
    
    // AI Suggestions State
    const [isSuggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
    const [reminderSuggestions, setReminderSuggestions] = useState<ReminderSuggestion[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

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

    // AI Suggestions Functions
    const generateAISuggestions = useCallback(async () => {
        if (events.length === 0) {
            Alert.alert('No Events', 'Add some calendar events first to get AI suggestions!');
            return;
        }

        setIsGeneratingSuggestions(true);
        setSuggestionsModalVisible(true);

        try {
            // You could also load existing reminders here to avoid duplicates
            const suggestions = await geminiService.generateReminderSuggestions(events);
            setReminderSuggestions(suggestions);
        } catch (error) {
            console.error('Error generating suggestions:', error);
            Alert.alert('Error', 'Failed to generate AI suggestions. Please try again.');
            setReminderSuggestions([]);
        } finally {
            setIsGeneratingSuggestions(false);
        }
    }, [events]);

    const createReminderFromSuggestion = useCallback(async (suggestion: ReminderSuggestion) => {
        try {
            const newReminder = {
                title: suggestion.title,
                category: suggestion.category,
                isOutdoor: suggestion.isOutdoor,
                isActive: true,
                aiGenerated: true,
                reason: suggestion.reason,
                priority: suggestion.priority,
                relatedEvent: suggestion.relatedEvent,
                suggestedDate: suggestion.suggestedDate
            };

            console.log('🔄 Sending reminder to backend:', newReminder);

            const response = await fetch('http://10.0.2.2:5002/api/reminders', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newReminder),
            });

            console.log('📡 Response status:', response.status);

            if (response.ok) {
                const savedReminder = await response.json();
                console.log('✅ Saved reminder:', savedReminder);
                
                Alert.alert(
                    'Reminder Created! 🎉', 
                    `"${suggestion.title}" has been added to your ${suggestion.category} reminders.`,
                    [
                        { text: 'Great!', style: 'default' }
                    ]
                );
                
                setReminderSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
            } else {
                const errorText = await response.text();
                console.error('❌ Backend error:', errorText);
                throw new Error('Failed to save reminder');
            }
            
        } catch (error: any) {
            console.error('❌ Error creating reminder:', error);
            Alert.alert('Error', 'Failed to create reminder. Please try again.');
        }
    }, []);


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
            <View style={styles.headerContainer}>
                <Text style={styles.header}>My Calendar</Text>
                <TouchableOpacity 
                    style={styles.aiButton}
                    onPress={generateAISuggestions}
                    disabled={events.length === 0}
                >
                    <Text style={styles.aiButtonText}>🤖 AI Suggestions</Text>
                </TouchableOpacity>
            </View>
            
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
            
            <ReminderSuggestionsModal 
                visible={isSuggestionsModalVisible}
                onClose={() => setSuggestionsModalVisible(false)}
                suggestions={reminderSuggestions}
                onCreateReminder={createReminderFromSuggestion}
                isLoading={isGeneratingSuggestions}
            />
        </ImageBackground>
    );
}

export default React.memo(CalendarScreen);

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
    aiButton: {
        backgroundColor: '#e3718bff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    aiButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    statsSection: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 15,
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    statsText: {
        fontSize: 16,
        color: '#333',
        fontWeight: "600",
    },
    addButton: {
        backgroundColor: "#3b8ee7ff",
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    addButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    calendarContainer: {
        backgroundColor: '#ffffff',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 15,
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
    eventsContainer: {
        flex: 1,
        paddingHorizontal: 15,
        paddingBottom: 20,
    },
    eventsHeader: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 15,
        textAlign: 'center',
    },
    eventCard: {
        backgroundColor: '#ffffff',
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
        borderLeftWidth: 6,
    },
    eventContent: {
        flex: 1,
        paddingRight: 10,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: "500",
        color: "#333",
        marginBottom: 4,
    },
    eventTime: {
        fontSize: 12,
        color: "#666",
        marginBottom: 4,
    },
    eventDescription: {
        fontSize: 12,
        color: "#666",
        marginBottom: 4,
    },
    deleteButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: "rgba(255, 59, 48, 0.1)",
        minWidth: 40,
        alignItems: "center",
    },
    deleteButtonText: {
        fontSize: 16,
        color: '#FF3B30',
        fontWeight: 'bold',
    },
    noEventsContainer: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: 20,
    },
    noEventsText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 24,
    },
    addEventButton: {
        backgroundColor: "#3b8ee7ff",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        minWidth: 200,
        alignItems: 'center',
    },
    addEventButtonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
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
        color: "#333",
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
        fontSize: 16,
        fontWeight: "500",
        marginBottom: 10,
        color: "#333",
    },
    textInput: {
        width: "100%",
        padding: 12,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        fontSize: 16,
        backgroundColor: '#fff',
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
        marginHorizontal: 5,
        borderWidth: 2,
        borderColor: "transparent",
    },
    selectedColor: {
        borderColor: "#000",
        borderWidth: 3,
    },
    
    // Category Selection Modal Styles
    categoryModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryModalContainer: {
        backgroundColor: '#fff',
        borderRadius: 15,
        width: '85%',
        maxHeight: '70%',
        paddingVertical: 25,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    categoryModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 15,
    },
    categoryModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    categoryList: {
        paddingHorizontal: 10,
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 15,
        marginHorizontal: 10,
        marginVertical: 2,
        borderRadius: 12,
        backgroundColor: '#f8f9fa',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    selectedCategoryItem: {
        backgroundColor: '#e3f2fd',
        borderWidth: 2,
        borderColor: '#2196F3',
    },
    categoryIcon: {
        fontSize: 20,
        marginRight: 12,
        width: 24,
        textAlign: 'center',
    },
    categoryLabel: {
        fontSize: 16,
        color: '#333',
        flex: 1,
        fontWeight: '500',
    },
    selectedCategoryLabel: {
        color: '#2196F3',
        fontWeight: 'bold',
    },
    checkmark: {
        fontSize: 18,
        color: '#2196F3',
        fontWeight: 'bold',
    },
    
    // AI Suggestions Modal Styles
    suggestionsModalContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: 60,
    },
    viewRemindersText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
    suggestionsContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    suggestionsHeader: {
        fontSize: 16,
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 24,
    },
    suggestionCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    suggestionHeader: {
        marginBottom: 12,
    },
    suggestionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    suggestionTitle: {
        fontSize: 16,
        fontWeight: "500",
        color: "#333",
        flex: 1,
    },
    priorityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    priorityText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    outdoorBadge: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '500',
    },
    suggestionReason: {
        fontSize: 12,
        color: "#666",
        fontStyle: "italic",
        marginBottom: 8,
        lineHeight: 16,
    },
    relatedEvent: {
        fontSize: 12,
        color: '#007AFF',
        marginBottom: 4,
    },
    suggestedDate: {
        fontSize: 12,
        color: '#FF9500',
        marginBottom: 12,
    },
    createReminderButton: {
        backgroundColor: "#007AFF",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    createReminderText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    bottomActions: {
        marginTop: 20,
        marginBottom: 30,
        alignItems: 'center',
    },
    viewAllRemindersButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        minWidth: 200,
        alignItems: 'center',
    },
    viewAllRemindersText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    noSuggestionsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    noSuggestionsText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
});