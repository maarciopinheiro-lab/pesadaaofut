// Service Worker para o Firebase Cloud Messaging (FCM) e PWA
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');
importScripts('./sw.js');

const firebaseConfig = {
  apiKey: "AIzaSyDYsvvkwwATRVqEqGWJ3cCA60VW7K_Mdyc",
  authDomain: "pesadaofut-ea90e.firebaseapp.com",
  projectId: "pesadaofut-ea90e",
  storageBucket: "pesadaofut-ea90e.firebasestorage.app",
  messagingSenderId: "27646485862",
  appId: "1:27646485862:web:9f1aba7a023d5617a214a7"
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensagem recebida em 2º plano:', payload);
    const title = payload.notification?.title || payload.data?.title || 'Pesadão F.C.';
    const body = payload.notification?.body || payload.data?.body || 'Nova notificação recebida!';
    const icon = payload.notification?.icon || payload.data?.icon || 'https://i.imgur.com/CxbCPR5.png';

    const options = {
      body: body,
      icon: icon,
      badge: icon,
      vibrate: [100, 50, 100],
      data: payload.data || {}
    };

    return self.registration.showNotification(title, options);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Erro ao inicializar messaging no SW:', err);
}
