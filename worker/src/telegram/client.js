export class TelegramApiError extends Error {
  constructor(method, code, description) {
    super(`Telegram ${method} failed (${code}): ${description}`);
    this.name = 'TelegramApiError';
    this.method = method;
    this.code = code;
    this.description = description;
  }
}

export class TelegramRateLimitError extends TelegramApiError {
  constructor(method, retryAfter, description) {
    super(method, 429, description);
    this.name = 'TelegramRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Minimal Bot API client. Errors never include the bot token.
 * 429 responses surface as TelegramRateLimitError so callers can wait `retryAfter` seconds.
 */
export function createTelegramClient({ token, fetchImpl = fetch, baseUrl = 'https://api.telegram.org' }) {
  if (!token) throw new Error('Telegram bot token is not configured');

  async function call(method, params = {}) {
    const response = await fetchImpl(`${baseUrl}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new TelegramApiError(method, response.status, 'Invalid JSON response');
    }
    if (body?.ok) return body.result;
    const code = body?.error_code ?? response.status;
    const description = body?.description ?? 'Unknown error';
    if (code === 429) {
      const retryAfter = Number(body?.parameters?.retry_after);
      throw new TelegramRateLimitError(method, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1, description);
    }
    throw new TelegramApiError(method, code, description);
  }

  return {
    call,
    getMe: () => call('getMe'),
    getChat: (chatId) => call('getChat', { chat_id: chatId }),
    getChatMember: (chatId, userId) => call('getChatMember', { chat_id: chatId, user_id: userId }),
    setWebhook: (options) => call('setWebhook', options),
    getWebhookInfo: () => call('getWebhookInfo'),
    sendMessage: (chatId, text, options = {}) => call('sendMessage', { chat_id: chatId, text, ...options }),
    copyMessage: (chatId, fromChatId, messageId, options = {}) => call('copyMessage', { chat_id: chatId, from_chat_id: fromChatId, message_id: messageId, ...options }),
    copyMessages: (chatId, fromChatId, messageIds, options = {}) => call('copyMessages', { chat_id: chatId, from_chat_id: fromChatId, message_ids: messageIds, ...options }),
  };
}
