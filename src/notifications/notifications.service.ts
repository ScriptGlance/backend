import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ANDROID_NOTIFICATION_CHANNEL_ID } from '../common/Constants';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor() {
    if (!admin.apps.length) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
  ): Promise<string | null> {
    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      android: {
        notification: {
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
        },
      },
    };
    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`Sent notification: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending notification', error);
      return null;
    }
  }
}
