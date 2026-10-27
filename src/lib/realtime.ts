// ============================================================
// Krantos Platform — Realtime channel helper
// ============================================================
// supabase.channel(name) returns the EXISTING channel when one with the same
// name is still registered. removeChannel() is async, so when a component
// re-subscribes right after its cleanup (page refresh, effect re-run, React
// StrictMode, navigating back to a page), the old channel is still there,
// already subscribed, and calling .on() on it throws:
//   "cannot add `postgres_changes` callbacks ... after `subscribe()`"
// That error crashed the whole interface. A unique name per subscription
// always gives a fresh channel.

import { supabase } from './supabase';
import { v4 as uuidv4 } from './uuid';

export function createRealtimeChannel(name: string) {
  return supabase.channel(`${name}:${uuidv4()}`);
}
