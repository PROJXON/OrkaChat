import * as React from 'react';
import { Platform } from 'react-native';

/**
 * Web note:
 * React Native's FlatList `inverted` can render upside-down on web in some environments.
 * Pattern used across screens: render non-inverted on web and reverse the data instead.
 */
export function useWebSafeInvertedListData<T>(items: readonly T[]): T[] {
  return React.useMemo(
    () => (Platform.OS === 'web' ? [...items].reverse() : (items as T[])),
    [items],
  );
}
