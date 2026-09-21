import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { loadNavPref } from '@/features/directions/nav';
import { loadLang } from '@/lib/i18n';
import { loadSpot } from './spot';
import { handleLocation, stopTracking, TRACK_TASK } from './tracking';

// Must be registered before the app starts (index.js imports this file first). The JS context may be a fresh
// background launch, so language + maps preference are reloaded before drawing anything.
TaskManager.defineTask(TRACK_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  const loc = data?.locations?.at(-1);
  if (error || !loc) return;
  await Promise.all([loadLang(), loadNavPref()]);
  const spot = await loadSpot();
  if (!spot) return void stopTracking();
  handleLocation(spot, loc.coords.latitude, loc.coords.longitude);
});
