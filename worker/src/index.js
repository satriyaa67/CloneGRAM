import { createApp } from './app.js';
import { createD1Store } from './storage/d1.js';
import { createTelegramClient } from './telegram/client.js';

export default {
  async fetch(request, env) {
    let client;
    const app = createApp({
      env,
      store: createD1Store(env.DB),
      telegram: () => (client ??= createTelegramClient({ token: env.TELEGRAM_BOT_TOKEN })),
    });
    return app(request);
  },
};
