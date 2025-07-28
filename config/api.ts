// api.ts

const BASE = "http://10.0.2.2:5002/api/reminders";
const WEATHER_BASE = "http://10.0.2.2:5002/api/weather"

export const API_ENDPOINTS = {
  REMINDERS: BASE,
  REMINDER_BY_ID: (id: string): string => `${BASE}/${id}`,

  WEATHER_FOR_AREA: (area: string): string => `${WEATHER_BASE}/${area}`,
  CHECK_EVENT_WEATHER: `${WEATHER_BASE}/check-event`,
  WEATHER_PROCESS_BATCH: `${WEATHER_BASE}/reminders-batch`
} as const;

// Debug logging
console.log('🔗 API Configuration:');
console.log('   Reminders endpoint:', API_ENDPOINTS.REMINDERS);
console.log('   Weather endpoint:', WEATHER_BASE);