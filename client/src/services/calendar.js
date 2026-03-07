/**
 * Generate an .ics calendar file and trigger a download.
 * Works with Google Calendar, Apple Calendar, Outlook, etc.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

function toICSDate(date) {
  const d = new Date(date);
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function toICSDateOnly(date) {
  const d = new Date(date);
  return d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate());
}

/**
 * Build an .ics string from a mail item.
 * @param {object} item - The mail item from the API
 * @returns {string} .ics file content
 */
function buildICS(item) {
  const now = new Date();
  const uid = `robin-${item.id}@robin.local`;
  const summary = item.sender
    ? `${item.sender}: ${item.summary || 'Mail reminder'}`
    : item.summary || 'Mail reminder';

  const description = [
    item.summary,
    item.amountDue ? `Amount due: ${item.amountDue}` : '',
    item.keyDetails?.length ? `\\nKey details:\\n- ${item.keyDetails.join('\\n- ')}` : '',
    '\\nCreated by Robin - Smart Mail Assistant',
  ]
    .filter(Boolean)
    .join('\\n');

  // If there's a due date, use it; otherwise fall back to tomorrow 9 AM
  const dueDate = item.dueDate ? new Date(item.dueDate) : null;

  // Use all-day event if we only have a date (no time info)
  const isAllDay = dueDate && dueDate.getHours() === 0 && dueDate.getMinutes() === 0;

  // Set a reminder alarm 1 day before
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Robin Mail Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(now)}`,
  ];

  if (isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${toICSDateOnly(dueDate)}`);
    // All-day events: end date is exclusive (next day)
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${toICSDateOnly(nextDay)}`);
  } else if (dueDate) {
    lines.push(`DTSTART:${toICSDate(dueDate)}`);
    const endDate = new Date(dueDate);
    endDate.setHours(endDate.getHours() + 1);
    lines.push(`DTEND:${toICSDate(endDate)}`);
  }

  lines.push(
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    // Reminder: 1 day before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${summary}`,
    'END:VALARM',
    // Reminder: 1 hour before
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.join('\r\n');
}

/**
 * Download a .ics file for a mail item.
 * On mobile, this typically opens the native calendar app.
 * @param {object} item - The mail item
 */
export function downloadCalendarEvent(item) {
  const ics = buildICS(item);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const filename = `robin-${item.sender?.replace(/[^a-zA-Z0-9]/g, '_') || 'event'}.ics`;

  // Try Web Share API first (works great on mobile — opens native calendar)
  if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: 'text/calendar' })] })) {
    const file = new File([blob], filename, { type: 'text/calendar' });
    navigator.share({ files: [file], title: 'Add to Calendar' }).catch(() => {
      // Fallback to download if share is cancelled
      triggerDownload(url, filename);
    });
  } else {
    triggerDownload(url, filename);
  }
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
