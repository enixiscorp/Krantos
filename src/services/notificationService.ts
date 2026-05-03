// NotificationService.ts
// Handles system-level notifications and audio alerts.

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
}

export const notificationService = new NotificationService();
