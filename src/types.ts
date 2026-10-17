export type SalonSettings = {
  id: boolean;
  salon_name: string;
  whatsapp_number: string;
  timezone: string;
  opening_time: string;
  closing_time: string;
  slot_duration_minutes: number;
  capacity_per_slot: number;
  working_days: number[];
  closed_dates: string[];
};
