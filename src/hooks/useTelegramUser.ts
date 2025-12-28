import { useEffect, useState } from 'react';

export function useTelegramUser() {
  const [username, setUsername] = useState<string>('Guest');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.expand();

    const user = tg?.initDataUnsafe?.user;
    if (user) {
      setUsername(user.first_name);
    }
  }, []);

  return { username };
}
