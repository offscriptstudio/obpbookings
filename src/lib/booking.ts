import { format, parseISO } from 'date-fns';

export const PURPOSES = ['Karwa Chauth', 'Haircut & styling', 'Hair spa', 'Facial & skincare', 'Bridal makeup', 'Makeup & hairstyling', 'Nail services', 'Other'];
export const DEFAULT_SLOTS = Array.from({ length: 12 }, (_, index) => {
  const hour = index + 9;
  const next = hour + 1;
  const label = (value: number) => `${value > 12 ? value - 12 : value}:00 ${value >= 12 ? 'PM' : 'AM'}`;
  return { start_time: `${String(hour).padStart(2, '0')}:00:00`, end_time: `${String(next).padStart(2, '0')}:00:00`, label: `${label(hour)} – ${label(next)}` };
});

export type Booking = {
  id: string;
  booking_reference: string;
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  additional_notes: string | null;
  status: 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
};

export type Availability = { start_time: string; end_time: string; booked_count: number; capacity: number };

export function formatDate(date: string) {
  return format(parseISO(date), 'd MMMM yyyy');
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function bookingMessage(booking: Booking) {
  return `Hello Organic by Pooja,\n\nA new salon appointment has been booked.\n\nBooking ID: ${booking.booking_reference}\nCustomer Name: ${booking.customer_name}\nPhone Number: ${booking.customer_phone}\nAppointment Date: ${formatDate(booking.appointment_date)}\nTime Slot: ${formatTime(booking.start_time)} to ${formatTime(booking.end_time)}\nPurpose: ${booking.purpose}\n\nPlease confirm that you have received these booking details.\n\nThank you.`;
}

export function whatsappUrl(booking: Booking) {
  return `https://wa.me/919102163439?text=${encodeURIComponent(bookingMessage(booking))}`;
}
