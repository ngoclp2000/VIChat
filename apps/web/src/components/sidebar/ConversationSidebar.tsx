import { MessageCirclePlus, ShieldCheck } from 'lucide-react';

import { getConversationInitials } from '../../utils/chat';
import type { ConversationView } from '../../types/app';

interface ConversationSidebarProps {
  conversations: ConversationView[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onOpenUserManager: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function ConversationSidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  onOpenUserManager,
  isAuthenticated,
  isAdmin
}: ConversationSidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h2>Cuộc trò chuyện</h2>
        <span className="hint">Multi-tenant demo</span>
      </header>
      <ul className="conversation-list">
        {conversations.map((conversation) => {
          const active = conversation.id === selectedConversationId;
          return (
            <li
              key={conversation.id}
              className={`conversation ${active ? 'active' : ''}`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="conversation-avatar" aria-hidden>
                <span>{getConversationInitials(conversation)}</span>
              </div>
              <div className="conversation-body">
                <div className="conversation-title">{conversation.name ?? conversation.id}</div>
                <div className="conversation-snippet">
                  {conversation.lastMessageSnippet ?? (conversation.type === 'group' ? 'Nhóm' : '1 vs 1')}
                </div>
              </div>
              {conversation.unreadCount > 0 && (
                <span className="conversation-unread">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>
              )}
            </li>
          );
        })}
        {!conversations.length && <li className="conversation-empty">Chưa có cuộc trò chuyện nào.</li>}
      </ul>

      <div className="sidebar-actions">
        <button type="button" className="new-conversation-button" onClick={onCreateConversation} disabled={!isAuthenticated}>
          <MessageCirclePlus size={18} aria-hidden />
          <span>Tạo cuộc trò chuyện</span>
        </button>
        {isAuthenticated && isAdmin && (
          <button type="button" className="manage-users-button" onClick={onOpenUserManager}>
            <ShieldCheck size={18} aria-hidden />
            <span>Quản lý người dùng</span>
          </button>
        )}
        {!isAuthenticated && (
          <small className="sidebar-hint">Đăng nhập để bắt đầu cuộc trò chuyện mới.</small>
        )}
      </div>
    </aside>
  );
}
