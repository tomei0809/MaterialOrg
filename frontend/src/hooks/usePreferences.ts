'use client';

import { useSyncExternalStore } from 'react';
import {
  getPreferences,
  getServerPreferences,
  setPreferences,
  subscribePreferences,
} from '@/lib/preferences';

export function usePreferences() {
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    getServerPreferences,
  );
  return [preferences, setPreferences] as const;
}
