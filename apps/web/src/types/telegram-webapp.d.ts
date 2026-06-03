/** Minimal typings for https://telegram.org/js/telegram-web-app.js */

export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand?: () => void;
        /** Raw signed string for POST /auth/telegram */
        initData: string;
        initDataUnsafe?: unknown;
      };
    };
  }
}
