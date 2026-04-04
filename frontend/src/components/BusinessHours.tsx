/**
 * Displays formatted business hours, highlighting today's hours.
 */

import styles from './BusinessHours.module.css';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

interface BusinessHoursProps {
  /** Hours object: { monday: "9:00 AM - 5:00 PM", ... } */
  hours: Record<string, string> | null;
}

/**
 * Renders a list of daily hours with today's row highlighted.
 */
export default function BusinessHours({ hours }: BusinessHoursProps) {
  if (!hours) return <p className={styles.noHours}>Hours not available</p>;

  const todayKey = DAY_NAMES[new Date().getDay()];

  return (
    <ul className={styles.list}>
      {DAY_NAMES.map((day) => {
        const value = hours[day] ?? 'Closed';
        const isToday = day === todayKey;
        const isClosed = value.toLowerCase() === 'closed';
        return (
          <li key={day} className={`${styles.row} ${isToday ? styles.today : ''}`}>
            <span className={styles.dayName}>{DAY_LABELS[day]}</span>
            <span className={`${styles.hours} ${isClosed ? styles.closed : ''}`}>
              {value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
