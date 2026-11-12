const BOOKING_TIME_ZONE = "Asia/Kolkata";
const WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

const zonedDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

function getZonedParts(date) {
    return Object.fromEntries(
        zonedDateTimeFormatter
            .formatToParts(date)
            .filter(({ type }) => type !== "literal")
            .map(({ type, value }) => [type, value])
    );
}

function formatDate(year, month, day) {
    return `${year}-${month}-${day}`;
}

export function getDateForWeekday(dayName, now = new Date()) {
    const targetDay = WEEKDAYS.indexOf(dayName);
    if (targetDay === -1) return null;

    const { year, month, day } = getZonedParts(now);
    const today = formatDate(year, month, day);
    const currentDay = new Date(`${today}T12:00:00Z`).getUTCDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    const result = new Date(`${today}T12:00:00Z`);
    result.setUTCDate(result.getUTCDate() + daysUntilTarget);
    return result.toISOString().slice(0, 10);
}

export function getWeekdayForDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        return "";
    }
    return WEEKDAYS[parsedDate.getUTCDay()];
}

export function isSlotBookable(date, time, now = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        return false;
    }

    const timeMatch = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);
    if (!timeMatch) return false;
    const [, hours, minutes, seconds] = timeMatch;
    if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return false;

    const { year, month, day, hour, minute, second } = getZonedParts(now);
    const today = formatDate(year, month, day);
    if (date > today) return true;
    if (date < today) return false;

    return time > `${hour}:${minute}:${second}`;
}
