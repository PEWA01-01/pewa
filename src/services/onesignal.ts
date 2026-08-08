// OneSignal Push Notification Service for PEWA
// App ID: 26477179-8f1d-49f5-8428-389a75eafeaf

const ONESIGNAL_APP_ID = '26477179-8f1d-49f5-8428-389a75eafeaf';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

let isInitialized = false;

export function initOneSignal(): Promise<void> {
  return new Promise((resolve) => {
    if (isInitialized || typeof window === 'undefined') {
      resolve();
      return;
    }

    // Load OneSignal SDK script asynchronously if not already present
    if (!document.getElementById('onesignal-sdk')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.async = true;
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false,
          },
        });
        isInitialized = true;
        console.log('[OneSignal] Initialized successfully with App ID:', ONESIGNAL_APP_ID);
        resolve();
      } catch (err) {
        console.warn('[OneSignal] Initialization note:', err);
        resolve();
      }
    });
  });
}

export async function loginOneSignalUser(userId: string): Promise<string | null> {
  try {
    await initOneSignal();
    if (window.OneSignal) {
      if (typeof window.OneSignal.login === 'function') {
        await window.OneSignal.login(userId);
      } else if (window.OneSignal.User && typeof window.OneSignal.User.login === 'function') {
        await window.OneSignal.User.login(userId);
      }
      
      const subscriptionId = window.OneSignal.User?.PushSubscription?.id || null;
      console.log(`[OneSignal] Logged in user ${userId}, Subscription ID:`, subscriptionId);
      return subscriptionId;
    }
  } catch (err) {
    console.warn('[OneSignal] Login user note:', err);
  }
  return null;
}

export async function requestOneSignalPushPermission(): Promise<boolean> {
  try {
    await initOneSignal();
    if (window.OneSignal) {
      if (window.OneSignal.Notifications && typeof window.OneSignal.Notifications.requestPermission === 'function') {
        const permission = await window.OneSignal.Notifications.requestPermission();
        return permission === 'granted';
      }
    }
    // Fallback native Notification permission
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
  } catch (err) {
    console.warn('[OneSignal] Request permission note:', err);
  }
  return false;
}

export interface PushPayload {
  targetUserIds: string[];
  title: string;
  message: string;
  senderName?: string;
  senderAvatar?: string;
  data?: Record<string, any>;
}

export async function sendOneSignalPushNotification(payload: PushPayload): Promise<boolean> {
  if (!payload.targetUserIds || payload.targetUserIds.length === 0) return false;

  console.log("SENDING ONESIGNAL");

  // Trigger foreground browser notification if tab/client is active
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(payload.title, {
        body: payload.message,
        icon: payload.senderAvatar || '/icon.png',
        data: payload.data,
      });
    }
  } catch (e) {
    // ignore
  }

  // Dispatch via OneSignal REST API
  try {
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: payload.targetUserIds,
        headings: { en: payload.title },
        contents: { en: payload.message },
        large_icon: payload.senderAvatar,
        data: payload.data || {},
      }),
    });

    if (res.ok) {
      console.log('[OneSignal] Push REST dispatch succeeded');
      return true;
    } else {
      const errText = await res.text();
      console.warn("ONESIGNAL FAILED - MESSAGE ALREADY DELIVERED", errText);
    }
  } catch (err) {
    console.warn("ONESIGNAL FAILED - MESSAGE ALREADY DELIVERED", err);
  }

  return false;
}
