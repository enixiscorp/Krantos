// ============================================================
// Krantos Background Push Notification Listener
// ============================================================

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Event received.');

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Nouveau Message Krantos',
        body: event.data.text()
      };
    }
  }

  const title = data.title || 'Nouveau Lead Krantos ⚡';
  const options = {
    body: data.body || 'Un nouveau calcul énergétique est disponible sur votre tableau de bord.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100, 50, 200],
    data: {
      url: data.url || '/business-dashboard'
    },
    actions: [
      {
        action: 'open',
        title: 'Voir le Tableau de Bord'
      }
    ],
    tag: 'krantos-lead-notification',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');

  event.notification.close();

  const targetUrl = event.notification.data.url || '/business-dashboard';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Si une fenêtre de l'app est déjà ouverte, on la focus et on y navigue
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          return client.focus().then(function() {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      // Sinon, on ouvre une nouvelle fenêtre
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
