import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select, { type MultiValue, type SingleValue } from 'react-select';
import ChatKit from '@vichat/sdk';
import type { ConversationDescriptor, MessagePayload, StickerPayload } from '@vichat/shared';
import './App.css';

const tenantId = 'tenant-demo';
const clientId = 'demo-app';
const deviceInfo = { id: 'web-demo-device', platform: 'web' as const };

interface TenantUserProfile {
  userId: string;
  displayName: string;
  roles: string[];
  status: 'active' | 'disabled';
  lastLoginAt?: string | null;
}

interface UserOption {
  value: string;
  label: string;
  roles: string[];
  status: 'active' | 'disabled';
  lastLoginAt?: string | null;
  [key: string]: unknown;
}

type ConversationView = ConversationDescriptor & {
  unreadCount: number;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
};

const loginScopes = ['messages:write', 'presence:write'];

const stickerCatalog: StickerPayload[] = [
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

function sortConversations(list: ConversationView[]): ConversationView[] {
  return list
    .slice()
    .sort((left, right) => {
      const l = left.lastMessageAt ?? left.updatedAt ?? left.createdAt ?? '';
      const r = right.lastMessageAt ?? right.updatedAt ?? right.createdAt ?? '';
      return r.localeCompare(l);
    });
}

function messageToSnippet(message: MessagePayload): string {
  if (message.type === 'sticker' && message.sticker) {
    return message.sticker.name ? `Nhãn dán: ${message.sticker.name}` : 'Đã gửi nhãn dán';
  }

  const ciphertext = message.body?.ciphertext ?? '';
  return ciphertext || 'Tin nhắn mới';
}

function truncate(text: string, maxLength = 60): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

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
  const [chat, setChat] = useState<ChatKit | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [status, setStatus] = useState('disconnected');
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedMemberOptions, setSelectedMemberOptions] = useState<UserOption[]>([]);
  const [newConversationType, setNewConversationType] = useState<'dm' | 'group'>('dm');
  const [newConversationName, setNewConversationName] = useState('');
  const [tenantUsers, setTenantUsers] = useState<TenantUserProfile[]>([]);
  const [showStickers, setShowStickers] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [loginSecret, setLoginSecret] = useState('');
  const [selectedLoginUser, setSelectedLoginUser] = useState<UserOption | null>(null);
  const [sessionUser, setSessionUser] = useState<{ userId: string; displayName: string; roles: string[] } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const userOptions = useMemo<UserOption[]>(
    () =>
      tenantUsers.map((user) => ({
        value: user.userId,
        label: user.displayName,
        roles: user.roles,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      })),
    [tenantUsers]
  );

  useEffect(() => {
    if (!selectedLoginUser) return;
    const next = userOptions.find((option) => option.value === selectedLoginUser.value);
    if (next) {
      setSelectedLoginUser(next);
    }
  }, [userOptions, selectedLoginUser?.value]);

  useEffect(() => {
    if (!sessionUser) return;
    const match = tenantUsers.find((user) => user.userId === sessionUser.userId);
    if (!match) return;
    const rolesChanged = match.roles.join('|') !== sessionUser.roles.join('|');
    if (match.displayName !== sessionUser.displayName || rolesChanged) {
      setSessionUser({ userId: match.userId, displayName: match.displayName, roles: match.roles });
    }
  }, [sessionUser, tenantUsers]);

  useEffect(() => {
    if (!authError) return;
    if (loginSecret || selectedLoginUser) {
      setAuthError(null);
    }
  }, [authError, loginSecret, selectedLoginUser]);

  const memberOptions = useMemo(
    () => userOptions.filter((option) => option.value !== sessionUser?.userId),
    [sessionUser?.userId, userOptions]
  );

  useEffect(() => {
    setSelectedMemberOptions((prev) =>
      prev.filter((option) => memberOptions.some((candidate) => candidate.value === option.value))
    );
  }, [memberOptions]);

  useEffect(() => {
    if (newConversationType === 'dm' && selectedMemberOptions.length > 1) {
      setSelectedMemberOptions((prev) => (prev.length ? [prev[0]!] : prev));
    }
  }, [newConversationType, selectedMemberOptions.length]);

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

  const applyMessageToConversation = useCallback(
    (message: MessagePayload, isActiveConversation: boolean) => {
      setConversations((prev) => {
        const index = prev.findIndex((item) => item.id === message.conversationId);
        if (index < 0) {
          return prev;
        }

        const current = prev[index];
        const snippet = truncate(messageToSnippet(message));
        const updated: ConversationView = {
          ...current,
          unreadCount: isActiveConversation ? 0 : current.unreadCount + 1,
          lastMessageSnippet: snippet,
          lastMessageAt: message.sentAt ?? current.lastMessageAt ?? current.updatedAt
        };

        const next = [...prev];
        next[index] = updated;
        return sortConversations(next);
      });
    },
    []
  );

  const handleError = useCallback((err: Error) => {
    console.error('[VIChat] realtime error', err);
    setError('Không thể duy trì kết nối realtime. Vui lòng kiểm tra backend.');
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDirectory() {
      try {
        const response = await fetch(
          `http://localhost:4000/v1/tenants/${tenantId}/users?clientId=${encodeURIComponent(clientId)}`
        );
        if (!response.ok) {
          throw new Error('Unable to load tenant directory');
        }
        const users = (await response.json()) as TenantUserProfile[];
        if (!cancelled) {
          setTenantUsers(users);
        }
      } catch (err) {
        console.warn('Không thể tải danh sách người dùng tenant', err);
      }
    }

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!chat) return;
    const listener = (message: MessagePayload) => {
      const isActive = selectedConversationId === message.conversationId;
      applyMessageToConversation(message, Boolean(isActive));
      if (isActive) {
        upsertMessage(message);
      }
    };
    chat.on('message', listener);
    return () => {
      chat.off('message', listener);
    };
  }, [chat, selectedConversationId, applyMessageToConversation, upsertMessage]);

  useEffect(() => {
    if (!selectedConversationId) return;
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              unreadCount: 0
            }
          : conversation
      )
    );
  }, [selectedConversationId]);

  useEffect(() => {
    if (!sessionUser || !accessToken) {
      setChat((prev) => {
        prev?.disconnect();
        return null;
      });
      setConversations([]);
      setSelectedConversationId(null);
      setMessages([]);
      setStatus('disconnected');
      return;
    }

    const activeUser = sessionUser;
    let isMounted = true;
    let cleanupListeners: (() => void) | undefined;
    let instance: ChatKit | null = null;

    async function bootstrap() {
      setStatus('connecting');
      setError(null);
      setMessages([]);

      try {
        const chatInstance = await ChatKit.init({
          tenantId,
          clientId,
          token: accessToken,
          device: deviceInfo,
          realtimeUrl: 'ws://localhost:4000/realtime'
        });

        if (!isMounted) {
          chatInstance.disconnect();
          return;
        }

        instance = chatInstance;
        chatInstance.on('state', setStatus);
        chatInstance.on('error', handleError);
        cleanupListeners = () => {
          chatInstance.off('state', setStatus);
          chatInstance.off('error', handleError);
        };

        setChat(chatInstance);

        const bootstrapConversations =
          activeUser.userId === 'user:support'
            ? []
            : [
                {
                  type: 'dm' as const,
                  members: ['user:support'],
                  name: 'Đội hỗ trợ'
                }
              ];

        const initResponse = await fetch('http://localhost:4000/v1/clients/init', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`
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

        const sorted = sortConversations(
          payload.conversations.map((conversation) => ({
            ...conversation,
            unreadCount: 0,
            lastMessageSnippet: conversation.type === 'group' ? 'Nhóm' : '1 vs 1',
            lastMessageAt: conversation.updatedAt ?? conversation.createdAt
          }))
        );

        setConversations(sorted);
        setSelectedConversationId(sorted[0]?.id ?? null);

        try {
          const usersResponse = await fetch(`http://localhost:4000/v1/tenants/${tenantId}/users`, {
            headers: {
              authorization: `Bearer ${accessToken}`
            }
          });

          if (usersResponse.ok) {
            const users = (await usersResponse.json()) as TenantUserProfile[];
            if (isMounted) {
              setTenantUsers(users);
            }
          }
        } catch (err) {
          console.warn('Không thể tải danh sách người dùng tenant', err);
        }
      } catch (err) {
        console.error('[VIChat] bootstrap failed', err);
        if (!isMounted) return;
        cleanupListeners?.();
        cleanupListeners = undefined;
        instance?.disconnect();
        instance = null;
        setChat(null);
        setStatus('disconnected');
        setError('Không thể khởi tạo client demo. Hãy chắc chắn backend đang chạy ở cổng 4000 và MongoDB khả dụng.');
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
      cleanupListeners?.();
      if (instance) {
        instance.disconnect();
      }
      setChat((prev) => (prev === instance ? null : prev));
    };
  }, [accessToken, sessionUser, handleError]);

  useEffect(() => {
    setShowStickers(false);

    if (!chat || !selectedConversation) {
      setMessages([]);
      return;
    }

    let detach: (() => void) | undefined;
    let cancelled = false;

    const attach = async () => {
      setMessages([]);
      setIsLoadingMessages(true);

      try {
        if (accessToken) {
          const historyResponse = await fetch(
            `http://localhost:4000/v1/conversations/${selectedConversation.id}/messages?limit=50`,
            {
              headers: {
                authorization: `Bearer ${accessToken}`
              }
            }
          );

          if (historyResponse.ok) {
            const history = (await historyResponse.json()) as MessagePayload[];
            if (!cancelled) {
              setMessages(history);
              const last = history[history.length - 1];
              if (last) {
                applyMessageToConversation(last, true);
              }
            }
          } else {
            console.warn('Không thể tải lịch sử tin nhắn');
          }
        }
      } catch (err) {
        console.warn('Lỗi tải lịch sử tin nhắn', err);
      } finally {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      }

      if (cancelled) return;

      const handle = await chat.conversationsOpen(selectedConversation);
      const messageListener = (message: MessagePayload) => {
        if (message.conversationId === selectedConversation.id) {
          upsertMessage(message);
        }
      };
      handle.on('message', messageListener);
      detach = () => {
        handle.off('message', messageListener as unknown as (...args: unknown[]) => void);
      };
    };

    void attach();

    return () => {
      cancelled = true;
      if (detach) {
        detach();
      }
    };
  }, [accessToken, chat, selectedConversation, upsertMessage, applyMessageToConversation]);

  const sendMessage = useCallback(async () => {
    if (!chat || !draft.trim() || !selectedConversation || !sessionUser) return;
    const message = await chat.sendText(selectedConversation, draft);
    upsertMessage(message);
    applyMessageToConversation(message, true);
    setDraft('');
    setShowStickers(false);
  }, [chat, draft, selectedConversation, sessionUser, upsertMessage, applyMessageToConversation]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleSendSticker = useCallback(
    async (sticker: StickerPayload) => {
      if (!chat || !selectedConversation || !sessionUser) return;
      const message = await chat.sendSticker(selectedConversation, sticker);
      upsertMessage(message);
      applyMessageToConversation(message, true);
      setShowStickers(false);
    },
    [chat, selectedConversation, sessionUser, upsertMessage, applyMessageToConversation]
  );

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

    const members = selectedMemberOptions.map((option) => option.value);

    if (newConversationType === 'dm' && members.length !== 1) {
      setError('Cuộc trò chuyện 1-1 cần chọn chính xác một thành viên.');
      return;
    }

    if (newConversationType === 'group' && members.length < 2) {
      setError('Hãy chọn ít nhất hai thành viên cho nhóm.');
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
      const enriched: ConversationView = {
        ...conversation,
        unreadCount: 0,
        lastMessageSnippet: conversation.type === 'group' ? 'Nhóm' : '1 vs 1',
        lastMessageAt: conversation.updatedAt ?? conversation.createdAt
      };
      setConversations((prev) => sortConversations([enriched, ...prev.filter((item) => item.id !== enriched.id)]));
      setSelectedConversationId(enriched.id);
      setSelectedMemberOptions([]);
      setNewConversationName('');
      setError(null);
      setSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create conversation', err);
      setError('Không thể tạo cuộc trò chuyện mới. Kiểm tra kết nối backend.');
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedLoginUser) {
      setAuthError('Hãy chọn người dùng để đăng nhập.');
      return;
    }

    if (!loginSecret.trim()) {
      setAuthError('Hãy nhập mật khẩu của người dùng.');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch('http://localhost:4000/v1/auth/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          clientId,
          tenantId,
          userId: selectedLoginUser.value,
          userSecret: loginSecret,
          scopes: loginScopes
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to obtain access token');
      }

      const payload = (await response.json()) as { accessToken: string };
      setAccessToken(payload.accessToken);
      setSessionUser({
        userId: selectedLoginUser.value,
        displayName: selectedLoginUser.label,
        roles: selectedLoginUser.roles
      });
      setLoginSecret('');
      setError(null);
    } catch (err) {
      console.error('Đăng nhập thất bại', err);
      setAuthError('Thông tin đăng nhập không hợp lệ hoặc backend không phản hồi.');
      setAccessToken('');
      setSessionUser(null);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    chat?.disconnect();
    setChat(null);
    setAccessToken('');
    setSessionUser(null);
    setSelectedConversationId(null);
    setConversations([]);
    setMessages([]);
    setDraft('');
    setSelectedMemberOptions([]);
    setNewConversationName('');
    setStatus('disconnected');
    setSelectedLoginUser(null);
    setLoginSecret('');
    setAuthError(null);
  };

  const currentConversationLabel = selectedConversation?.name ?? selectedConversation?.id ?? 'Chưa chọn cuộc trò chuyện';
  const currentConversationMeta = selectedConversation
    ? `${selectedConversation.type === 'group' ? 'Nhóm' : '1 vs 1'} · ${selectedConversation.members.length} thành viên`
    : 'Chọn một cuộc trò chuyện hoặc tạo mới';

  const memberSelectValue: SingleValue<UserOption> | MultiValue<UserOption> =
    newConversationType === 'group' ? selectedMemberOptions : selectedMemberOptions[0] ?? null;

  const isAuthenticated = Boolean(sessionUser && accessToken);

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
            <strong>{sessionUser?.displayName ?? 'Chưa đăng nhập'}</strong>
            <small>{sessionUser ? sessionUser.userId : 'Chọn người dùng để bắt đầu'}</small>
          </span>
          {isAuthenticated && (
            <button type="button" className="logout-button" onClick={handleLogout}>
              Đăng xuất
            </button>
          )}
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

          <form className="conversation-form" onSubmit={handleCreateConversation}>
            <h3>Tạo cuộc trò chuyện</h3>
            <label>
              Loại
              <Select
                classNamePrefix="rs"
                options={[
                  { value: 'dm', label: '1 vs 1' },
                  { value: 'group', label: 'Nhóm' }
                ]}
                isSearchable={false}
                value={
                  newConversationType === 'dm'
                    ? { value: 'dm', label: '1 vs 1' }
                    : { value: 'group', label: 'Nhóm' }
                }
                onChange={(option) => {
                  const next = (option as SingleValue<{ value: 'dm' | 'group'; label: string }>)?.value ?? 'dm';
                  setNewConversationType(next);
                }}
              />
            </label>
            {newConversationType === 'group' && (
              <label>
                Tên nhóm
                <input
                  type="text"
                  value={newConversationName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setNewConversationName(event.target.value)
                  }
                  placeholder="Tên hiển thị"
                />
              </label>
            )}
            <label>
              Thành viên
              <Select<UserOption>
                classNamePrefix="rs"
                options={memberOptions}
                isMulti={newConversationType === 'group'}
                value={memberSelectValue}
                onChange={(value) => {
                  const normalized = Array.isArray(value)
                    ? (value as MultiValue<UserOption>)
                    : value
                    ? [value as UserOption]
                    : [];
                  setSelectedMemberOptions(normalized);
                }}
                placeholder="Chọn thành viên"
                formatOptionLabel={(option: UserOption) => (
                  <div className="user-option">
                    <div className="user-option__main">
                      <span className="user-option__name">{option.label}</span>
                      <span className="user-option__id">{option.value}</span>
                    </div>
                    <div className="user-option__meta">
                      {option.roles.map((role) => (
                        <span key={role} className="chip chip--role">
                          {role}
                        </span>
                      ))}
                      <span className={`chip chip--status chip--status-${option.status}`}>
                        {option.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </div>
                  </div>
                )}
                isDisabled={!memberOptions.length}
              />
              <datalist id="tenant-users">
                {tenantUsers.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.displayName}
                  </option>
                ))}
              </datalist>
              <small className="field-hint">Chọn từ danh sách người dùng của tenant để đảm bảo chính xác.</small>
            </label>
            <button type="submit" disabled={!isAuthenticated}>
              Tạo mới
            </button>
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
            {isLoadingMessages && !error && <div className="message-loading">Đang tải tin nhắn...</div>}
            {!messages.length && !error && !isLoadingMessages && (
              <div className="empty-state">
                <h3>Chưa có tin nhắn</h3>
                <p>Tạo tin nhắn đầu tiên của bạn trong cuộc trò chuyện này.</p>
              </div>
            )}
            {messages.map((message) => {
              const isMine = Boolean(
                sessionUser && (message.senderId === sessionUser.userId || message.senderDeviceId === deviceInfo.id)
              );
              const ciphertext = message.body?.ciphertext ?? '';
              const isSticker = message.type === 'sticker' && message.sticker;
              const bubbleClass = `bubble ${isMine ? 'bubble--out' : 'bubble--in'}${isSticker ? ' bubble--sticker' : ''}`;
              return (
                <article key={message.id} className={bubbleClass}>
                  <header>
                    <span className="bubble-author">{isMine ? 'Bạn' : message.senderId}</span>
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
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)}
                rows={2}
                disabled={!chat || !selectedConversation || !isAuthenticated}
              />
              <div className="composer-actions">
                <button
                  type="button"
                  className={`sticker-button ${showStickers ? 'sticker-button--active' : ''}`}
                  onClick={() => setShowStickers((value) => !value)}
                  aria-label="Chèn nhãn dán"
                  disabled={!chat || !selectedConversation || !isAuthenticated}
                >
                  😊
                </button>
                <button type="submit" disabled={!draft.trim() || !selectedConversation || !isAuthenticated}>
                  Gửi
                </button>
              </div>
            </div>
            {showStickers && (
              <div className="sticker-panel" role="menu">
                {stickerCatalog.map((sticker) => (
                  <button
                    type="button"
                    key={sticker.id}
                    className="sticker-option"
                    onClick={() => handleSendSticker(sticker)}
                    disabled={!isAuthenticated}
                  >
                    <img src={sticker.url} alt={sticker.name ?? sticker.id} />
                    <span>{sticker.name ?? sticker.id}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </main>
      </div>

      {!isAuthenticated && (
        <div className="login-overlay" role="dialog" aria-modal="true">
          <form className="login-card" onSubmit={handleLogin}>
            <h2>Đăng nhập người dùng tenant</h2>
            <label>
              Người dùng
              <Select<UserOption>
                classNamePrefix="rs"
                options={userOptions}
                value={selectedLoginUser}
                onChange={(option) => setSelectedLoginUser((option as SingleValue<UserOption>) ?? null)}
                placeholder="Chọn người dùng"
                formatOptionLabel={(option: UserOption) => (
                  <div className="user-option">
                    <div className="user-option__main">
                      <span className="user-option__name">{option.label}</span>
                      <span className="user-option__id">{option.value}</span>
                    </div>
                    <div className="user-option__meta">
                      {option.roles.map((role) => (
                        <span key={role} className="chip chip--role">
                          {role}
                        </span>
                      ))}
                      <span className={`chip chip--status chip--status-${option.status}`}>
                        {option.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </div>
                  </div>
                )}
                isLoading={!userOptions.length}
                noOptionsMessage={() => 'Chưa có người dùng khả dụng'}
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                value={loginSecret}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setLoginSecret(event.target.value)}
                placeholder="Nhập mật khẩu người dùng"
                autoComplete="current-password"
              />
            </label>
            {authError && <p className="login-error">{authError}</p>}
            <button type="submit" disabled={isAuthenticating}>
              {isAuthenticating ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
