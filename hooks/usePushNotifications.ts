import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export interface PushNotificationState {
  expoPushToken?: string;
  notification?: Notifications.Notification;
}

export function usePushNotifications(): PushNotificationState {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
      if (token) {
        schedulePeriodicReminder();
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      setNotification(n);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
      console.log('Notification response:', r.notification.request.content.data);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  await Notifications.setAutoServerRegistrationEnabledAsync(false);

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted.');
    return undefined;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error("PUSH_DEBUG: EAS projectId bulunamadı — app.json -> extra -> eas -> projectId eksik!");
    }
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    console.log('Expo Push Token:', tokenData.data);

    if (Platform.OS === 'android') {
      const createdChannel = await Notifications.setNotificationChannelAsync('capshion_sound_v5', {
        name: 'Capshion Özel Bildirimler',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'capshion_sound',
        lightColor: '#8B5CF6',
      });
      console.log("PUSH_DEBUG: Kanal oluşturuldu:", JSON.stringify(createdChannel));
      const allChannels = await Notifications.getNotificationChannelsAsync();
      console.log("PUSH_DEBUG: Tüm kanallar:", JSON.stringify(allChannels));
    }

    return tokenData.data;
  } catch (err) {
    console.error("PUSH_DEBUG:", err);
    return undefined;
  }
}

export async function schedulePeriodicReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Bugün Ne Paylaşacaksın? 📸",
      body: "Yeni fotoğrafların için en trend açıklama metinlerini oluşturma zamanı!",
      sound: "capshion_sound",
      data: { type: "reminder" },
      channelId: "capshion_sound_v5",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 24 * 3,
      repeats: true,
    },
  });
}
