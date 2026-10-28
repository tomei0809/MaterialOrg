'use client';

import { useSyncExternalStore } from 'react';
import {
  getSearchHistory,
  getServerSearchHistory,
  subscribeSearchHistory,
} from '@/lib/searchHistory';

export function useSearchHistory() {
  return useSyncExternalStore(subscribeSearchHistory, getSearchHistory, getServerSearchHistory);
}
