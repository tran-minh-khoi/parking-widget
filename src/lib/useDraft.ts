import { useState } from 'react';

// Edits held back until an explicit "Save": `val` is the current values with the edits on top,
// `dirty` says whether anything actually differs from what is saved. Untouched fields keep following
// the saved values (so data that loads late still shows up).
export function useDraft<T extends Record<string, unknown>>(current: T) {
  const [edits, setEdits] = useState<Partial<T>>({});
  const val = { ...current, ...edits } as T;
  const dirty = (Object.keys(edits) as (keyof T)[]).some((k) => edits[k] !== current[k]);
  const set = <K extends keyof T>(key: K, value: T[K]) => setEdits((e) => ({ ...e, [key]: value }));
  return { val, set, dirty, reset: () => setEdits({}) };
}
