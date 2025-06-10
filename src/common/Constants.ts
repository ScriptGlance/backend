export const PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES = 10;
export const AUTH_TOKEN_EXPIRATION_DAYS = 7;
export const EMAIL_VERIFICATION_CODE_EXPIRATION_MINUTES = 10;
export const VERIFICATION_CODE_LENGTH = 6;
export const DEFAULT_PRESENTATION_NAME = 'Виступ без назви';
export const DEFAULT_PRESENTATION_PART_NAME = 'Частина без назви';
export const GOLDEN_RATIO = 0.618033988749895;
export const FREE_VIDEOS_PER_PRESENTATION = 10;
export const TIME_TO_CONFIRM_PART_READING_SECONDS = 15;
export const WORDS_PER_MINUTE_MIN = 120;
export const WORDS_PER_MINUTE_MAX = 200;
export const MAX_FREE_RECORDING_TIME_SECONDS = 10 * 60;
export const VIDEO_DURATION_MAX_TAIL_SECONDS = 1;
export const MAX_FREE_PARTICIPANTS_COUNT = 3;
export const PREMIUM_PRICE_CENTS = 5 * 100;
export const MIN_PAYMENT_AMOUNT = 1;
export const USD_CURRENCY_CODE = 840;
export const UAH_CURRENCY_CODE = 980;
export const CHAT_EXPIRATION_TIME_SECONDS = 3 * 24 * 60 * 60;
export const HTTP_MODULE_TIMEOUT_MS = 5000;
export const WEBHOOK_PUBLIC_KEY_MIN_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
export const WEBHOOK_CACHE_EXPIRATION_TIME_MS = 60 * 1000;
export const SUBSCRIPTION_FAILURE_PAYMENT_RETRY_INTERVAL_MS =
  24 * 60 * 60 * 1000;
export const SUBSCRIPTION_FAILURE_PAYMENT_RETRY_COUNT = 3;
export const PAYMENT_API_REQUEST_INTERVAL_MS = 500;
export const PAYMENT_API_REQUEST_BATCH_SIZE = 15;
export const INVOICE_VALIDITY_SECONDS = 60 * 60;
export const ANDROID_NOTIFICATION_CHANNEL_ID = 'notification_channel';

export const NEW_CHAT_MESSAGE_NOTIFICATION_TITLE =
  'Нове повідомлення від підтримки';
export const CHAT_CLOSED_NOTIFICATION_TITLE = 'Дякуємо за звернення!';
export const CHAT_CLOSED_NOTIFICATION_BODY =
  'Якщо у вас є додаткові питання, будь ласка, напишіть нам знову';
export const WAITING_FOR_USER_NOTIFICATION_TITLE = 'На вас очікують';
export const NOTIFICATION_PART_NAME_PLACEHOLDER = '{partName}';
export const NOTIFICATION_PRESENTATION_NAME_PLACEHOLDER = '{presentationName}';
export const WAITING_FOR_USER_NOTIFICATION_BODY = `Ваша черга читати частину «${NOTIFICATION_PART_NAME_PLACEHOLDER}» у виступі «${NOTIFICATION_PRESENTATION_NAME_PLACEHOLDER}»`;
export const YOUR_PART_REASSIGNED_NOTIFICATION_TITLE =
  'Ваша частина була передана іншому учаснику';
export const YOUR_PART_REASSIGNED_NOTIFICATION_BODY = `Ваша частина «${NOTIFICATION_PART_NAME_PLACEHOLDER}» була передана іншому учаснику виступу «${NOTIFICATION_PRESENTATION_NAME_PLACEHOLDER}».`;
