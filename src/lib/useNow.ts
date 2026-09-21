import { useEffect, useState } from 'react';

// The current time, re-read every `every` ms so countdowns keep moving while the screen is open.
export const useNow = (every = 15000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
};
