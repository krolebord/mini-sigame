import { z } from 'zod';
import { createAnonUsername } from '../utils/anon-username';
import { createPersistedStore } from './create-persisted-store';

const key = 'preferences';

const schema = z.object({
  username: z.string(),
  volume: z.number().min(0).max(1),
  theme: z.enum(['light', 'dark', 'system']),
});

const [preferences, setPrefereces] = createPersistedStore(key, schema, {
  username: createAnonUsername(),
  volume: 0.5,
  theme: 'system',
});

export function usePreferences() {
  return [preferences, setPrefereces] as const;
}

export function useUsername() {
  return () => preferences.username;
}
