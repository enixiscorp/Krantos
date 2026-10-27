// NotificationService.ts
// Handles system-level notifications, audio alerts, and Web Push subscriptions.

import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'BCGaXgV61Hur-1YAV4k46RVmwGJOolnbHdMIEiVvWwu9iBbcXPzVgJzzbxZIH2EZHCr7SJhyeVXHWf8jM-7iVvY';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class NotificationService {
  private sound: HTMLAudioElement | null = null;
  private soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Professional ping sound

  constructor() {
    if (typeof window !== 'undefined') {
      this.sound = new Audio(this.soundUrl);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications.');
      return false;
    }

    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  playNotificationSound() {
    if (this.sound) {
      this.sound.currentTime = 0;
      this.sound.play().catch(e => console.warn('Could not play sound:', e));
    }
  }

  notify(title: string, body: string, icon = '/favicon.ico') {
    if (Notification.permission === 'granted') {
      const n = new Notification(title, {
        body,
        icon,
        silent: false, // We use our own sound
      });
      
      this.playNotificationSound();

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } else {
      // Fallback to sound only if permission denied but we want to alert
      this.playNotificationSound();
    }
  }

  async subscribeToPushNotifications(userId: string): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported in this browser.');
        return false;
      }

      // Check notification permission first
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Notification permission was not granted.');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe options
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      };

      const subscription = await registration.pushManager.subscribe(subscribeOptions);
      console.log('[Push Service] Browser Subscribed:', subscription);

      // Save push subscription to Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: subscription.toJSON()
        }, {
          onConflict: 'user_id, subscription'
        });

      if (error) {
        console.error('[Push Service] Error saving subscription in Supabase:', error.message);
        return false;
      }

      console.log('[Push Service] Subscription successfully saved in Supabase.');
      return true;
    } catch (err) {
      console.error('[Push Service] Subscription error:', err);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
