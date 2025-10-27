import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatKit from '@vichat/sdk';
import type { ConversationDescriptor, MessagePayload } from '@vichat/shared';
import './App.css';

const tenantId = 'tenant-demo';
const clientId = 'demo-app';
const userId = 'user:demo';
const deviceInfo = { id: 'web-demo-device', platform: 'web' as const };

const bootstrapConversations = [
  {
    type: 'dm' as const,
    members: ['user:support'],
    name: 'Đội hỗ trợ'
  }
];

function getConversationInitials(conversation: ConversationDescriptor): string {
  if (conversation.name) {
    const parts = conversation.name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    }
    return conversation.name.slice(0, 2).toUpperCase();
  }

  return conversation.id.slice(-2).toUpperCase();
}

export default function App() {
  const [chat, setChat] = useState<ChatKit>();
  const [accessToken, setAccessToken] = useState('');
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [status, setStatus] = useState('disconnected');
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationDescriptor[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newConversationMembers, setNewConversationMembers] = useState('');
  const [newConversationType, setNewConversationType] = useState<'dm' | 'group'>('dm');
  const [newConversationName, setNewConversationName] = useState('');

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return conversations.find((item) => item.id === selectedConversationId) ?? null;
  }, [conversations, selectedConversationId]);

  const upsertMessage = useCallback((incoming?: MessagePayload | null) => {
    if (!incoming || !incoming.id) return;

    setMessages((prev) => {
      const index = prev.findIndex((item) => item.id === incoming.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...prev[index], ...incoming };
        return next;
      }

      return [...prev, incoming];
    });
  }, []);

  const handleError = useCallback((err: Error) => {
    console.error('[VIChat] realtime error', err);
    setError('Không thể duy trì kết nối realtime. Vui lòng kiểm tra backend.');
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    let isMounted = true;
    let cleanupListeners: (() => void) | undefined;

    async function fetchAccessToken() {
      const response = await fetch('http://localhost:4000/v1/auth/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          clientId,
          tenantId,
          userId,
          scopes: ['messages:write', 'presence:write']
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to obtain access token');
      }

      const payload = (await response.json()) as { accessToken: string };
      return payload.accessToken;
    }

    async function bootstrap() {
      setStatus('connecting');
      setError(null);

      try {
        const token = await fetchAccessToken();
        if (!isMounted) return;

        setAccessToken(token);

        const instance = await ChatKit.init({
          tenantId,
          clientId,
          token,
          device: deviceInfo,
          realtimeUrl: 'ws://localhost:4000/realtime'
        });

        if (!isMounted) {
          return;
        }

        instance.on('state', setStatus);
        instance.on('error', handleError);
        cleanupListeners = () => {
          instance.off('state', setStatus);
          instance.off('error', handleError);
        };

        const initResponse = await fetch('http://localhost:4000/v1/clients/init', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            device: deviceInfo,
            bootstrapConversations
          })
        });

        if (!initResponse.ok) {
          const message = await initResponse.text();
          throw new Error(message || 'Unable to register client');
        }

        const payload = (await initResponse.json()) as {
          conversations: ConversationDescriptor[];
        };

        if (!isMounted) return;

        setChat(instance);
        const sorted = payload.conversations.slice().sort((left, right) => {
          const l = left.updatedAt ?? left.createdAt ?? '';
          const r = right.updatedAt ?? right.createdAt ?? '';
          return r.localeCompare(l);
        });
        setConversations(sorted);
        setSelectedConversationId((prev) => prev ?? sorted[0]?.id ?? null);
      } catch (err) {
        console.error('[VIChat] bootstrap failed', err);
        if (!isMounted) return;
        cleanupListeners?.();
        cleanupListeners = undefined;
        setStatus('disconnected');
        setError('Không thể khởi tạo client demo. Hãy chắc chắn backend đang chạy ở cổng 4000 và MongoDB khả dụng.');
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
      cleanupListeners?.();
    };
  }, [handleError]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chat || !selectedConversation) {
      setMessages([]);
      return;
    }

    let detach: (() => void) | undefined;

    const messageListener = (message: MessagePayload) => {
      if (message.conversationId === selectedConversation.id) {
        upsertMessage(message);
      }
    };

    const attach = async () => {
      setMessages([]);
      const handle = await chat.conversationsOpen(selectedConversation);
      handle.on('message', messageListener);
      detach = () => {
        handle.off('message', messageListener);
      };
    };

    void attach();

    return () => {
      if (detach) {
        detach();
      }
    };
  }, [chat, selectedConversation, upsertMessage]);

  const sendMessage = useCallback(async () => {
    if (!chat || !draft.trim() || !selectedConversation) return;
    const message = await chat.sendText(selectedConversation, draft);
    upsertMessage(message);
    setDraft('');
  }, [chat, draft, selectedConversation, upsertMessage]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const toggleSidebar = () => setSidebarOpen((value) => !value);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCreateConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setError('Không tìm thấy token truy cập.');
      return;
    }

    const members = newConversationMembers
      .split(',')
      .map((member) => member.trim())
      .filter(Boolean);

    if (!members.length) {
      setError('Hãy nhập ít nhất một thành viên cho cuộc trò chuyện mới.');
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/v1/conversations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          type: newConversationType,
          members,
          name: newConversationType === 'group' ? newConversationName || undefined : undefined
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to create conversation');
      }

      const conversation = (await response.json()) as ConversationDescriptor;
      setConversations((prev) => {
        const next = prev.filter((item) => item.id !== conversation.id);
        return [conversation, ...next];
      });
      setSelectedConversationId(conversation.id);
      setNewConversationMembers('');
      setNewConversationName('');
      setError(null);
      setSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create conversation', err);
      setError('Không thể tạo cuộc trò chuyện mới. Kiểm tra kết nối backend.');
    }
  };

  const currentConversationLabel = selectedConversation?.name ?? selectedConversation?.id ?? 'Chưa chọn cuộc trò chuyện';
  const currentConversationMeta = selectedConversation
    ? `${selectedConversation.type === 'group' ? 'Nhóm' : '1 vs 1'} · ${selectedConversation.members.length} thành viên`
    : 'Chọn một cuộc trò chuyện hoặc tạo mới';

  return (
    <div className="app">
      <div className="top-bar">
        <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle conversations">
          ☰
        </button>
        <div className="top-meta">
          <h1>VIChat</h1>
          <span className={`status status-${status}`}>{status}</span>
        </div>
        <div className="user-pill">
          <span className="avatar" aria-hidden>
            🛡️
          </span>
          <span className="user-details">
            <strong>{userId}</strong>
            <small>{deviceInfo.id}</small>
          </span>
        </div>
      </div>

      <div className={`layout ${sidebarOpen ? 'layout--sidebar-open' : ''}`}>
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
                  onClick={() => {
                    setSelectedConversationId(conversation.id);
                    setSidebarOpen(false);
                  }}
                >
                  <div className="conversation-avatar" aria-hidden>
                    <span>{getConversationInitials(conversation)}</span>
                  </div>
                  <div className="conversation-body">
                    <div className="conversation-title">{conversation.name ?? conversation.id}</div>
                    <div className="conversation-snippet">{conversation.type === 'group' ? 'Nhóm' : '1 vs 1'}</div>
                  </div>
                  <span className="presence online">●</span>
                </li>
              );
            })}
            {!conversations.length && <li className="conversation-empty">Chưa có cuộc trò chuyện nào.</li>}
          </ul>

          <form className="conversation-form" onSubmit={handleCreateConversation}>
            <h3>Tạo cuộc trò chuyện</h3>
            <label>
              Loại
              <select value={newConversationType} onChange={(event) => setNewConversationType(event.target.value as 'dm' | 'group')}>
                <option value="dm">1 vs 1</option>
                <option value="group">Nhóm</option>
              </select>
            </label>
            {newConversationType === 'group' && (
              <label>
                Tên nhóm
                <input
                  type="text"
                  value={newConversationName}
                  onChange={(event) => setNewConversationName(event.target.value)}
                  placeholder="Tên hiển thị"
                />
              </label>
            )}
            <label>
              Thành viên (phân tách bằng dấu phẩy)
              <input
                type="text"
                value={newConversationMembers}
                onChange={(event) => setNewConversationMembers(event.target.value)}
                placeholder="ví dụ: user:alice, user:bob"
              />
            </label>
            <button type="submit">Tạo mới</button>
          </form>
        </aside>
        {sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            onClick={toggleSidebar}
            aria-label="Đóng danh sách cuộc trò chuyện"
          />
        )}

        <main className="chat-panel">
          <header className="chat-header">
            <div className="chat-contact">
              <div className="chat-avatar" aria-hidden>
                <span>{selectedConversation ? getConversationInitials(selectedConversation) : 'VC'}</span>
              </div>
              <div>
                <h2>{currentConversationLabel}</h2>
                <p>{currentConversationMeta}</p>
              </div>
            </div>
            <div className="chat-meta">
              <span className="badge">Tenant: {tenantId}</span>
              {selectedConversation && <span className="badge">Conv: {selectedConversation.id}</span>}
            </div>
          </header>

          <section className="message-list" aria-live="polite">
            {error && <div className="connection-error">{error}</div>}
            {!messages.length && !error && (
              <div className="empty-state">
                <h3>Chưa có tin nhắn</h3>
                <p>Tạo tin nhắn đầu tiên của bạn trong cuộc trò chuyện này.</p>
              </div>
            )}
            {messages.map((message) => {
              const isMine = message.senderId === deviceInfo.id || message.senderDeviceId === deviceInfo.id;
              const ciphertext = message.body?.ciphertext ?? '';
              return (
                <article key={message.id} className={`bubble ${isMine ? 'bubble--out' : 'bubble--in'}`}>
                  <header>
                    <span className="bubble-author">{isMine ? 'Bạn' : message.senderId}</span>
                    <time>{formatTime(message.sentAt)}</time>
                  </header>
                  <p>{ciphertext || 'Tin nhắn trống'}</p>
                </article>
              );
            })}
            <div ref={messageEndRef} />
          </section>

          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer-meta">
              <span className="lock" aria-hidden>
                🔐
              </span>
              <span>Được bảo vệ bằng Signal Double Ratchet. Nhập tin nhắn để gửi ngay lập tức.</span>
            </div>
            <div className="composer-inputs">
              <textarea
                placeholder="Nhập tin nhắn E2EE..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                disabled={!chat || !selectedConversation}
              />
              <button type="submit" disabled={!draft.trim() || !selectedConversation}>
                Gửi
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
