import type { Unsubscribe } from 'firebase/firestore';
import { useCallback, useRef, useSyncExternalStore } from 'react';

// One Firestore listener per query, shared by every component that asks for it.
// (Without this, each screen / tab bar / header mounted its own copy: the same data was read 4x or more.)
// The listener starts with the first subscriber and stops shortly after the last one leaves.

type State<T> = { data: T; loading: boolean; error: boolean };
type Entry = {
  state: State<any>;
  subs: Set<() => void>;
  waiters: (() => void)[];
  stop?: Unsubscribe;
  timer?: ReturnType<typeof setTimeout>;
  start: () => void;
};

const LINGER_MS = 5000; // keep the listener a moment so quick screen changes don't re-read everything
const entries = new Map<string, Entry>();

function entryFor<T>(key: string, subscribe: (set: (v: T) => void, fail: () => void) => Unsubscribe, initial: T): Entry {
  let e = entries.get(key);
  if (e) return e;
  const created: Entry = {
    state: { data: initial, loading: true, error: false },
    subs: new Set(),
    waiters: [],
    start: () => {
      created.stop?.();
      const publish = (state: State<T>) => {
        created.state = state;
        created.subs.forEach((cb) => cb());
        created.waiters.splice(0).forEach((resolve) => resolve());
      };
      created.stop = subscribe(
        (data) => publish({ data, loading: false, error: false }),
        () => publish({ ...created.state, loading: false, error: true }),
      );
    },
  };
  entries.set(key, created);
  return created;
}

// Re-read a shared query right now (after a write that must show up at once, or a listener that died).
export const restartLive = (key: string) => entries.get(key)?.start();

// key = null -> nothing to listen to (e.g. signed out). Same key = same shared listener.
export function useLive<T>(key: string | null, subscribe: (set: (v: T) => void, fail: () => void) => Unsubscribe, initial: T) {
  const idle = useRef<State<T>>({ data: initial, loading: false, error: false }).current;
  const entry = key ? entryFor<T>(key, subscribe, initial) : null;

  const attach = useCallback(
    (onChange: () => void) => {
      if (!entry || !key) return () => {};
      clearTimeout(entry.timer);
      entry.subs.add(onChange);
      if (!entry.stop) entry.start();
      return () => {
        entry.subs.delete(onChange);
        if (entry.subs.size) return;
        entry.timer = setTimeout(() => {
          if (entry.subs.size) return;
          entry.stop?.();
          entry.stop = undefined;
          entries.delete(key);
        }, LINGER_MS);
      };
    },
    [entry, key],
  );

  const state = useSyncExternalStore(attach, () => (entry ? (entry.state as State<T>) : idle));

  // pull-to-refresh: re-read from the server; resolves when the first snapshot arrives (or after 5s offline)
  const refresh = () =>
    new Promise<void>((resolve) => {
      if (!entry) return resolve();
      entry.waiters.push(resolve);
      setTimeout(resolve, 5000);
      entry.start();
    });

  return { ...state, refresh };
}
