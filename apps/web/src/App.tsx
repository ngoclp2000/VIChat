import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ChatKit from '@vichat/sdk';
import type { ConversationDescriptor, MessagePayload } from '@vichat/shared';
import './App.css';

function createMockConversation(): ConversationDescriptor {
  return {
    id: 'conv-demo',
    type: 'dm',
    tenantId: 'tenant-demo',
    members: ['user:demo']
  };
}

const currentDeviceId = 'web-demo-device';

export default function App() {
  const [chat, setChat] = useState<ChatKit>();
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [status, setStatus] = useState('disconnected');
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const conversation = useMemo(createMockConversation, []);

  useEffect(() => {
    async function bootstrap() {
      const instance = await ChatKit.init({
        tenantId: 'tenant-demo',
        clientId: 'demo-app',
        token: 'demo-token',
        device: {
          id: currentDeviceId,
          platform: 'web'
        },
        realtimeUrl: 'ws://localhost:4000/realtime'
      });

      instance.on('state', setStatus);
      instance.on('message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      const handle = await instance.conversationsOpen(conversation);
      handle.on('message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      setChat(instance);
    }

    void bootstrap();
  }, [conversation]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!chat || !draft.trim()) return;
    const message = await chat.sendText(conversation, draft);
    setMessages((prev) => [...prev, message]);
    setDraft('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const toggleSidebar = () => setSidebarOpen((value) => !value);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app">
      <div className="top-bar">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle conversations"
        >
          ☰
        </button>
        <div className="top-meta">
          <h1>VIChat</h1>
          <span className={`status status-${status}`}>{status}</span>
        </div>
        <div className="user-pill">
          <span className="avatar" aria-hidden>🛡️</span>
          <span className="user-details">
            <strong>Bạn</strong>
            <small>{currentDeviceId}</small>
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
            <li className="conversation active" onClick={() => setSidebarOpen(false)}>
              <div className="conversation-avatar" aria-hidden>
                <span>AC</span>
              </div>
              <div className="conversation-body">
                <div className="conversation-title">Acme Corp</div>
                <div className="conversation-snippet">
                  Trạng thái: <strong>{status}</strong>
                </div>
              </div>
              <span className="presence online">●</span>
            </li>
            <li className="conversation" onClick={() => setSidebarOpen(false)}>
              <div className="conversation-avatar" aria-hidden>
                <span>DK</span>
              </div>
              <div className="conversation-body">
                <div className="conversation-title">Đối tác K</div>
                <div className="conversation-snippet">Tin nhắn E2EE đã bật</div>
              </div>
              <span className="presence offline">●</span>
            </li>
          </ul>
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
                <span>AC</span>
              </div>
              <div>
                <h2>Acme Corp</h2>
                <p>Tương tác đa thiết bị với E2EE</p>
              </div>
            </div>
            <div className="chat-meta">
              <span className="badge">Tenant: tenant-demo</span>
              <span className="badge">Conv: {conversation.id}</span>
            </div>
          </header>

          <section className="message-list" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty-state">
                <h3>Hãy bắt đầu cuộc trò chuyện bảo mật</h3>
                <p>
                  Tin nhắn sẽ được mã hóa đầu cuối và đồng bộ thời gian thực giữa mọi thiết bị của
                  bạn.
                </p>
              </div>
            )}
            {messages.map((message) => {
              const isMine = message.senderId === currentDeviceId;
              return (
                <article key={message.id} className={`bubble ${isMine ? 'bubble--out' : 'bubble--in'}`}>
                  <header>
                    <span className="bubble-author">{isMine ? 'Bạn' : message.senderId}</span>
                    <time>{formatTime(message.sentAt)}</time>
                  </header>
                  <p>{message.body.ciphertext}</p>
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
              <span>
                Được bảo vệ bằng Signal Double Ratchet. Nhập tin nhắn để gửi ngay lập tức.
              </span>
            </div>
            <div className="composer-inputs">
              <textarea
                placeholder="Nhập tin nhắn E2EE..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
              />
              <button type="submit" disabled={!draft.trim()}>
                Gửi
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
