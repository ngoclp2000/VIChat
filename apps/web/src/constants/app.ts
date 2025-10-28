import type { StickerPayload } from '@vichat/shared';

export const deviceInfo = { id: 'web-demo-device', platform: 'web' as const };

export const loginScopes = ['messages:write', 'presence:write'] as const;

export const stickerCatalog: StickerPayload[] = [
  {
    id: 'sticker:thumbs_up',
    name: 'Tuyệt vời',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png'
  },
  {
    id: 'sticker:rocket',
    name: 'Tăng tốc',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png'
  },
  {
    id: 'sticker:party',
    name: 'Ăn mừng',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png'
  },
  {
    id: 'sticker:coffee',
    name: 'Cà phê',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2615.png'
  }
];

export const emojiPalette = [
  '😀',
  '😁',
  '😂',
  '🤣',
  '😊',
  '😍',
  '🤩',
  '🤔',
  '🙌',
  '👍',
  '🙏',
  '🎉',
  '🚀',
  '❤️',
  '🔥',
  '🥳',
  '😎',
  '🤖',
  '💡',
  '📞'
] as const;

export const SESSION_STORAGE_KEY = 'vichat.session';

export const THEME_STORAGE_KEY = 'vichat.theme';
