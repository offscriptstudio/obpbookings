import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Copy, ExternalLink, FileText, LayoutDashboard, LogOut, Menu, Pencil, Plus, QrCode, Search, Settings, Sparkles, Users, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { bookingErrorMessage, bookingMessage, Booking, DEFAULT_SLOTS, formatDate, formatTime, PURPOSES, reminderWhatsappUrl, whatsappUrl } from '@/lib/booking';
import { isDemoMode, supabase } from '@/lib/supabase';
import type { SalonSettings } from '@/types';

const defaultSettings: SalonSettings = { id: true, salon_name: 'Organic by Pooja', whatsapp_number: '+91 9102163439', timezone: 'Asia/Kolkata', opening_time: '09:00', closing_time: '21:00', slot_duration_minutes: 60, capacity_per_slot: 2, working_days: [1, 2, 3, 4, 5, 6], closed_dates: [] };
const bookingSchema = z.object({ customer_name: z.string().min(2, 'Please enter your full name'), customer_phone: z.string().regex(/^\+91[6-9][0-9]{9}$/, 'Use a valid 10-digit Indian mobile number'), appointment_date: z.string().min(1, 'Choose a date'), start_time: z.string().min(1, 'Choose a time'), purpose: z.string().min(2, 'Choose a purpose'), additional_notes: z.string().max(1000).optional() });
type BookingForm = z.infer<typeof bookingSchema>;

function App() { return <BrowserRouter><Routes><Route path="/" element={<BookingPage />} /><Route path="/booking/success" element={<SuccessPage />} /><Route path="/admin/login" element={<LoginPage />} /><Route path="/admin/*" element={<ProtectedAdmin><AdminApp /></ProtectedAdmin>} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>; }

function Shell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return <div className="min-h-screen bg-[#f8f5ef] text-[#2c2925]"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-10"><Link to="/" className="flex items-center gap-3"><img src="/organic-by-pooja-logo.png" alt="Organic by Pooja" className="h-10 w-10 rounded-full object-cover" /><span><span className="block font-serif text-xl leading-none tracking-tight">Organic by Pooja</span><span className="mt-1 block text-[10px] uppercase tracking-[.28em] text-[#9a8067]">Beauty · Wellness · Care</span></span></Link>{!compact && <Link to="/admin/login" className="hidden text-sm font-medium text-[#6f6257] transition hover:text-[#a98b6e] sm:block">Admin login <ArrowRight className="ml-1 inline" size={15} /></Link>}</header>{children}</div>;
}

function BookingPage() {
  const [settings] = useState(defaultSettings); const [availability, setAvailability] = useState<Record<string, { booked_count: number; capacity: number }>>({}); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [step, setStep] = useState(1); const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<BookingForm>({ resolver: zodResolver(bookingSchema), defaultValues: { customer_phone: '', purpose: '' } });
  const date = watch('appointment_date'); const selectedTime = watch('start_time'); const purpose = watch('purpose');
  useEffect(() => {
    setValue('start_time', '');
    setAvailability({});
    setError('');
    if (!date) return;
    setLoading(true);
    if (supabase) {
      void (async () => {
        try {
          const { data, error: queryError } = await supabase.rpc('get_slot_availability', { p_date: date });
          if (queryError) {
            setError(bookingErrorMessage(queryError.message));
            setAvailability({});
          } else {
            setAvailability(Object.fromEntries((data ?? []).map((slot: { start_time: string; booked_count: number; capacity: number }) => [slot.start_time, { booked_count: slot.booked_count, capacity: slot.capacity }])));
          }
        } catch {
          setError('We could not check availability. Please try again.');
        } finally {
          setLoading(false);
        }
      })();
    } else {
      const local: Booking[] = JSON.parse(localStorage.getItem('organic-bookings') ?? '[]');
      setAvailability(Object.fromEntries(DEFAULT_SLOTS.map(slot => [slot.start_time, { booked_count: local.filter(item => item.appointment_date === date && item.start_time === slot.start_time && item.status !== 'cancelled').length, capacity: 2 }])));
      setLoading(false);
    }
  }, [date, setValue]);
  const onSubmit = async (values: BookingForm) => {
    setError('');
    setLoading(true);
    try {
      if (supabase) {
        const { data, error: bookingError } = await supabase.rpc('create_public_booking', {
          p_customer_name: values.customer_name,
          p_customer_phone: values.customer_phone,
          p_appointment_date: values.appointment_date,
          p_start_time: values.start_time,
          p_purpose: values.purpose,
          p_additional_notes: values.additional_notes ?? null,
        });
        if (bookingError || !data) {
          setError(bookingErrorMessage(bookingError?.message ?? ''));
          return;
        }
        navigate('/booking/success', { state: { booking: data } });
        return;
      }
      const booking: Booking = {
        id: crypto.randomUUID(),
        booking_reference: 'OP' + Math.random().toString(36).slice(2, 10).toUpperCase(),
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        appointment_date: values.appointment_date,
        start_time: values.start_time,
        end_time: String(Number(values.start_time.slice(0, 2)) + 1).padStart(2, '0') + ':00:00',
        purpose: values.purpose,
        additional_notes: values.additional_notes ?? null,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('organic-bookings', JSON.stringify([...JSON.parse(localStorage.getItem('organic-bookings') ?? '[]'), booking]));
      navigate('/booking/success', { state: { booking } });
    } catch {
      setError('We could not reach the booking service. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const minDate = format(new Date(), 'yyyy-MM-dd');
  return <Shell><main className="mx-auto grid max-w-6xl gap-6 px-5 pb-10 pt-2 md:gap-12 md:grid-cols-[1fr_1.12fr] md:items-center md:px-10 md:pb-16 md:pt-10"><section className="md:pb-10"><div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ddcfbf] bg-[#fcfaf6] px-4 py-2 text-xs font-medium uppercase tracking-[.18em] text-[#987a5d]"><span className="h-2 w-2 rounded-full bg-[#9ca98e]" /> Now accepting appointments</div><h1 className="max-w-xl font-serif text-5xl leading-[1.02] tracking-[-.04em] text-[#332d28] md:text-7xl">A little time<br /><em className="text-[#a98b6e]">just for you.</em></h1><p className="mt-7 hidden max-w-md text-base leading-7 text-[#766b61] md:block">Thoughtful beauty rituals, personalised care, and a calm space to feel completely yourself.</p><div className="mt-9 hidden flex-wrap gap-7 text-sm text-[#6f6257] md:flex"><span><Sparkles className="mr-2 inline text-[#a98b6e]" size={17} />Tailored treatments</span><span><Clock3 className="mr-2 inline text-[#a98b6e]" size={17} />9 AM – 9 PM</span></div></section><section className="rounded-[28px] border border-[#e8dfd4] bg-[#fffdfa] p-5 shadow-[0_24px_70px_rgba(83,62,42,.09)] md:p-8"><div className="mb-8 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#aa9176]">Book your visit</p><h2 className="mt-2 font-serif text-3xl text-[#332d28]">{step === 3 ? 'Review details' : 'Find your moment'}</h2></div><span className="text-sm text-[#a98b6e]">0{step} <span className="text-[#d0c1b2]">/ 03</span></span></div><div className="mb-8 h-1 rounded-full bg-[#eee5da]"><div className="h-full rounded-full bg-[#a98b6e] transition-all" style={{ width: `${step * 33.33}%` }} /></div><form onSubmit={handleSubmit(onSubmit)}>{step === 1 && <div className="space-y-5"><Field label="Full name" error={errors.customer_name?.message}><input {...register('customer_name')}  /></Field><Field label="Phone number" error={errors.customer_phone?.message}><div className="phone-field"><span>+91</span><input {...register('customer_phone', { setValueAs: (value: string) => { const digits = value.replace(/\D/g, '').slice(0, 10); return digits ? `+91${digits}` : ''; } })} inputMode="numeric" maxLength={10}  /></div></Field><Field label="Purpose of visit" error={errors.purpose?.message}><select {...register('purpose')}><option value="">Choose a service</option>{PURPOSES.map(item => <option key={item}>{item}</option>)}</select></Field>{purpose === 'Other' && <Field label="Tell us a little more"><textarea {...register('additional_notes')} rows={3} placeholder="What would you like us to know?" /></Field>}<button type="button" onClick={async () => { const valid = await trigger(['customer_name', 'customer_phone', 'purpose']); if (valid) setStep(2); }} className="btn-primary mt-2 w-full">Choose a date <ArrowRight size={17} /></button></div>}{step === 2 && <div><Field label="Select a date" error={errors.appointment_date?.message}><input {...register('appointment_date')} type="date" min={minDate} /></Field><div className="mt-6 flex items-center justify-between"><p className="text-sm font-semibold text-[#4a413a]">Available times</p>{loading && <span className="text-xs text-[#a98b6e]">Checking availability…</span>}</div>{!date && <p className="mt-3 rounded-xl bg-[#f7f0e8] p-3 text-sm text-[#806c5a]">Please select a date first to see available times.</p>}{date && !loading && supabase && Object.keys(availability).length === 0 && <p className="mt-3 rounded-xl bg-[#f7f0e8] p-3 text-sm text-[#806c5a]">No appointments are available on this date. Please choose another date.</p>}<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{DEFAULT_SLOTS.map(slot => { const info = availability[slot.start_time]; const left = info ? info.capacity - info.booked_count : date && supabase ? 0 : settings.capacity_per_slot; return <button type="button" key={slot.start_time} disabled={loading || (!!date && !!supabase && !info) || (!!date && left <= 0)} onClick={() => { if (!date) { setError('Please select a date first.'); return; } if (!info && supabase) { setError('There are no appointments available on this date. Please choose another date.'); return; } setError(''); setValue('start_time', slot.start_time, { shouldValidate: true }); }} className={'slot ' + (selectedTime === slot.start_time ? 'slot-selected ' : '') + (date && left <= 0 ? 'slot-disabled' : '')}><span>{formatTime(slot.start_time)}</span><small>{!date ? 'Select a date first' : left <= 0 ? 'Fully booked' : left + ' spot' + (left > 1 ? 's' : '') + ' left'}</small></button>; })}</div>{errors.start_time && <p className="mt-2 text-xs text-[#b15e55]">{errors.start_time.message}</p>}{error && <p className="mt-4 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a34d45]">{error}</p>}<div className="mt-7 flex gap-3"><button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button><button type="button" className="btn-primary flex-1" onClick={() => { if (!date) { setError('Please select a date first.'); return; } if (selectedTime) setStep(3); else setError('Choose an available time to continue.'); }}>Review <ArrowRight size={16} /></button></div></div>}{step === 3 && <div><div className="divide-y divide-[#eee5da] rounded-2xl border border-[#eadfd3] bg-[#fcfaf7]">{[['Name', watch('customer_name')], ['Phone', watch('customer_phone')], ['Date', date ? formatDate(date) : ''], ['Time', selectedTime ? `${formatTime(selectedTime)} – ${formatTime(`${String(Number(selectedTime.slice(0, 2)) + 1).padStart(2, '0')}:00`)}` : ''], ['Purpose', purpose]].map(([label, value]) => <div className="flex justify-between gap-4 px-4 py-4 text-sm" key={label}><span className="text-[#8b7b6d]">{label}</span><strong className="text-right font-medium text-[#40372f]">{value}</strong></div>)}</div>{error && <p className="mt-4 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a34d45]">{error}</p>}<div className="mt-7 flex gap-3"><button type="button" className="btn-secondary flex-1" onClick={() => setStep(2)}><ArrowLeft size={16} /> Edit</button><button disabled={loading} className="btn-primary flex-1">{loading ? 'Saving…' : 'Confirm appointment'} <Check size={17} /></button></div><p className="mt-4 text-center text-xs leading-5 text-[#978a7d]">Your appointment will be held for you once confirmed. No account needed.</p></div>}</form></section></main><footer className="mx-auto flex max-w-6xl justify-between border-t border-[#e7ded3] px-5 py-6 text-xs text-[#9a8c7f] md:px-10"><span>© {new Date().getFullYear()} Organic by Pooja</span><Link to="/admin/login" className="hover:text-[#a98b6e]">Staff access</Link></footer></Shell>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-[#554a41]"><span className="mb-2 block">{label}</span>{children}{error && <span className="mt-1 block text-xs font-normal text-[#b15e55]">{error}</span>}</label>; }

function SuccessPage() { const location = useLocation(); const navigate = useNavigate(); const booking = (location.state as { booking?: Booking } | null)?.booking; const [copied, setCopied] = useState(false); if (!booking) return <Navigate to="/" replace />; const copy = async () => { await navigator.clipboard.writeText(bookingMessage(booking)); setCopied(true); setTimeout(() => setCopied(false), 1800); }; return <Shell compact><main className="mx-auto max-w-2xl px-5 pb-20 pt-10 md:px-10 md:pt-20"><div className="text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#e3ebdf] text-[#718267]"><CheckCircle2 size={40} strokeWidth={1.4} /></div><p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-[#a98b6e]">You’re all set</p><h1 className="mt-3 font-serif text-5xl tracking-[-.04em] text-[#332d28]">Your appointment<br /><em className="text-[#a98b6e]">is booked.</em></h1><p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#766b61]">We’ve saved your appointment. Share the details with the salon on WhatsApp when you’re ready.</p></div><div className="mt-10 rounded-[26px] border border-[#e8dfd4] bg-[#fffdfa] p-6 shadow-[0_20px_60px_rgba(83,62,42,.08)] md:p-8"><div className="flex items-center justify-between border-b border-[#eee5da] pb-5"><span className="text-xs uppercase tracking-[.18em] text-[#9b8876]">Booking reference</span><strong className="font-mono text-sm tracking-wider text-[#a27955]">{booking.booking_reference}</strong></div><div className="grid gap-5 pt-6 sm:grid-cols-2">{[['Guest', booking.customer_name], ['Date', formatDate(booking.appointment_date)], ['Time', `${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`], ['Purpose', booking.purpose]].map(([label, value]) => <div key={label}><span className="block text-xs text-[#a49484]">{label}</span><strong className="mt-1 block text-sm font-medium text-[#41382f]">{value}</strong></div>)}</div><div className="mt-8 space-y-3"><a className="btn-primary w-full" href={whatsappUrl(booking)} target="_blank" rel="noreferrer">Share booking on WhatsApp <ExternalLink size={16} /></a><button className="btn-secondary w-full" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied to clipboard' : 'Copy booking details'}</button></div><p className="mt-4 text-center text-xs text-[#9a8c7f]">WhatsApp will open with your message prepared. Please press Send yourself.</p></div><div className="mt-7 flex justify-center gap-6 text-sm"><button onClick={() => navigate('/')} className="text-[#806c5a] hover:text-[#a98b6e]">Book another appointment</button><Link to="/" className="text-[#806c5a] hover:text-[#a98b6e]">Return home</Link></div></main></Shell>; }

const staffLoginEmail = import.meta.env.VITE_STAFF_AUTH_EMAIL || 'salon-admin@organicbypooja.invalid';
function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!supabase) {
        setError('Demo mode is active. Connect Supabase to enable staff access.');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: staffLoginEmail, password });
      if (signInError) {
        setError('The password was not recognised.');
        return;
      }
      const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin');
      if (roleError || !isAdmin) {
        await supabase.auth.signOut();
        setError('Staff access is not enabled for this account.');
        return;
      }
      navigate('/admin');
    } catch {
      setError('We could not reach the sign-in service. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return <Shell compact><main className="mx-auto max-w-md px-5 pb-20 pt-12 md:pt-24"><Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-[#887665]"><ArrowLeft size={16} /> Back to booking</Link><div className="rounded-[26px] border border-[#e8dfd4] bg-[#fffdfa] p-7 shadow-[0_20px_60px_rgba(83,62,42,.07)] md:p-9"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a98b6e]">Private workspace</p><h1 className="mt-3 font-serif text-4xl text-[#332d28]">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-[#766b61]">Sign in to manage appointments for Organic by Pooja.</p><form onSubmit={submit} className="mt-8 space-y-5"><Field label="Password"><input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></Field>{error && <p className="rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a34d45]">{error}</p>}<button disabled={loading} className="btn-primary w-full">{loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button></form></div></main></Shell>;
}

function ProtectedAdmin({ children }: { children: React.ReactNode }) { const [ready, setReady] = useState(isDemoMode); const [allowed, setAllowed] = useState(isDemoMode); useEffect(() => { const client = supabase; if (!client) return; const checkAccess = async (session: { user: { id: string } } | null) => { if (!session) { setAllowed(false); setReady(true); return; } const { data } = await client.rpc('is_admin'); setAllowed(data === true); setReady(true); }; client.auth.getSession().then(({ data }) => checkAccess(data.session)); const { data: listener } = client.auth.onAuthStateChange((_event, session) => { void checkAccess(session); }); return () => listener.subscription.unsubscribe(); }, []); if (!ready) return <div className="grid min-h-screen place-items-center bg-[#f8f5ef] text-sm text-[#8c7d6f]">Loading workspace…</div>; return allowed ? <>{children}</> : <Navigate to="/admin/login" replace />; }

const navItems = [['/admin', 'Overview', LayoutDashboard], ['/admin/appointments', 'Appointments', FileText], ['/admin/calendar', 'Calendar', CalendarDays], ['/admin/qr-code', 'QR code', QrCode], ['/admin/settings', 'Settings', Settings]] as const;
function AdminApp() { const [menu, setMenu] = useState(false); const location = useLocation(); const navigate = useNavigate(); const logout = async () => { await supabase?.auth.signOut(); navigate('/admin/login'); }; return <div className="min-h-screen bg-[#f6f3ee] text-[#302b27]"><aside className={`fixed inset-y-0 left-0 z-20 w-64 border-r border-[#4b3a2f] bg-[#38281f] px-5 py-7 text-[#f7efe7] transition-transform md:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}><Link to="/admin" className="flex items-center gap-3 px-2"><img src="/organic-by-pooja-logo.png" alt="Organic by Pooja" className="h-9 w-9 rounded-full object-cover" /><span className="font-serif text-xl">Organic by Pooja</span></Link><p className="mb-8 mt-2 px-2 text-[10px] uppercase tracking-[.2em] text-[#bba795]">Admin workspace</p><nav className="space-y-1">{navItems.map(([to, label, Icon]) => <Link onClick={() => setMenu(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${location.pathname === to ? 'bg-[#604b3d] text-white' : 'text-[#cdbeb1] hover:bg-[#49372d] hover:text-white'}`} to={to} key={to}><Icon size={17} />{label}</Link>)}</nav><button onClick={logout} className="absolute bottom-7 left-8 flex items-center gap-3 text-sm text-[#cdbeb1] hover:text-white"><LogOut size={17} /> Sign out</button></aside><div className="md:pl-64"><header className="flex items-center justify-between border-b border-[#e7ded3] bg-[#fbf9f5] px-5 py-5 md:px-10"><button className="md:hidden" onClick={() => setMenu(!menu)}><Menu size={21} /></button><span className="font-serif text-2xl">{navItems.find(item => item[0] === location.pathname)?.[1] ?? 'Overview'}</span><Link className="text-sm text-[#806c5a]" to="/">View booking page <ExternalLink className="ml-1 inline" size={14} /></Link></header><main className="mx-auto max-w-7xl p-5 md:p-10"><Routes><Route index element={<Overview />} /><Route path="appointments" element={<Appointments />} /><Route path="calendar" element={<CalendarView />} /><Route path="qr-code" element={<QrCodeView />} /><Route path="settings" element={<SettingsView />} /></Routes></main></div></div>; }

function useBookings() { const [bookings, setBookings] = useState<Booking[]>([]); const [loading, setLoading] = useState(true); const refresh = async () => { if (supabase) { const { data } = await supabase.from('bookings').select('*').order('appointment_date').order('start_time'); setBookings((data ?? []) as Booking[]); } else setBookings(JSON.parse(localStorage.getItem('organic-bookings') ?? '[]')); setLoading(false); }; useEffect(() => { refresh(); }, []); return { bookings, loading, refresh }; }
function Metric({ label, value, detail, accent = false }: { label: string; value: string | number; detail: string; accent?: boolean }) { return <div className={`rounded-2xl border p-5 ${accent ? 'border-[#a98b6e] bg-[#a98b6e] text-white' : 'border-[#e7ded3] bg-[#fffdfa]'}`}><p className={`text-xs uppercase tracking-[.16em] ${accent ? 'text-[#f2e3d4]' : 'text-[#9b8876]'}`}>{label}</p><p className="mt-3 font-serif text-4xl">{value}</p><p className={`mt-2 text-xs ${accent ? 'text-[#f2e3d4]' : 'text-[#9b8876]'}`}>{detail}</p></div>; }
function Overview() { const { bookings, loading } = useBookings(); const today = format(new Date(), 'yyyy-MM-dd'); const todays = bookings.filter(b => b.appointment_date === today && b.status !== 'cancelled'); const upcoming = bookings.filter(b => b.appointment_date >= today && b.status !== 'cancelled'); const cancelled = bookings.filter(b => b.status === 'cancelled'); return <div><div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#9b8876]">Good morning</p><h1 className="mt-1 font-serif text-4xl text-[#332d28]">Your salon at a glance.</h1></div><Link to="/admin/appointments" className="btn-primary"><Plus size={17} /> New appointment</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Today's visits" value={loading ? '—' : todays.length} detail={format(new Date(), 'EEEE, d MMM')} accent /><Metric label="Upcoming" value={loading ? '—' : upcoming.length} detail="Active appointments" /><Metric label="Open capacity" value={loading ? '—' : Math.max(0, 24 - todays.length)} detail="Places remaining today" /><Metric label="Cancelled" value={loading ? '—' : cancelled.length} detail="All time" /></div><section className="mt-10 rounded-2xl border border-[#e7ded3] bg-[#fffdfa] p-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.17em] text-[#9b8876]">Today</p><h2 className="mt-1 font-serif text-2xl">Upcoming appointments</h2></div><Link to="/admin/appointments" className="text-sm text-[#a27955]">View all <ArrowRight className="ml-1 inline" size={14} /></Link></div>{todays.length === 0 ? <Empty icon={<CalendarDays size={20} />} title="A quiet day" text="New bookings will appear here." /> : <div className="mt-6 divide-y divide-[#eee5da]">{todays.map(booking => <BookingRow booking={booking} key={booking.id} />)}</div>}</section></div>; }
function BookingRow({ booking, onEdit }: { booking: Booking; onEdit?: (booking: Booking) => void }) { return <div className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex items-center gap-4"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#eee5da] text-sm font-semibold text-[#8c7159]">{booking.customer_name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div><p className="font-medium text-[#40372f]">{booking.customer_name}</p><p className="mt-1 text-xs text-[#9b8876]">{formatTime(booking.start_time)} · {booking.purpose}</p></div></div><div className="flex items-center gap-4"><span className={`status status-${booking.status}`}>{booking.status}</span>{onEdit && <button onClick={() => onEdit(booking)} className="rounded-lg p-2 text-[#9b8876] hover:bg-[#f2ece4]"><Pencil size={16} /></button>}</div></div>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="py-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f1ebe3] text-[#a98b6e]">{icon}</div><p className="mt-4 font-serif text-xl">{title}</p><p className="mt-1 text-sm text-[#9b8876]">{text}</p></div>; }

function Appointments() { const { bookings, loading, refresh } = useBookings(); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [selected, setSelected] = useState<Booking | null>(null); const filtered = bookings.filter(b => (status === 'all' || b.status === status) && `${b.customer_name} ${b.customer_phone} ${b.booking_reference}`.toLowerCase().includes(search.toLowerCase())); return <div><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#9b8876]">Every visit, beautifully organised.</p><h1 className="mt-1 font-serif text-4xl">Appointments</h1></div><div className="flex gap-3"><button className="btn-primary" onClick={() => setSelected({ id: '', booking_reference: 'New appointment', customer_name: '', customer_phone: '+91', appointment_date: format(new Date(), 'yyyy-MM-dd'), start_time: '09:00:00', end_time: '10:00:00', purpose: PURPOSES[0], additional_notes: null, status: 'confirmed', created_at: new Date().toISOString() })}><Plus size={17} /> New appointment</button><Link to="/admin/calendar" className="btn-secondary"><CalendarDays size={17} /> Calendar view</Link></div></div><div className="mb-5 flex flex-wrap gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-[#aa9988]" size={17} /><input className="w-full pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, or booking ID" /></div><select className="w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div><div className="overflow-hidden rounded-2xl border border-[#e7ded3] bg-[#fffdfa]"><div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_auto] gap-4 border-b border-[#eee5da] px-5 py-4 text-xs uppercase tracking-[.12em] text-[#9b8876] md:grid"><span>Guest</span><span>Date</span><span>Time</span><span>Status</span><span /></div>{loading ? <p className="p-8 text-sm text-[#9b8876]">Loading appointments…</p> : filtered.length === 0 ? <Empty icon={<Users size={20} />} title="No appointments found" text="Try adjusting your search or filters." /> : <div className="divide-y divide-[#eee5da]">{filtered.map(booking => <div className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] md:items-center" key={booking.id}><div><p className="font-medium">{booking.customer_name}</p><p className="mt-1 text-xs text-[#9b8876]">{booking.booking_reference} · {booking.purpose}</p></div><span className="text-sm text-[#675a50]">{formatDate(booking.appointment_date)}</span><span className="text-sm text-[#675a50]">{formatTime(booking.start_time)}</span><span className={`status status-${booking.status}`}>{booking.status}</span><div className="flex flex-wrap items-center gap-2"><a className="btn-secondary min-h-9 px-3 text-xs" href={reminderWhatsappUrl(booking)} target="_blank" rel="noreferrer">Inform on WhatsApp <ExternalLink size={13} /></a><button aria-label="Edit appointment" className="rounded-lg p-2 text-[#9b8876] hover:bg-[#f2ece4]" onClick={() => setSelected(booking)}><Pencil size={16} /></button></div></div>)}</div>}</div>{selected && <EditModal booking={selected} onClose={() => setSelected(null)} onSave={() => { setSelected(null); refresh(); }} />}</div>; }
function EditModal({ booking, onClose, onSave, }: { booking: Booking; onClose: () => void; onSave: () => void }) { const [form, setForm] = useState(booking); const [saving, setSaving] = useState(false); const save = async () => {
    setSaving(true);
    try {
      if (supabase) {
        const { error } = form.id
          ? await supabase.rpc('update_booking_admin', { p_id: form.id, p_customer_name: form.customer_name, p_customer_phone: form.customer_phone, p_appointment_date: form.appointment_date, p_start_time: form.start_time, p_purpose: form.purpose, p_additional_notes: form.additional_notes, p_status: form.status })
          : await supabase.rpc('create_public_booking', { p_customer_name: form.customer_name, p_customer_phone: form.customer_phone, p_appointment_date: form.appointment_date, p_start_time: form.start_time, p_purpose: form.purpose, p_additional_notes: form.additional_notes });
        if (error) {
          alert(bookingErrorMessage(error.message));
          return;
        }
      } else {
        const all: Booking[] = JSON.parse(localStorage.getItem('organic-bookings') ?? '[]');
        const next = form.id ? all.map(item => item.id === form.id ? form : item) : [...all, { ...form, id: crypto.randomUUID(), booking_reference: 'OP' + Math.random().toString(36).slice(2, 10).toUpperCase() }];
        localStorage.setItem('organic-bookings', JSON.stringify(next));
      }
      onSave();
    } catch {
      alert('Could not save this appointment. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!form.id || !window.confirm('Permanently delete this booking? This cannot be undone.')) return;
    setSaving(true);
    try {
      if (supabase) {
        const { error } = await supabase.rpc('delete_booking_admin', { p_id: form.id });
        if (error) {
          alert('Could not delete this booking. Please try again.');
          return;
        }
      } else {
        const all: Booking[] = JSON.parse(localStorage.getItem('organic-bookings') ?? '[]');
        localStorage.setItem('organic-bookings', JSON.stringify(all.filter(item => item.id !== form.id)));
      }
      onSave();
    } catch {
      alert('Could not delete this booking. Please try again.');
    } finally {
      setSaving(false);
    }
  }; return <div className="fixed inset-0 z-30 grid place-items-center bg-[#2e241e]/40 p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-[#fffdfa] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.16em] text-[#a98b6e]">{booking.id ? booking.booking_reference : 'Staff booking'}</p><h2 className="mt-1 font-serif text-2xl">{booking.id ? 'Edit appointment' : 'New appointment'}</h2></div><button onClick={onClose}><X size={20} /></button></div><div className="mt-6 space-y-4"><Field label="Customer name"><input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></Field><Field label="Phone"><input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Date"><input type="date" value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} /></Field><Field label="Time"><select value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}>{DEFAULT_SLOTS.map(slot => <option key={slot.start_time} value={slot.start_time}>{formatTime(slot.start_time)}</option>)}</select></Field></div><Field label="Purpose"><select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>{PURPOSES.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Status"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Booking['status'] })}><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field></div><div className="mt-7 flex flex-wrap gap-3">{booking.id && <button className="btn-secondary text-[#a34d45]" disabled={saving} onClick={remove}>Delete booking</button>}<button className="btn-secondary flex-1" onClick={onClose}>Close</button><button className="btn-primary flex-1" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'} <Check size={16} /></button></div></div></div>; }

function CalendarView() { const { bookings } = useBookings(); const [month, setMonth] = useState(new Date()); const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }); return <div><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#9b8876]">A clear view of your days.</p><h1 className="mt-1 font-serif text-4xl">Calendar</h1></div><div className="flex items-center gap-2"><button className="icon-btn" onClick={() => setMonth(subMonths(month, 1))}><ArrowLeft size={17} /></button><button className="btn-secondary" onClick={() => setMonth(new Date())}>Today</button><button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))}><ArrowRight size={17} /></button></div></div><div className="rounded-2xl border border-[#e7ded3] bg-[#fffdfa] p-4 md:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-2xl">{format(month, 'MMMM yyyy')}</h2><span className="text-xs text-[#9b8876]">{bookings.filter(b => isSameMonth(parseISO(b.appointment_date), month) && b.status !== 'cancelled').length} active visits</span></div><div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-[#aa9988]">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span className="py-3" key={day}>{day}</span>)}{Array.from({ length: (startOfMonth(month).getDay() + 6) % 7 }).map((_, i) => <span key={`empty-${i}`} />)}{days.map(day => { const dayBookings = bookings.filter(b => isSameDay(parseISO(b.appointment_date), day)); return <div key={day.toISOString()} className={`min-h-28 rounded-xl border p-2 text-left ${isToday(day) ? 'border-[#a98b6e] bg-[#fbf5ee]' : 'border-[#f0e8df]'}`}><span className={`text-xs ${isToday(day) ? 'font-bold text-[#a27955]' : 'text-[#7d7064]'}`}>{format(day, 'd')}</span><div className="mt-2 space-y-1">{dayBookings.slice(0, 3).map(item => <div className={`truncate rounded-md px-1.5 py-1 text-[10px] ${item.status === 'cancelled' ? 'bg-[#f2ebe5] text-[#aa9988] line-through' : item.status === 'completed' ? 'bg-[#e4eee2] text-[#718267]' : 'bg-[#eadfd3] text-[#805f43]'}`} key={item.id}><span>{formatTime(item.start_time)} · {item.purpose}</span><span className="block truncate">{item.customer_name}</span></div>)}{dayBookings.length > 3 && <span className="text-[10px] text-[#a98b6e]">+{dayBookings.length - 3} more</span>}</div></div>})}</div></div></div>; }

function QrCodeView() { const url = import.meta.env.VITE_PUBLIC_SITE_URL ?? window.location.origin; return <div className="mx-auto max-w-2xl"><p className="text-sm text-[#9b8876]">A simple welcome at reception.</p><h1 className="mt-1 font-serif text-4xl">Your booking QR code</h1><div className="mt-8 grid gap-8 rounded-2xl border border-[#e7ded3] bg-[#fffdfa] p-8 md:grid-cols-[220px_1fr] md:items-center"><div className="qr-card"><div className="qr-placeholder"><QRCodeSVG value={url} size={150} bgColor="#fffdfa" fgColor="#38281f" includeMargin /></div><p className="mt-4 font-serif text-xl">Organic by Pooja</p><p className="mt-1 text-xs uppercase tracking-[.18em] text-[#a98b6e]">Scan to book</p></div><div><h2 className="font-serif text-2xl">Make it effortless</h2><p className="mt-3 text-sm leading-6 text-[#766b61]">Place this QR code at the reception desk so guests can book their next visit in under a minute.</p><p className="mt-5 break-all rounded-lg bg-[#f6f0e9] p-3 text-xs text-[#8e7c6c]">{url}</p><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => window.print()}>Print poster <FileText size={16} /></button><button className="btn-secondary" onClick={() => navigator.clipboard.writeText(url)}><Copy size={16} /> Copy link</button></div><p className="mt-4 text-xs text-[#a49484]">The QR preview is ready for this website. Print from a deployed address for your final reception poster.</p></div></div></div>; }

function SettingsView() { const [settings, setSettings] = useState(defaultSettings); const [saved, setSaved] = useState(false); useEffect(() => { supabase?.from('salon_settings').select('*').eq('id', true).maybeSingle().then(({ data }) => { if (data) setSettings(data as SalonSettings); }); }, []); const save = async () => { if (supabase) await supabase.from('salon_settings').update({ salon_name: settings.salon_name, whatsapp_number: settings.whatsapp_number, opening_time: settings.opening_time, closing_time: settings.closing_time, capacity_per_slot: settings.capacity_per_slot, working_days: settings.working_days }).eq('id', true); setSaved(true); setTimeout(() => setSaved(false), 1800); }; return <div className="mx-auto max-w-3xl"><p className="text-sm text-[#9b8876]">Keep the experience current.</p><h1 className="mt-1 font-serif text-4xl">Salon settings</h1><div className="mt-8 rounded-2xl border border-[#e7ded3] bg-[#fffdfa] p-6 md:p-8"><div className="grid gap-5 sm:grid-cols-2"><Field label="Salon name"><input value={settings.salon_name} onChange={e => setSettings({ ...settings, salon_name: e.target.value })} /></Field><Field label="WhatsApp number"><input value={settings.whatsapp_number} onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })} /></Field><Field label="Opening time"><input type="time" value={settings.opening_time} onChange={e => setSettings({ ...settings, opening_time: e.target.value })} /></Field><Field label="Closing time"><input type="time" value={settings.closing_time} onChange={e => setSettings({ ...settings, closing_time: e.target.value })} /></Field><Field label="Capacity per hour"><input type="number" min="1" max="20" value={settings.capacity_per_slot} onChange={e => setSettings({ ...settings, capacity_per_slot: Number(e.target.value) })} /></Field><Field label="Timezone"><input value={settings.timezone} readOnly /></Field></div><div className="mt-8 flex items-center justify-between border-t border-[#eee5da] pt-6"><p className="text-xs text-[#9b8876]">Slot length is fixed at 60 minutes for this salon.</p><button onClick={save} className="btn-primary">{saved ? 'Saved' : 'Save settings'} <Check size={16} /></button></div></div></div>; }

export default App;
