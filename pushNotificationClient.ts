import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDYsvvkwwATRVqEqGWJ3cCA60VW7K_Mdyc",
  authDomain: "pesadaofut-ea90e.firebaseapp.com",
  projectId: "pesadaofut-ea90e",
  storageBucket: "pesadaofut-ea90e.firebasestorage.app",
  messagingSenderId: "27646485862",
  appId: "1:27646485862:web:9f1aba7a023d5617a214a7",
  measurementId: "G-GQ0PJYQZXD"
};

const VAPID_KEY = "BDSjnvd9_2HxQ_KHFUNuY1ltMDCOJz_HBh43JPq5ui5nrzN8yX0WUKcKqFrh95K9rFf9Vyf0he3iWOonPX7IMiE";

// Inicializa o Firebase Client sem duplicar
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Configurar o listener de mensagens em primeiro plano (Foreground)
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          console.log('[PushClient] Notificação recebida em 1º plano (foreground):', payload);
          const title = payload.notification?.title || payload.data?.title || 'Pesadão F.C.';
          const body = payload.notification?.body || payload.data?.body || 'Nova mensagem recebida';
          const icon = payload.notification?.icon || payload.data?.icon || 'https://i.imgur.com/CxbCPR5.png';

          // 1. Disparar evento personalizado para Banner Flutuante na Tela do App
          window.dispatchEvent(new CustomEvent('app-push-notification', {
            detail: { title, body, icon }
          }));

          // 2. Disparar notificação nativa do sistema/navegador
          if (Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(title, {
                  body,
                  icon,
                  badge: icon,
                  vibrate: [100, 50, 100],
                } as any);
              }).catch(() => {
                try { new Notification(title, { body, icon }); } catch (e) {}
              });
            } else {
              try { new Notification(title, { body, icon }); } catch (e) {}
            }
          }
        });
      } catch (e) {
        console.warn('[PushClient] Erro ao registrar listener de foreground FCM:', e);
      }
    }
  });
}

/**
 * Dispara uma notificação local no navegador + Banner no App
 */
export function triggerLocalNotification(title: string, body: string, icon = 'https://i.imgur.com/CxbCPR5.png') {
  if (typeof window === 'undefined') return;

  // Banner interno no App
  window.dispatchEvent(new CustomEvent('app-push-notification', {
    detail: { title, body, icon }
  }));

  // Notificação nativa do SO/Navegador
  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          vibrate: [100, 50, 100],
        } as any);
      }).catch(() => {
        try { new Notification(title, { body, icon }); } catch (e) {}
      });
    } else {
      try { new Notification(title, { body, icon }); } catch (e) {}
    }
  }
}

/**
 * Verifica se o navegador atual suporta notificações push
 */
export async function checkPushSupport(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    const supported = await isSupported();
    return supported;
  } catch (e) {
    return false;
  }
}

/**
 * Obtém o status atual de permissão de notificação
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export interface RegisterPushOptions {
  playerId?: string;
  playerName?: string;
  whatsapp?: string;
}

/**
 * Solicita permissão de notificação, obtém o token FCM e envia ao nosso backend vinculando ao Atleta
 */
export async function requestPermissionAndRegister(options?: RegisterPushOptions): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone;

    // No iOS (Safari), as notificações Push só são ativadas se o app estiver instalado na Tela de Início (PWA)
    if (isIOS && !isStandalone) {
      return {
        success: false,
        error: 'No iPhone/iPad (iOS), toque no botão de Compartilhar do Safari (📤) e escolha "Adicionar à Tela de Início" para habilitar as notificações push.'
      };
    }

    const isSupportedBrowser = await checkPushSupport();
    if (!isSupportedBrowser) {
      return { success: false, error: 'Este navegador ou dispositivo não suporta notificações Push ou o PWA precisa ser instalado.' };
    }

    // Solicitar permissão nativa do navegador
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permissão para notificações foi negada pelo usuário no navegador.' };
    }

    // Obter ou registrar o Service Worker do Firebase
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js').catch(() => undefined);
      if (!registration) {
        registration = await navigator.serviceWorker.ready.catch(() => undefined);
      }
    }

    if (!registration) {
      return { success: false, error: 'Service Worker não pôde ser ativado no dispositivo.' };
    }

    const messaging = getMessaging(app);
    
    // Obter token FCM usando o Service Worker já registrado e a chave VAPID
    const fcmToken = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: VAPID_KEY
    });

    if (!fcmToken) {
      return { success: false, error: 'Não foi possível gerar o token do dispositivo Firebase.' };
    }

    // Detectar plataforma / dispositivo de forma amigável
    let platform = 'Web';
    if (/Android/i.test(ua)) platform = 'Android';
    else if (isIOS) platform = 'iPhone/iOS';
    else if (/Macintosh/i.test(ua)) platform = 'Mac';
    else if (/Windows/i.test(ua)) platform = 'Windows';

    const pName = options?.playerName || localStorage.getItem('fcm_player_name') || '';
    const pWhatsapp = options?.whatsapp || localStorage.getItem('fcm_whatsapp') || '';
    const pId = options?.playerId || localStorage.getItem('fcm_player_id') || '';

    const deviceInfoObj = {
      platform,
      os: platform,
      browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Navegador PWA',
      playerName: pName,
      whatsapp: pWhatsapp,
      playerId: pId
    };

    // Registrar o token no nosso backend (que por sua vez salva no Supabase)
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fcmToken,
        deviceInfo: JSON.stringify(deviceInfoObj),
        playerId: pId || undefined,
        playerName: pName || undefined,
        whatsapp: pWhatsapp || undefined
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Erro ao registrar token no servidor.' };
    }

    // Salvar token e status localmente no localStorage para verificações futuras
    localStorage.setItem('fcm_token', fcmToken);
    localStorage.setItem('fcm_permission_granted', 'true');
    localStorage.setItem('pwa_device_linked', 'true');
    if (pName) localStorage.setItem('fcm_player_name', pName);
    if (pWhatsapp) localStorage.setItem('fcm_whatsapp', pWhatsapp);
    if (pId) localStorage.setItem('fcm_player_id', pId);

    return { success: true, token: fcmToken };
  } catch (err: any) {
    console.error('[PushClient] Erro ao registrar notificações push:', err);
    return { success: false, error: err.message || 'Erro desconhecido ao ativar notificações.' };
  }
}

/**
 * Executado ao abrir o app para atualizar o token se tiver mudado
 */
export async function syncTokenOnStartup(): Promise<void> {
  try {
    const isSupportedBrowser = await checkPushSupport();
    if (!isSupportedBrowser) return;

    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) return;

      const messaging = getMessaging(app);
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY
      });

      if (currentToken) {
        console.log('[PushClient] Sincronizando FCM Token com o backend...');
        
        let platform = 'Web';
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) platform = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iPhone/iOS';
        else if (/Macintosh/i.test(ua)) platform = 'Mac';
        else if (/Windows/i.test(ua)) platform = 'Windows';

        const pName = localStorage.getItem('fcm_player_name') || '';
        const pWhatsapp = localStorage.getItem('fcm_whatsapp') || '';
        const pId = localStorage.getItem('fcm_player_id') || '';

        const deviceInfoObj = {
          platform,
          os: platform,
          browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Navegador PWA',
          playerName: pName,
          whatsapp: pWhatsapp,
          playerId: pId
        };

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            fcmToken: currentToken, 
            deviceInfo: JSON.stringify(deviceInfoObj),
            playerId: pId || undefined,
            playerName: pName || undefined,
            whatsapp: pWhatsapp || undefined
          })
        });

        localStorage.setItem('fcm_token', currentToken);
      }
    }
  } catch (err) {
    console.warn('[PushClient] Erro ao sincronizar token no startup:', err);
  }
}
