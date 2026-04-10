import { useState, useEffect } from 'react';
import { api } from '../api/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const subscribe = async () => {
    if (!supported) return;
    setError(null);
    setLoading(true);

    try {
      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied');
        return;
      }

      // Register SW and wait until it is active
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;

      // Fetch VAPID public key from server
      const { publicKey } = await api.push.vapidKey();
      if (!publicKey) {
        setError('Push notifications are not configured on the server (missing VAPID key)');
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const rawSub = subscription.toJSON();
      const keys = rawSub.keys as { p256dh?: string; auth?: string } | undefined;
      if (!rawSub.endpoint || !keys?.p256dh || !keys?.auth) {
        setError('Failed to read subscription keys');
        return;
      }

      await api.push.subscribe({
        endpoint: rawSub.endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      });

      setSubscribed(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable push notifications';
      setError(message);
      console.error('Push subscription failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.push.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
        setSubscribed(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable push notifications';
      setError(message);
      console.error('Unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return { supported, subscribed, loading, error, subscribe, unsubscribe };
}
