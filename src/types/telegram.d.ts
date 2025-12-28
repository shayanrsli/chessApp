interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebApp {
  initDataUnsafe: {
    user?: TelegramUser;
  };
  expand: () => void;
  themeParams: {
    bg_color?: string;
    text_color?: string;
    button_color?: string;
  };
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
