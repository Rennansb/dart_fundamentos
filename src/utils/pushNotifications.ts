import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

const VAPID_PUBLIC_KEY = 'BA_REPLACE_WITH_ACTUAL_VAPID_KEY_LATER'; // Placeholder if needed

export async function requestNotificationPermission(userId: string) {
  if (!('Notification' in window)) {
    console.warn('Este browser não suporta notificações nativas.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Permissão para notificações concedida.');
      
      // Optionally subscribe to PushManager if implementing Web Push
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Example logic for Push Subscription (FCM or VAPID)
        // const subscription = await registration.pushManager.subscribe({
        //  userVisibleOnly: true,
        //  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        // });
        
        // In a real app, save the subscription object to the user's document
        // await saveSubscription(userId, subscription);
      }

      // We just return true for now since the SW handles incoming generic updates
      return true;
    } else {
      console.warn('Permissão para notificações negada.');
      return false;
    }
  } catch (error) {
    console.error('Erro ao pedir permissão de notificações:', error);
    return false;
  }
}

// Utility for sending local test notifications
export async function sendLocalNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      icon: '/logo.png',
      badge: '/logo.png',
      ...options
    });
  }
}
