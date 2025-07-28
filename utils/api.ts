// api.ts

const BASE_URL = 'http://10.0.2.2:5002/api/reminders'; // Android emulator URL. Replace if testing on physical device.

/** Reminder type definition */
export type Reminder = {
  _id: string;
  title: string;
  category: string;
  isActive: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
};

/** GET all reminders */
export const getReminders = async (): Promise<Reminder[]> => {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error('❌ Failed to fetch reminders');
  return await res.json();
};

/** POST a new reminder */
export const createReminder = async (data: {
  title: string;
  category: string;
  isActive?: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}): Promise<Reminder> => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error('❌ Failed to create reminder');
  return await res.json();
};

/** PUT to update reminder location */
export const updateReminderLocation = async (
  reminderId: string,
  location: { latitude: number; longitude: number }
): Promise<Reminder> => {
  const res = await fetch(`${BASE_URL}/${reminderId}/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`❌ Failed to update location: ${errText}`);
  }

  return await res.json();
};
