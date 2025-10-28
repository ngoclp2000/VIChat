import { type ChangeEvent, type FormEvent, type RefObject } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Lock, Send, Smile, Sparkles, Trash2, User } from 'lucide-react';

import type { MessagePayload, StickerPayload } from '@vichat/shared';

import { formatTime, getConversationInitials } from '../../utils/chat';
import type { StickerList, TenantOption } from '../../types/app';

interface ChatPanelProps {
  selectedConversation: { id: string; name?: string; type: 'group' | 'dm'; members: string[] } | null;
  currentConversationLabel: string;
  currentConversationMeta: string;
  activeTenant: TenantOption | null;
  error: string | null;
  isLoadingMessages: boolean;
  messages: MessagePayload[];
  sessionUser: { userId: string } | null;
  messageEndRef: RefObject<HTMLDivElement>;
  composerInputRef: RefObject<HTMLTextAreaElement>;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSendMessage: () => Promise<void> | void;
  canSendMessage: boolean;
  isAuthenticated: boolean;
  chatReady: boolean;
  showStickers: boolean;
  showEmojiPicker: boolean;
  onToggleStickers: () => void;
  onToggleEmoji: () => void;
  onClosePickers: () => void;
  onSendSticker: (sticker: StickerPayload) => Promise<void> | void;
  stickers: StickerList;
  emojiPalette: readonly string[];
}

export function ChatPanel({
  selectedConversation,
  currentConversationLabel,
  currentConversationMeta,
  activeTenant,
  error,
  isLoadingMessages,
  messages,
  sessionUser,
  messageEndRef,
  composerInputRef,
  draft,
  onDraftChange,
  onSubmit,
  onSendMessage,
  canSendMessage,
  isAuthenticated,
  chatReady,
  showStickers,
  showEmojiPicker,
  onToggleStickers,
  onToggleEmoji,
  onClosePickers,
  onSendSticker,
  stickers,
  emojiPalette
}: ChatPanelProps) {
  const canInteract = Boolean(chatReady && selectedConversation && isAuthenticated);

  const avatarLabel = selectedConversation ? getConversationInitials(selectedConversation) : 'VC';

  const canClearDraft = Boolean(draft);

  return (
    <main className="chat-panel">
      <header className="chat-header">
        <div className="chat-contact">
          <div className="chat-avatar" aria-hidden>
            <span>{avatarLabel}</span>
          </div>
          <div>
            <h2>{currentConversationLabel}</h2>
            <p>{currentConversationMeta}</p>
          </div>
        </div>
        <div className="chat-meta">
          <span className="badge">
            Tenant: {activeTenant ? `${activeTenant.label} (${activeTenant.value})` : 'Chưa chọn'}
          </span>
          {selectedConversation && <span className="badge">Conv: {selectedConversation.id}</span>}
        </div>
      </header>

      <section className="message-list" aria-live="polite">
        {error && <div className="connection-error">{error}</div>}
        {isLoadingMessages && !error && <div className="message-loading">Đang tải tin nhắn...</div>}
        {!messages.length && !error && !isLoadingMessages && (
          <div className="empty-state">
            <h3>Chưa có tin nhắn</h3>
            <p>Tạo tin nhắn đầu tiên của bạn trong cuộc trò chuyện này.</p>
          </div>
        )}
        {messages.map((message) => {
          const isMine = sessionUser?.userId === message.senderId;
          const ciphertext = message.body?.ciphertext ?? '';
          const isSticker = message.type === 'sticker' && message.sticker;
          const bubbleClass = `bubble ${isMine ? 'bubble--out' : 'bubble--in'}${isSticker ? ' bubble--sticker' : ''}`;
          return (
            <article key={message.id} className={bubbleClass}>
              <header>
                <span className="bubble-author">{isMine ? 'Bạn' : message.senderId || <User size={12} />}</span>
                <time>{formatTime(message.sentAt)}</time>
              </header>
              {isSticker && message.sticker ? (
                <div className="sticker-message">
                  <img src={message.sticker.url} alt={message.sticker.name ?? message.sticker.id} />
                  {message.sticker.name && <span>{message.sticker.name}</span>}
                </div>
              ) : (
                <p>{ciphertext || 'Tin nhắn trống'}</p>
              )}
            </article>
          );
        })}
        <div ref={messageEndRef} />
      </section>

      <form className="composer" onSubmit={onSubmit}>
        <div className="composer-meta">
          <span className="lock" aria-hidden>
            <Lock size={16} />
          </span>
          <span>Tin nhắn của bạn được mã hóa đầu cuối. Nhập nội dung và nhấn Enter để gửi ngay.</span>
        </div>
        <div className="composer-inputs">
          <TextareaAutosize
            className="composer-textarea"
            placeholder="Nhập tin nhắn của bạn..."
            value={draft}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDraftChange(event.target.value)}
            minRows={2}
            maxRows={6}
            disabled={!canInteract}
            ref={composerInputRef}
            onFocus={onClosePickers}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void onSendMessage();
              }
            }}
          />
          <div className="composer-actions">
            <div className="composer-quick">
              <button
                type="button"
                className={`composer-icon-button ${showEmojiPicker ? 'active' : ''}`}
                onClick={onToggleEmoji}
                aria-label="Chọn biểu tượng cảm xúc"
                disabled={!canInteract}
              >
                <Smile size={18} aria-hidden />
              </button>
              <button
                type="button"
                className={`composer-icon-button ${showStickers ? 'active' : ''}`}
                onClick={onToggleStickers}
                aria-label="Chọn nhãn dán"
                disabled={!canInteract}
              >
                <Sparkles size={18} aria-hidden />
              </button>
              <button
                type="button"
                className="composer-icon-button"
                onClick={() => onDraftChange('')}
                aria-label="Xóa nội dung đang nhập"
                disabled={!canClearDraft}
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
            <button type="submit" className="composer-send" disabled={!canSendMessage}>
              <Send size={18} aria-hidden />
              <span>Gửi</span>
            </button>
          </div>
        </div>

        {showEmojiPicker && (
          <div className="emoji-picker" role="menu">
            {emojiPalette.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onDraftChange(`${draft}${emoji}`);
                  onClosePickers();
                  composerInputRef.current?.focus();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {showStickers && (
          <div className="sticker-picker" role="menu">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => {
                  void onSendSticker(sticker);
                  onClosePickers();
                }}
              >
                <img src={sticker.url} alt={sticker.name ?? sticker.id} />
                <span>{sticker.name ?? sticker.id}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </main>
  );
}
