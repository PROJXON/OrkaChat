import { Platform } from 'react-native';

// FlatList `data` neighbor helper.
// - On web we render a non-inverted list and reverse the data (oldest-first),
//   so the "older" neighbor is `index - 1`.
// - On native we keep newest-first (inverted list),
//   so the "older" neighbor is `index + 1`.
export function getOlderNeighbor<T>(data: T[], index: number): T | undefined {
  const arr = Array.isArray(data) ? data : [];
  const i = Platform.OS === 'web' ? index - 1 : index + 1;
  return i >= 0 && i < arr.length ? arr[i] : undefined;
}
