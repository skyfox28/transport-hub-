import { useState, useEffect } from 'react';

interface LiveClock {
  time: string;
  date: string;
  dateShort: string;
}

export function useLiveClock(): LiveClock {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const time = `${hours}:${minutes}:${seconds}`;

  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  const dayName = days[now.getDay()];
  const dayNum = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();

  const date = `${dayName} ${dayNum} ${monthName} ${year}`;
  const dateShort = `${pad(dayNum)}/${pad(now.getMonth() + 1)}/${year}`;

  return { time, date, dateShort };
}
