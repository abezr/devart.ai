import { Env } from '../index';

/**
 * Response interface for Telegram API calls
 */
interface TelegramResponse {
  success: boolean;
  error?: string;
}

/**
 * Sends a message to a Telegram chat using the Bot API
 * 
 * @param env - Cloudflare Workers environment containing Telegram credentials
 * @param message - The message text to send (supports Markdown formatting)
 * @returns Promise resolving to success status and optional error
 */
export async function sendTelegramMessage(env: Env, message: string): Promise<TelegramResponse> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error('Telegram environment variables are not set.');
    return { success: false, error: 'Telegram credentials not configured' };
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseData: any = await response.json();
    if (!responseData.ok) {
      console.error('Telegram API Error:', responseData);
      return { success: false, error: `Telegram API error: ${responseData.description}` };
    }
    
    console.log('Telegram message sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return { success: false, error: `Network error: ${error}` };
  }
}