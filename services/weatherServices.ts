import axios from 'axios';
import { API_ENDPOINTS } from '../config/api'; // adjust import path if needed

export interface WeatherData {
  area: string;
  forecast: string;
  timestamp: string;
  cached_at: string;
  warning: boolean;
  recommendation: string;
  icon: string;
}

export interface Event {
  title: string;
  location: string;
  isOutdoor: boolean;
}

export interface CheckEventWeatherResponse {
  needsWeather: boolean;
  event?: Event;
  weather?: WeatherData;
  alert?: string | null;
  message: string;
  error?: string;
}

const weatherService = {
  async getWeatherForArea(area: string): Promise<{ success: boolean; data?: WeatherData; error?: any }> {
    try {
      const response = await axios.get<WeatherData>(API_ENDPOINTS.WEATHER_FOR_AREA(area));
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ getWeatherForArea error:', error?.response?.data || error.message);
      return { success: false, error: error?.response?.data || error.message };
    }
  },

  async checkEventWeather(event: Event): Promise<{ success: boolean; data?: CheckEventWeatherResponse; error?: any }> {
    try {
      const response = await axios.post<CheckEventWeatherResponse>(API_ENDPOINTS.CHECK_EVENT_WEATHER, event);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ checkEventWeather error:', error?.response?.data || error.message);
      return { success: false, error: error?.response?.data || error.message };
    }
  },

  async getAllAreas(): Promise<{ success: boolean; data?: string[]; error?: any }> {
    try {
      interface AreasResponse {
        success: boolean;
        areas: string[];
        count: number;
      }
      const response = await axios.get<AreasResponse>(`${API_ENDPOINTS.CHECK_EVENT_WEATHER}/../areas/list`);
      return { success: true, data: response.data.areas };
    } catch (error: any) {
      console.error('❌ getAllAreas error:', error?.response?.data || error.message);
      return { success: false, error: error?.response?.data || error.message };
    }
  },

  async processRemindersBatch(reminders: Event[]): Promise<{ success: boolean; data?: any[]; error?: any }> {
    try {
        interface RemindersBatchResponse {
        success: boolean;
        reminders: any[];
        }
        const response = await axios.post<RemindersBatchResponse>(
        API_ENDPOINTS.WEATHER_PROCESS_BATCH,
        { reminders }
        );
        return { success: true, data: response.data.reminders };
    } catch (error: any) {
        console.error('❌ processRemindersBatch error:', error?.response?.data || error.message);
        return { success: false, error: error?.response?.data || error.message };
    }
  }

};

export default weatherService;
