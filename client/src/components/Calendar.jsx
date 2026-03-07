import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react';
import { getAllMail } from '../services/api';
import { getCategoryColor, getCategoryIcon } from '../utils';
import { downloadCalendarEvent } from '../services/calendar';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Calendar() {
  const [mail, setMail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    getAllMail()
      .then(setMail)
      .catch(() => setMail([]))
      .finally(() => setLoading(false));
  }, []);

  // Build a map of date → mail items with due dates
  const eventsByDate = useMemo(() => {
    const map = {};
    mail.forEach((item) => {
      if (item.dueDate) {
        const key = toDateKey(item.dueDate);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      }
    });
    return map;
  }, [mail]);

  // Generate calendar grid for current month
  const calendarDays = useMemo(() => {
    const { year, month } = current;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6 (ISO-style)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, key: toDateKey(d), inMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({ date, key: toDateKey(date), inMonth: true });
    }

    // Next month padding (fill to 42 cells = 6 rows)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ date, key: toDateKey(date), inMonth: false });
    }

    return days;
  }, [current]);

  const todayKey = toDateKey(new Date());

  function prevMonth() {
    setCurrent((c) => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
    });
    setSelectedDate(null);
  }

  function nextMonth() {
    setCurrent((c) => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
    });
    setSelectedDate(null);
  }

  function goToday() {
    const now = new Date();
    setCurrent({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayKey);
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  // Count total events this month
  const monthEventCount = calendarDays
    .filter((d) => d.inMonth && eventsByDate[d.key])
    .reduce((sum, d) => sum + eventsByDate[d.key].length, 0);

  if (loading) return <div className="loading">Loading calendar…</div>;

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevMonth}>
          <ChevronLeft size={20} />
        </button>
        <div className="cal-title">
          <h2>{MONTHS[current.month]} {current.year}</h2>
          <span className="cal-subtitle">
            {monthEventCount} {monthEventCount === 1 ? 'event' : 'events'}
          </span>
        </div>
        <button className="cal-nav-btn" onClick={nextMonth}>
          <ChevronRight size={20} />
        </button>
      </div>

      <button className="today-btn" onClick={goToday}>Today</button>

      <div className="calendar-grid">
        {DAYS.map((d) => (
          <div key={d} className="cal-day-header">{d}</div>
        ))}
        {calendarDays.map((day) => {
          const events = eventsByDate[day.key] || [];
          const isToday = day.key === todayKey;
          const isSelected = day.key === selectedDate;
          return (
            <button
              key={day.key}
              className={[
                'cal-cell',
                !day.inMonth && 'out-of-month',
                isToday && 'today',
                isSelected && 'selected',
                events.length > 0 && 'has-events',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(day.key === selectedDate ? null : day.key)}
            >
              <span className="cal-date">{day.date.getDate()}</span>
              {events.length > 0 && (
                <div className="cal-dots">
                  {events.slice(0, 3).map((e, i) => (
                    <span key={i} className={`cal-dot ${getCategoryColor(e.category)}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="cal-events">
          <h3>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="no-events">No events on this day</p>
          ) : (
            selectedEvents.map((item) => (
              <div key={item.id} className="cal-event-card">
                <Link to={`/mail/${item.id}`} className="cal-event-link">
                  <span className={`category-badge ${getCategoryColor(item.category)}`}>
                    {getCategoryIcon(item.category)} {item.category}
                  </span>
                  <h4>{item.sender || 'Unknown'}</h4>
                  <p>{item.summary}</p>
                  {item.amountDue && <span className="amount">{item.amountDue}</span>}
                </Link>
                <button
                  className="cal-export-btn"
                  onClick={() => downloadCalendarEvent(item)}
                  title="Export to calendar app"
                >
                  <CalendarPlus size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
