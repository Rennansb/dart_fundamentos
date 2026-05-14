import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type NotificationType = 'INFO' | 'WARNING' | 'CRITICAL';

export interface NotificationPayload {
  companyId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  senderId?: string; // e.g. customer phone
  groupingKey?: string; // e.g. 'whatsapp_message'
}

export const notificationService = {
  async send(payload: NotificationPayload) {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...payload,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to push notification:", error);
    }
  },

  info(companyId: string, title: string, message: string, link?: string, senderId?: string, groupingKey?: string) {
    return this.send({ companyId, title, message, type: 'INFO', link, senderId, groupingKey });
  },

  warning(companyId: string, title: string, message: string, link?: string) {
    return this.send({ companyId, title, message, type: 'WARNING', link });
  },

  critical(companyId: string, title: string, message: string, link?: string) {
    return this.send({ companyId, title, message, type: 'CRITICAL', link });
  }
};
