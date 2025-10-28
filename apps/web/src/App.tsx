import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';
import TextareaAutosize from 'react-textarea-autosize';
import {
  Lock,
  LogOut,
  Menu,
  MessageCirclePlus,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react';
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

interface TenantUserDirectoryEntry {
  userId: string;
  displayName: string;
}

interface TenantSummary {
  id: string;
  name: string;
  clientId: string;
  apiKey: string;
  plan: 'free' | 'pro' | 'enterprise';
  limits: {
    messagesPerMinute: number;
    callsPerMinute: number;
  };
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

const emojiPalette = [
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
];

const SESSION_STORAGE_KEY = 'vichat.session';

interface StoredSession {
  token: string;
  expiresAt: number;
  user: {
    userId: string;
    displayName: string;
    roles: string[];
  };
}

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.user &&
      typeof parsed.user.userId === 'string' &&
      typeof parsed.user.displayName === 'string' &&
      Array.isArray(parsed.user.roles)
    ) {
      return {
        token: parsed.token,
        expiresAt: parsed.expiresAt,
        user: {
          userId: parsed.user.userId,
          displayName: parsed.user.displayName,
          roles: parsed.user.roles.filter((role): role is string => typeof role === 'string')
        }
      };
    }
  } catch (err) {
    console.warn('Không thể đọc phiên lưu trữ', err);
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

function writeStoredSession(session: StoredSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

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
  const [activeConversation, setActiveConversation] = useState<ConversationDescriptor | null>(null);
  const [selectedMemberOptions, setSelectedMemberOptions] = useState<UserOption[]>([]);
  const [newConversationName, setNewConversationName] = useState('');
  const [tenantUsers, setTenantUsers] = useState<TenantUserProfile[]>([]);
  const [showStickers, setShowStickers] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [loginMode, setLoginMode] = useState<'tenant' | 'superadmin'>('tenant');
  const [loginSecret, setLoginSecret] = useState('');
  const [selectedLoginUser, setSelectedLoginUser] = useState<UserOption | null>(null);
  const [sessionUser, setSessionUser] = useState<{ userId: string; displayName: string; roles: string[] } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isGroupNameDirty, setIsGroupNameDirty] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [superAdminUsername, setSuperAdminUsername] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [superAdminToken, setSuperAdminToken] = useState('');
  const [isSuperAdminEnabled, setIsSuperAdminEnabled] = useState<boolean | null>(null);
  const [superAdminStatusMessage, setSuperAdminStatusMessage] = useState(
    'Đang kiểm tra cấu hình superadmin...'
  );
  const [isAuthenticatingSuperAdmin, setIsAuthenticatingSuperAdmin] = useState(false);
  const [isLoadingSuperAdmin, setIsLoadingSuperAdmin] = useState(false);
  const [superAdminError, setSuperAdminError] = useState<string | null>(null);
  const [superAdminTenants, setSuperAdminTenants] = useState<TenantSummary[]>([]);
  const [createTenantError, setCreateTenantError] = useState<string | null>(null);
  const [createTenantSuccess, setCreateTenantSuccess] = useState<string | null>(null);
  const [newTenantId, setNewTenantId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantClientId, setNewTenantClientId] = useState('');
  const [newTenantApiKey, setNewTenantApiKey] = useState('');
  const [newTenantPlan, setNewTenantPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [createTenantAdminError, setCreateTenantAdminError] = useState<string | null>(null);
  const [createTenantAdminSuccess, setCreateTenantAdminSuccess] = useState<string | null>(null);
  const [selectedTenantForAdmin, setSelectedTenantForAdmin] = useState('');
  const [newTenantAdminId, setNewTenantAdminId] = useState('');
  const [newTenantAdminName, setNewTenantAdminName] = useState('');
  const [newTenantAdminPassword, setNewTenantAdminPassword] = useState('');

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sendingMessageRef = useRef(false);

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      return;
    }

    if (stored.expiresAt <= Date.now()) {
      writeStoredSession(null);
      return;
    }

    setAccessToken(stored.token);
    setSessionUser(stored.user);
    setSelectedLoginUser({
      value: stored.user.userId,
      label: stored.user.displayName,
      roles: stored.user.roles,
      status: 'active'
    });
  }, []);

  const resetSession = useCallback((keepAuthError = false) => {
    setChat((prev) => {
      prev?.disconnect();
      return null;
    });
    setAccessToken('');
    setSessionUser(null);
    setSelectedConversationId(null);
    setConversations([]);
    setMessages([]);
    setDraft('');
    setSelectedMemberOptions([]);
    setNewConversationName('');
    setShowStickers(false);
    setShowEmojiPicker(false);
    setStatus('disconnected');
    setSelectedLoginUser(null);
    setLoginSecret('');
    setError(null);
    if (!keepAuthError) {
      setAuthError(null);
    }
    writeStoredSession(null);
  }, []);

  const handleLogout = useCallback(() => {
    resetSession(false);
  }, [resetSession]);

  const closeUserManager = useCallback(() => {
    setIsUserManagerOpen(false);
    setNewUserId('');
    setNewUserName('');
    setNewUserPassword('');
    setCreateUserError(null);
    setCreateUserSuccess(null);
  }, []);

  const handleSuperAdminLogout = useCallback(() => {
    setSuperAdminToken('');
    setSuperAdminTenants([]);
    setSuperAdminError(null);
    setSuperAdminUsername('');
    setSuperAdminPassword('');
    setIsAuthenticatingSuperAdmin(false);
    setIsLoadingSuperAdmin(false);
    setCreateTenantError(null);
    setCreateTenantSuccess(null);
    setCreateTenantAdminError(null);
    setCreateTenantAdminSuccess(null);
    setSelectedTenantForAdmin('');
    setNewTenantId('');
    setNewTenantName('');
    setNewTenantClientId('');
    setNewTenantApiKey('');
    setNewTenantPlan('free');
    setNewTenantAdminId('');
    setNewTenantAdminName('');
    setNewTenantAdminPassword('');
    if (isSuperAdminEnabled === true) {
      setSuperAdminStatusMessage(
        'Nhập tài khoản superadmin đã cấu hình qua SUPERADMIN_USER và SUPERADMIN_PASSWORD trên máy chủ.'
      );
    }
  }, [isSuperAdminEnabled]);

  const closeSuperAdmin = useCallback(() => {
    setIsSuperAdminOpen(false);
    handleSuperAdminLogout();
  }, [handleSuperAdminLogout]);

  useEffect(() => {
    if (superAdminToken && !isSuperAdminOpen) {
      setIsSuperAdminOpen(true);
    }
  }, [superAdminToken, isSuperAdminOpen]);

  useEffect(() => {
    if (loginMode === 'tenant') {
      setSuperAdminError(null);
    } else {
      setAuthError(null);
    }
  }, [loginMode]);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch('http://localhost:4000/v1/superadmin/status');
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          const text = await response.text();
          setIsSuperAdminEnabled(false);
          setSuperAdminStatusMessage(
            text ||
              'Superadmin chưa được bật. Cấu hình SUPERADMIN_USER, SUPERADMIN_PASSWORD và SUPERADMIN_TOKEN trên máy chủ để sử dụng.'
          );
          return;
        }

        const payload = (await response.json()) as { enabled?: boolean; message?: string };
        const enabled = Boolean(payload.enabled);
        setIsSuperAdminEnabled(enabled);
        if (payload.message) {
          setSuperAdminStatusMessage(payload.message);
        } else if (enabled) {
          setSuperAdminStatusMessage(
            'Nhập tài khoản superadmin đã cấu hình qua SUPERADMIN_USER và SUPERADMIN_PASSWORD trên máy chủ.'
          );
        } else {
          setSuperAdminStatusMessage(
            'Superadmin chưa được bật. Cấu hình SUPERADMIN_USER, SUPERADMIN_PASSWORD và SUPERADMIN_TOKEN trên máy chủ để sử dụng.'
          );
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error('Không thể kiểm tra trạng thái superadmin', err);
        setIsSuperAdminEnabled(false);
        setSuperAdminStatusMessage(
          'Không thể kiểm tra trạng thái superadmin. Kiểm tra máy chủ và cấu hình SUPERADMIN_USER, SUPERADMIN_PASSWORD, SUPERADMIN_TOKEN.'
        );
      }
    };

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSuperAdminTenants = useCallback(
    async (token: string) => {
      if (!token.trim()) {
        setSuperAdminError('Vui lòng đăng nhập bằng tài khoản superadmin.');
        setSuperAdminTenants([]);
        return;
      }

      setIsLoadingSuperAdmin(true);
      setSuperAdminError(null);

      try {
        const response = await fetch('http://localhost:4000/v1/superadmin/tenants', {
          headers: {
            authorization: `Bearer ${token.trim()}`
          }
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Không thể tải danh sách tenant.');
        }

        const tenants = (await response.json()) as TenantSummary[];
        setSuperAdminTenants(tenants);
        setSuperAdminError(null);
      } catch (err) {
        console.error('Không thể tải danh sách tenant', err);
        setSuperAdminError((err as Error).message || 'Không thể tải danh sách tenant.');
        setSuperAdminTenants([]);
      } finally {
        setIsLoadingSuperAdmin(false);
      }
    },
    []
  );

  const handleSuperAdminLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const username = superAdminUsername.trim();
      const password = superAdminPassword.trim();

      if (isSuperAdminEnabled !== true) {
        setSuperAdminError(
          isSuperAdminEnabled === false
            ? superAdminStatusMessage
            : 'Đang kiểm tra trạng thái superadmin, vui lòng thử lại sau.'
        );
        return;
      }

      if (!username || !password) {
        setSuperAdminError('Vui lòng nhập tài khoản và mật khẩu superadmin.');
        return;
      }

      setIsAuthenticatingSuperAdmin(true);
      setSuperAdminError(null);

      try {
        const response = await fetch('http://localhost:4000/v1/superadmin/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
          const bodyText = await response.text();
          let message = 'Không thể đăng nhập superadmin.';
          if (bodyText) {
            try {
              const parsed = JSON.parse(bodyText) as { message?: string };
              message = parsed.message ?? bodyText;
            } catch {
              message = bodyText;
            }
          }
          throw new Error(message);
        }

        const result = (await response.json()) as { token?: string };
        if (!result.token) {
          throw new Error('Máy chủ không trả về token superadmin.');
        }

        setSuperAdminToken(result.token);
        setSuperAdminError(null);
        await fetchSuperAdminTenants(result.token);
      } catch (err) {
        console.error('Không thể đăng nhập superadmin', err);
        setSuperAdminToken('');
        setSuperAdminTenants([]);
        setSuperAdminError((err as Error).message || 'Không thể đăng nhập superadmin.');
      } finally {
        setIsAuthenticatingSuperAdmin(false);
      }
    },
    [superAdminUsername, superAdminPassword, fetchSuperAdminTenants, isSuperAdminEnabled, superAdminStatusMessage]
  );

  const handleCreateTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = superAdminToken.trim();
    if (!token) {
      setCreateTenantError('Vui lòng đăng nhập superadmin trước khi thực hiện thao tác.');
      return;
    }

    if (!newTenantId.trim() || !newTenantClientId.trim() || !newTenantApiKey.trim()) {
      setCreateTenantError('Vui lòng nhập đầy đủ thông tin tenant.');
      return;
    }

    setCreateTenantError(null);
    setCreateTenantSuccess(null);

    try {
      const response = await fetch('http://localhost:4000/v1/superadmin/tenants', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: newTenantId.trim(),
          name: newTenantName.trim() || newTenantId.trim(),
          clientId: newTenantClientId.trim(),
          apiKey: newTenantApiKey.trim(),
          plan: newTenantPlan
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Không thể tạo tenant mới.');
      }

      setCreateTenantSuccess('Tạo tenant thành công.');
      setNewTenantId('');
      setNewTenantName('');
      setNewTenantClientId('');
      setNewTenantApiKey('');
      await fetchSuperAdminTenants(token);
    } catch (err) {
      console.error('Không thể tạo tenant mới', err);
      setCreateTenantError((err as Error).message || 'Không thể tạo tenant mới.');
    }
  };

  const handleCreateTenantAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = superAdminToken.trim();
    if (!token) {
      setCreateTenantAdminError('Vui lòng đăng nhập superadmin trước khi thực hiện thao tác.');
      return;
    }

    if (!selectedTenantForAdmin) {
      setCreateTenantAdminError('Vui lòng chọn tenant.');
      return;
    }

    if (!newTenantAdminId.trim() || !newTenantAdminPassword.trim()) {
      setCreateTenantAdminError('Vui lòng nhập tài khoản và mật khẩu cho quản trị viên.');
      return;
    }

    setCreateTenantAdminError(null);
    setCreateTenantAdminSuccess(null);

    try {
      const response = await fetch(`http://localhost:4000/v1/superadmin/tenants/${selectedTenantForAdmin}/users`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: newTenantAdminId.trim(),
          displayName: newTenantAdminName.trim() || newTenantAdminId.trim(),
          password: newTenantAdminPassword.trim()
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Không thể tạo quản trị viên.');
      }

      setCreateTenantAdminSuccess('Đã tạo quản trị viên đầu tiên cho tenant.');
      setNewTenantAdminId('');
      setNewTenantAdminName('');
      setNewTenantAdminPassword('');
      await fetchSuperAdminTenants(token);
    } catch (err) {
      console.error('Không thể tạo quản trị viên', err);
      setCreateTenantAdminError((err as Error).message || 'Không thể tạo quản trị viên.');
    }
  };

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

  useEffect(() => {
    if (createUserError !== 'Vui lòng nhập tài khoản và mật khẩu.') return;
    if (newUserId.trim() && newUserPassword.trim()) {
      setCreateUserError(null);
    }
  }, [createUserError, newUserId, newUserPassword]);

  useEffect(() => {
    if (superAdminError !== 'Vui lòng nhập tài khoản và mật khẩu superadmin.') return;
    if (superAdminUsername.trim() && superAdminPassword.trim()) {
      setSuperAdminError(null);
    }
  }, [superAdminError, superAdminUsername, superAdminPassword]);

  useEffect(() => {
    if (!isSuperAdminOpen) return;
    if (!superAdminToken.trim()) return;
    void fetchSuperAdminTenants(superAdminToken.trim());
  }, [isSuperAdminOpen, superAdminToken, fetchSuperAdminTenants]);

  useEffect(() => {
    if (!superAdminTenants.length) {
      setSelectedTenantForAdmin('');
      return;
    }

    setSelectedTenantForAdmin((prev) => {
      if (prev && superAdminTenants.some((tenant) => tenant.id === prev)) {
        return prev;
      }
      return superAdminTenants[0]?.id ?? '';
    });
  }, [superAdminTenants]);

  const memberOptions = useMemo(
    () => userOptions.filter((option) => option.value !== sessionUser?.userId),
    [sessionUser?.userId, userOptions]
  );

  const sharedSelectStyles = useMemo(
    () =>
      ({
        control: (base, state) => ({
          ...base,
          borderRadius: '1rem',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderColor: state.isFocused ? 'rgba(59, 130, 246, 0.65)' : 'rgba(148, 163, 184, 0.25)',
          boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
          minHeight: '3.25rem',
          cursor: 'pointer'
        }),
        valueContainer: (base) => ({
          ...base,
          padding: '0.35rem 0.75rem',
          gap: '0.4rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start'
        }),
        placeholder: (base) => ({
          ...base,
          color: 'rgba(226, 232, 240, 0.6)',
          fontWeight: 500
        }),
        multiValue: (base) => ({
          ...base,
          borderRadius: '999px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.35), rgba(14, 165, 233, 0.25))',
          color: '#e0f2fe',
          border: '1px solid rgba(14, 165, 233, 0.35)',
          margin: '0.15rem'
        }),
        multiValueLabel: (base) => ({
          ...base,
          color: '#e0f2fe',
          fontWeight: 600,
          letterSpacing: '0.05em'
        }),
        multiValueRemove: (base) => ({
          ...base,
          color: '#cbd5f5',
          ':hover': {
            backgroundColor: 'transparent',
            color: '#fca5a5'
          }
        }),
        menu: (base) => ({
          ...base,
          marginTop: '0.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          boxShadow: '0 18px 36px rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(12px)'
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isSelected
            ? 'rgba(59, 130, 246, 0.35)'
            : state.isFocused
            ? 'rgba(59, 130, 246, 0.2)'
            : 'transparent',
          color: '#f8fafc',
          padding: '0.65rem 0.85rem'
        }),
        singleValue: (base) => ({
          ...base,
          color: '#f8fafc',
          fontWeight: 500
        }),
        input: (base) => ({
          ...base,
          color: '#f8fafc'
        }),
        indicatorsContainer: (base) => ({
          ...base,
          paddingRight: '0.75rem'
        }),
        dropdownIndicator: (base, state) => ({
          ...base,
          color: state.isFocused ? '#bae6fd' : 'rgba(226, 232, 240, 0.75)',
          ':hover': {
            color: '#bae6fd'
          }
        })
      }) as StylesConfig<UserOption, true>,
    []
  );

  const createConversationType: 'dm' | 'group' = selectedMemberOptions.length > 1 ? 'group' : 'dm';

  const conversationPreviewName = useMemo(() => {
    if (selectedMemberOptions.length < 2) {
      return '';
    }
    const preview = selectedMemberOptions
      .slice(0, 3)
      .map((option) => option.label || option.value)
      .join(', ');
    return selectedMemberOptions.length > 3 ? `${preview}…` : preview;
  }, [selectedMemberOptions]);

  useEffect(() => {
    if (createConversationType === 'group') {
      if (!isGroupNameDirty) {
        setNewConversationName(conversationPreviewName);
      }
    } else {
      if (newConversationName) {
        setNewConversationName('');
      }
      if (isGroupNameDirty) {
        setIsGroupNameDirty(false);
      }
    }
  }, [conversationPreviewName, createConversationType, isGroupNameDirty, newConversationName]);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setCreationError(null);
      return;
    }

    setSelectedMemberOptions((prev) => (prev.length ? [] : prev));
    setNewConversationName((prev) => (prev ? '' : prev));
    setIsGroupNameDirty(false);
    setCreationError(null);
  }, [isCreateDialogOpen]);

  useEffect(() => {
    if (!isCreateDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateDialogOpen]);

  useEffect(() => {
    setSelectedMemberOptions((prev) =>
      prev.filter((option) => memberOptions.some((candidate) => candidate.value === option.value))
    );
  }, [memberOptions]);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return conversations.find((item) => item.id === selectedConversationId) ?? null;
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    setActiveConversation((prev) => {
      if (!selectedConversation) {
        return null;
      }

      if (prev?.id === selectedConversation.id) {
        return prev;
      }

      return selectedConversation;
    });
  }, [selectedConversation, selectedConversation?.id]);

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
        const users = (await response.json()) as TenantUserDirectoryEntry[];
        if (!cancelled) {
          setTenantUsers(
            users.map((user) => ({
              userId: user.userId,
              displayName: user.displayName,
              roles: [],
              status: 'active',
              lastLoginAt: null
            }))
          );
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
          const bodyText = await initResponse.text();

          if (initResponse.status === 401) {
            cleanupListeners?.();
            cleanupListeners = undefined;
            chatInstance.disconnect();
            instance = null;

            if (!isMounted) {
              return;
            }

            resetSession(true);
            setAuthError(bodyText.trim() || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            return;
          }

          throw new Error(bodyText || 'Unable to register client');
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
  }, [accessToken, sessionUser, handleError, resetSession]);

  useEffect(() => {
    setShowStickers(false);
    setShowEmojiPicker(false);

    if (!chat || !activeConversation) {
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
            `http://localhost:4000/v1/conversations/${activeConversation.id}/messages?limit=50`,
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

      const handle = await chat.conversationsOpen(activeConversation);
      const messageListener = (message: MessagePayload) => {
        if (message.conversationId === activeConversation.id) {
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
  }, [accessToken, chat, activeConversation, upsertMessage, applyMessageToConversation]);

  const sendMessage = useCallback(async () => {
    if (!chat || !draft.trim() || !selectedConversation || !sessionUser) return;
    if (sendingMessageRef.current) return;

    sendingMessageRef.current = true;
    try {
      const message = await chat.sendText(selectedConversation, draft);
      upsertMessage(message);
      applyMessageToConversation(message, true);
      setDraft('');
      setShowStickers(false);
      setShowEmojiPicker(false);
      setError((prev) => (prev === 'Không thể gửi tin nhắn. Vui lòng thử lại.' ? null : prev));
    } catch (err) {
      console.error('Không thể gửi tin nhắn', err);
      setError('Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      sendingMessageRef.current = false;
    }
  }, [chat, draft, selectedConversation, sessionUser, upsertMessage, applyMessageToConversation, setError]);

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
      setShowEmojiPicker(false);
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
      setCreationError('Không tìm thấy token truy cập.');
      return;
    }

    const members = selectedMemberOptions.map((option) => option.value);
    const type = createConversationType;

    if (type === 'dm' && members.length !== 1) {
      setCreationError('Cuộc trò chuyện 1-1 cần chọn chính xác một thành viên.');
      return;
    }

    if (type === 'group' && members.length < 2) {
      setCreationError('Hãy chọn ít nhất hai thành viên cho nhóm.');
      return;
    }

    setCreationError(null);

    try {
      const response = await fetch('http://localhost:4000/v1/conversations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          type,
          members,
          name:
            type === 'group'
              ? newConversationName.trim() || conversationPreviewName || undefined
              : undefined
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
      setCreationError(null);
      setIsCreateDialogOpen(false);
      setSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create conversation', err);
      setCreationError('Không thể tạo cuộc trò chuyện mới. Kiểm tra kết nối backend.');
      setError('Không thể tạo cuộc trò chuyện mới. Kiểm tra kết nối backend.');
    }
  };

  const handleInsertEmoji = useCallback(
    (emoji: string) => {
      setDraft((prev) => `${prev}${emoji}`);
      setShowEmojiPicker(false);
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          composerInputRef.current?.focus();
        });
      } else {
        composerInputRef.current?.focus();
      }
    },
    [composerInputRef]
  );

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
        let detail = 'Không thể đăng nhập với thông tin đã cung cấp.';
        try {
          const text = await response.text();
          if (text) {
            try {
              const parsed = JSON.parse(text) as { message?: unknown };
              if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
                detail = parsed.message;
              } else if (text.trim()) {
                detail = text;
              }
            } catch {
              if (text.trim()) {
                detail = text;
              }
            }
          }
        } catch {
          // ignore body parse failure
        }

        throw new Error(detail);
      }

      const payload = (await response.json()) as { accessToken: string; expiresIn?: number };
      const identity = {
        userId: selectedLoginUser.value,
        displayName: selectedLoginUser.label,
        roles: selectedLoginUser.roles
      };
      setAccessToken(payload.accessToken);
      setSessionUser(identity);
      setLoginSecret('');
      setError(null);
      setAuthError(null);

      const expiresInMs =
        typeof payload.expiresIn === 'number' && Number.isFinite(payload.expiresIn)
          ? payload.expiresIn * 1000
          : 15 * 60 * 1000;

      writeStoredSession({
        token: payload.accessToken,
        expiresAt: Date.now() + expiresInMs,
        user: identity
      });
    } catch (err) {
      console.error('Đăng nhập thất bại', err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Thông tin đăng nhập không hợp lệ hoặc backend không phản hồi.';
      setAuthError(message);
      setAccessToken('');
      setSessionUser(null);
      writeStoredSession(null);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreatingUser) return;

    const userId = newUserId.trim();
    const displayName = newUserName.trim();
    const password = newUserPassword.trim();

    if (!userId || !password) {
      setCreateUserError('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }

    if (!isAuthenticated || !accessToken) {
      setCreateUserError('Bạn cần đăng nhập bằng tài khoản quản trị để tạo người dùng mới.');
      return;
    }

    if (!isAdmin) {
      setCreateUserError('Chỉ quản trị viên mới có thể tạo người dùng mới.');
      return;
    }

    setIsCreatingUser(true);
    setCreateUserError(null);
    setCreateUserSuccess(null);

    try {
      const url = new URL(`http://localhost:4000/v1/tenants/${tenantId}/users`);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userId,
          displayName: displayName || userId,
          password
        })
      });

      if (!response.ok) {
        let detail = 'Không thể tạo người dùng mới.';
        try {
          const text = await response.text();
          if (text) {
            try {
              const parsed = JSON.parse(text) as { message?: unknown };
              if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
                detail = parsed.message;
              } else if (text.trim()) {
                detail = text;
              }
            } catch {
              if (text.trim()) {
                detail = text;
              }
            }
          }
        } catch {
          // ignore body parse failure
        }

        throw new Error(detail);
      }

      const profile = (await response.json()) as TenantUserProfile;
      setTenantUsers((prev) => {
        const next = [...prev.filter((user) => user.userId !== profile.userId), profile];
        return next.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi', { sensitivity: 'base' }));
      });
      setNewUserId('');
      setNewUserName('');
      setNewUserPassword('');
      setCreateUserSuccess('Tạo người dùng thành công.');
    } catch (err) {
      console.error('Không thể tạo người dùng mới', err);
      setCreateUserError((err as Error).message || 'Không thể tạo người dùng mới.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const currentConversationLabel = selectedConversation?.name ?? selectedConversation?.id ?? 'Chưa chọn cuộc trò chuyện';
  const currentConversationMeta = selectedConversation
    ? `${selectedConversation.type === 'group' ? 'Nhóm' : '1 vs 1'} · ${selectedConversation.members.length} thành viên`
    : 'Chọn một cuộc trò chuyện hoặc tạo mới';

  const isAuthenticated = Boolean(sessionUser && accessToken);
  const isAdmin = sessionUser?.roles.includes('admin') ?? false;

  const canSubmitConversation =
    isAuthenticated &&
    (createConversationType === 'group'
      ? selectedMemberOptions.length >= 2
      : selectedMemberOptions.length === 1);

  const createConversationLabel = createConversationType === 'group' ? 'Nhóm' : 'Trò chuyện 1-1';

  const canSendMessage = Boolean(draft.trim() && selectedConversation && isAuthenticated);

  return (
    <div className="app">
      <div className="top-bar">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Mở danh sách cuộc trò chuyện"
        >
          <Menu size={20} aria-hidden />
        </button>
        <div className="top-meta">
          <h1>VIChat</h1>
          <span className={`status status-${status}`}>{status}</span>
        </div>
        <div className="user-pill">
          <span className="avatar" aria-hidden>
            <ShieldCheck size={20} />
          </span>
          <span className="user-details">
            <strong>{sessionUser?.displayName ?? 'Chưa đăng nhập'}</strong>
            <small>{sessionUser ? sessionUser.userId : 'Chọn người dùng để bắt đầu'}</small>
          </span>
          {isAuthenticated && (
            <button type="button" className="logout-button" onClick={handleLogout}>
              <LogOut size={16} aria-hidden />
              <span>Đăng xuất</span>
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

          <div className="sidebar-actions">
            <button
              type="button"
              className="new-conversation-button"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={!isAuthenticated}
            >
              <MessageCirclePlus size={18} aria-hidden />
              <span>Tạo cuộc trò chuyện</span>
            </button>
            {isAuthenticated && isAdmin && (
              <button
                type="button"
                className="manage-users-button"
                onClick={() => {
                  setIsUserManagerOpen(true);
                  setCreateUserError(null);
                  setCreateUserSuccess(null);
                  setNewUserId('');
                  setNewUserName('');
                  setNewUserPassword('');
                }}
              >
                <ShieldCheck size={18} aria-hidden />
                <span>Quản lý người dùng</span>
              </button>
            )}
            {!isAuthenticated && (
              <small className="sidebar-hint">Đăng nhập để bắt đầu cuộc trò chuyện mới.</small>
            )}
          </div>
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
              const isMine = sessionUser?.userId === message.senderId;
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
                <Lock size={16} />
              </span>
              <span>Tin nhắn của bạn được mã hóa đầu cuối. Nhập nội dung và nhấn Enter để gửi ngay.</span>
            </div>
            <div className="composer-inputs">
              <TextareaAutosize
                className="composer-textarea"
                placeholder="Nhập tin nhắn của bạn..."
                value={draft}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)}
                minRows={2}
                maxRows={6}
                disabled={!chat || !selectedConversation || !isAuthenticated}
                ref={composerInputRef}
                onFocus={() => {
                  setShowEmojiPicker(false);
                  setShowStickers(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <div className="composer-actions">
                <div className="composer-quick">
                  <button
                    type="button"
                    className={`composer-action ${showEmojiPicker ? 'composer-action--active' : ''}`}
                    onClick={() => {
                      if (!chat || !selectedConversation || !isAuthenticated) return;
                      setShowStickers(false);
                      setShowEmojiPicker((value) => !value);
                    }}
                    aria-label="Chèn emoji"
                    aria-expanded={showEmojiPicker}
                    disabled={!chat || !selectedConversation || !isAuthenticated}
                  >
                    <Smile size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`composer-action sticker-button ${showStickers ? 'sticker-button--active' : ''}`}
                    onClick={() => {
                      if (!chat || !selectedConversation || !isAuthenticated) return;
                      setShowEmojiPicker(false);
                      setShowStickers((value) => !value);
                    }}
                    aria-label="Chèn nhãn dán"
                    aria-expanded={showStickers}
                    disabled={!chat || !selectedConversation || !isAuthenticated}
                  >
                    <Sparkles size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="composer-action composer-action--clear"
                    onClick={() => setDraft('')}
                    disabled={!draft}
                    aria-label="Xóa nội dung đang nhập"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
                <button
                  type="submit"
                  className="composer-send"
                  disabled={!canSendMessage}
                >
                  <Send size={18} aria-hidden />
                  <span>Gửi</span>
                </button>
              </div>
            </div>
            {showEmojiPicker && chat && selectedConversation && isAuthenticated && (
              <div className="emoji-panel" role="listbox" aria-label="Chọn emoji">
                {emojiPalette.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="emoji-option"
                    onClick={() => handleInsertEmoji(emoji)}
                  >
                    <span aria-hidden>{emoji}</span>
                    <span className="sr-only">Thêm emoji {emoji}</span>
                  </button>
                ))}
              </div>
            )}
            {showStickers && chat && selectedConversation && isAuthenticated && (
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

      {isCreateDialogOpen && (
        <div
          className="create-dialog"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsCreateDialogOpen(false);
            }
          }}
        >
          <form className="create-card" onSubmit={handleCreateConversation}>
            <header className="create-card__header">
              <div className="create-card__title">
                <MessageCirclePlus size={20} aria-hidden />
                <div>
                  <h3>Cuộc trò chuyện mới</h3>
                  <p>Chọn người nhận để bắt đầu kết nối.</p>
                </div>
              </div>
              <button
                type="button"
                className="create-card__close"
                onClick={() => setIsCreateDialogOpen(false)}
                aria-label="Đóng tạo cuộc trò chuyện"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="create-card__summary">
              <span className="summary-pill">
                <Users size={16} aria-hidden />
                {selectedMemberOptions.length ? `${selectedMemberOptions.length} thành viên` : 'Chưa chọn'}
              </span>
              <span className={`summary-type summary-type--${createConversationType}`}>
                {createConversationType === 'group' ? (
                  <Users size={16} aria-hidden />
                ) : (
                  <User size={16} aria-hidden />
                )}
                {createConversationLabel}
              </span>
            </div>
            <p className="create-card__hint">
              Hãy chọn người bạn muốn trò chuyện. Chọn một người để bắt đầu cuộc trò chuyện riêng hoặc nhiều người để lập nhóm và đặt tên bên dưới.
            </p>

            <label className="create-card__field">
              <span>Thành viên</span>
              <Select<UserOption, true>
                classNamePrefix="rs"
                styles={sharedSelectStyles}
                options={memberOptions}
                value={selectedMemberOptions}
                onChange={(value) => setSelectedMemberOptions(Array.isArray(value) ? value : [])}
                placeholder="Tìm kiếm và chọn thành viên..."
                isMulti
                isSearchable
                isClearable
                closeMenuOnSelect={false}
                noOptionsMessage={() => 'Không tìm thấy thành viên phù hợp'}
                formatOptionLabel={(option: UserOption) => (
                  <span className="user-option__name-only">{option.label}</span>
                )}
                isDisabled={!memberOptions.length}
              />
            </label>

            {createConversationType === 'group' && (
              <label className="create-card__field">
                <span>Tên nhóm</span>
                <input
                  type="text"
                  value={newConversationName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const { value } = event.target;
                    setIsGroupNameDirty(Boolean(value.trim().length));
                    setNewConversationName(value);
                  }}
                  placeholder={conversationPreviewName || 'Tên nhóm'}
                />
              </label>
            )}

            {creationError && <p className="create-card__error">{creationError}</p>}

            <div className="create-card__actions">
              <button type="button" className="create-card__cancel" onClick={() => setIsCreateDialogOpen(false)}>
                Hủy
              </button>
              <button type="submit" disabled={!canSubmitConversation}>
                Bắt đầu trò chuyện
              </button>
            </div>
          </form>
        </div>
      )}

      {isUserManagerOpen && (
        <div
          className="create-dialog"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeUserManager();
            }
          }}
        >
          <form className="create-card create-card--manager" onSubmit={handleCreateUser}>
            <header className="create-card__header">
              <div className="create-card__title">
                <ShieldCheck size={20} aria-hidden />
                <div>
                  <h3>Quản lý người dùng</h3>
                  <p>Thêm hoặc xem nhanh danh sách thành viên của tenant.</p>
                </div>
              </div>
              <button
                type="button"
                className="create-card__close"
                onClick={closeUserManager}
                aria-label="Đóng quản lý người dùng"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="user-manager__content">
              <section className="user-manager__section">
                <h4>Thành viên hiện có</h4>
                <ul className="user-manager__list">
                  {tenantUsers.length ? (
                    tenantUsers.map((user) => (
                      <li key={user.userId}>
                        <strong>{user.displayName}</strong>
                        <span>{user.userId}</span>
                        <small>{user.roles.length ? user.roles.join(', ') : 'member'}</small>
                      </li>
                    ))
                  ) : (
                    <li className="user-manager__empty">Chưa có người dùng nào trong tenant.</li>
                  )}
                </ul>
              </section>

              <section className="user-manager__section">
                <h4>Thêm người dùng mới</h4>
                <label>
                  Tài khoản đăng nhập
                  <input
                    value={newUserId}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setNewUserId(event.target.value)}
                    placeholder="Ví dụ: user:khachhang"
                    autoComplete="username"
                  />
                </label>
                <label>
                  Tên hiển thị
                  <input
                    value={newUserName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setNewUserName(event.target.value)}
                    placeholder="Tên sẽ hiển thị với mọi người"
                    autoComplete="name"
                  />
                </label>
                <label>
                  Mật khẩu
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setNewUserPassword(event.target.value)}
                    placeholder="Đặt mật khẩu cho tài khoản"
                    autoComplete="new-password"
                  />
                </label>
                {createUserError && <p className="create-card__error">{createUserError}</p>}
                {createUserSuccess && <p className="create-card__success">{createUserSuccess}</p>}
              </section>
            </div>

            <div className="create-card__actions">
              <button type="button" className="create-card__cancel" onClick={closeUserManager}>
                Đóng
              </button>
              <button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? 'Đang tạo...' : 'Tạo người dùng'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isAuthenticated && (
        <div className="login-overlay" role="dialog" aria-modal="true">
          <div className="login-dialog">
            <div className="login-card">
              <div className="login-toggle" role="tablist" aria-label="Chọn phương thức đăng nhập">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'tenant'}
                  className={loginMode === 'tenant' ? 'login-toggle__button login-toggle__button--active' : 'login-toggle__button'}
                  onClick={() => setLoginMode('tenant')}
                >
                  Người dùng tenant
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'superadmin'}
                  className={
                    loginMode === 'superadmin'
                      ? 'login-toggle__button login-toggle__button--active'
                      : 'login-toggle__button'
                  }
                  onClick={() => setLoginMode('superadmin')}
                >
                  Superadmin
                </button>
              </div>

              {loginMode === 'tenant' ? (
                <form className="login-card__form" onSubmit={handleLogin}>
                  <h2>Đăng nhập vào VIChat</h2>
                  <p className="login-helper">Chọn tài khoản sẵn có và nhập mật khẩu để bắt đầu trò chuyện.</p>
                  <label>
                    Tài khoản
                    <Select<UserOption>
                      classNamePrefix="rs"
                      styles={sharedSelectStyles as StylesConfig<UserOption, false>}
                      options={userOptions}
                      value={selectedLoginUser}
                      onChange={(option) => setSelectedLoginUser((option as SingleValue<UserOption>) ?? null)}
                      placeholder="Chọn tài khoản của bạn"
                      formatOptionLabel={(option: UserOption) => (
                        <span className="user-option__name-only">{option.label}</span>
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
                      placeholder="Nhập mật khẩu để đăng nhập"
                      autoComplete="current-password"
                    />
                  </label>
                  {authError && <p className="login-error">{authError}</p>}
                  <button type="submit" disabled={isAuthenticating}>
                    {isAuthenticating ? 'Đang đăng nhập...' : 'Đăng nhập'}
                  </button>
                </form>
              ) : (
                <form className="login-card__form" onSubmit={handleSuperAdminLogin}>
                  <h2>Đăng nhập Superadmin</h2>
                  <p className="login-helper login-helper--left">
                    Superadmin dùng để cấu hình tenant và tạo quản trị viên đầu tiên cho từng đơn vị.
                  </p>
                  <label>
                    Tài khoản superadmin
                    <input
                      value={superAdminUsername}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setSuperAdminUsername(event.target.value)}
                      placeholder="Ví dụ: superadmin"
                      autoComplete="username"
                      disabled={isSuperAdminEnabled !== true}
                    />
                  </label>
                  <label>
                    Mật khẩu
                    <input
                      type="password"
                      value={superAdminPassword}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setSuperAdminPassword(event.target.value)}
                      placeholder="Nhập mật khẩu superadmin"
                      autoComplete="current-password"
                      disabled={isSuperAdminEnabled !== true}
                    />
                  </label>
                  <small className="login-hint">{superAdminStatusMessage}</small>
                  {superAdminError && <p className="login-error">{superAdminError}</p>}
                  <div className="login-actions">
                    <button
                      type="submit"
                      disabled={isAuthenticatingSuperAdmin || isSuperAdminEnabled !== true}
                    >
                      {isAuthenticatingSuperAdmin
                        ? 'Đang đăng nhập...'
                        : superAdminToken
                        ? 'Đăng nhập lại'
                        : 'Đăng nhập'}
                    </button>
                    <button
                      type="button"
                      className="login-card__secondary-action"
                      onClick={() => setIsSuperAdminOpen(true)}
                      disabled={!superAdminToken}
                    >
                      Mở bảng điều khiển
                    </button>
                  </div>
                  {superAdminToken && (
                    <p className="login-success">
                      Đã đăng nhập superadmin, bạn có thể mở bảng điều khiển để quản lý tenant.
                    </p>
                  )}
                </form>
              )}
            </div>

            <div className="login-divider" aria-hidden>
              <span>Quản trị</span>
            </div>

            <div className="login-card login-card--secondary login-card--info">
              <h2>Quản lý người dùng</h2>
              <p className="login-helper">
                Sau khi đăng nhập superadmin, bạn có thể thêm tenant và người dùng đầu tiên cho từng đơn vị.
              </p>
              <button
                type="button"
                className="login-card__secondary-action"
                onClick={() => setIsSuperAdminOpen(true)}
              >
                Mở màn hình Superadmin
              </button>
              <small className="login-hint">
                {superAdminToken
                  ? 'Đang đăng nhập superadmin. Mở màn hình để quản lý tenant ngay.'
                  : 'Đăng nhập bằng tài khoản superadmin để kích hoạt bảng điều khiển quản trị.'}
              </small>
            </div>
          </div>
        </div>
      )}

      {isSuperAdminOpen && (
        <div
          className="create-dialog"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeSuperAdmin();
            }
          }}
        >
          <div className="superadmin-card">
            <header className="create-card__header">
              <div className="create-card__title">
                <ShieldCheck size={20} aria-hidden />
                <div>
                  <h3>Superadmin</h3>
                  <p>Quản lý tenant và tạo quản trị viên đầu tiên.</p>
                </div>
              </div>
              <button
                type="button"
                className="create-card__close"
                onClick={closeSuperAdmin}
                aria-label="Đóng màn hình superadmin"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <section className="superadmin-section">
              <h4>Đăng nhập superadmin</h4>
              <form className="superadmin-form" onSubmit={handleSuperAdminLogin}>
                <label>
                  Tài khoản
                  <input
                    value={superAdminUsername}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setSuperAdminUsername(event.target.value)}
                    placeholder="Ví dụ: superadmin"
                    autoComplete="username"
                    disabled={isSuperAdminEnabled !== true}
                  />
                </label>
                <label>
                  Mật khẩu
                  <input
                    type="password"
                    value={superAdminPassword}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setSuperAdminPassword(event.target.value)}
                    placeholder="Nhập mật khẩu superadmin"
                    autoComplete="current-password"
                    disabled={isSuperAdminEnabled !== true}
                  />
                </label>
                <div className="superadmin-actions">
                  <button
                    type="submit"
                    disabled={isAuthenticatingSuperAdmin || isSuperAdminEnabled !== true}
                  >
                    {isAuthenticatingSuperAdmin
                      ? 'Đang đăng nhập...'
                      : superAdminToken
                      ? 'Đăng nhập lại'
                      : 'Đăng nhập'}
                  </button>
                  {superAdminToken && (
                    <>
                      <button
                        type="button"
                        className="superadmin-actions__secondary"
                        onClick={() => void fetchSuperAdminTenants(superAdminToken)}
                        disabled={
                          isLoadingSuperAdmin || isAuthenticatingSuperAdmin || isSuperAdminEnabled !== true
                        }
                      >
                        {isLoadingSuperAdmin ? 'Đang tải...' : 'Tải danh sách tenant'}
                      </button>
                      <button
                        type="button"
                        className="superadmin-actions__secondary"
                        onClick={handleSuperAdminLogout}
                      >
                        Đăng xuất
                      </button>
                    </>
                  )}
                </div>
                <small className="superadmin-hint">{superAdminStatusMessage}</small>
              </form>
              {superAdminToken && (
                <p className="superadmin-hint superadmin-hint--success">Đã đăng nhập superadmin, bạn có thể quản lý tenant.</p>
              )}
              {superAdminError && <p className="create-card__error">{superAdminError}</p>}
            </section>

            <section className="superadmin-section">
              <h4>Tenant hiện có</h4>
              <ul className="superadmin-tenant-list">
                {superAdminToken ? (
                  superAdminTenants.length ? (
                    superAdminTenants.map((tenant) => (
                      <li key={tenant.id}>
                        <div>
                          <strong>{tenant.name}</strong>
                          <small>ID: {tenant.id}</small>
                        </div>
                        <span className="badge">Plan: {tenant.plan}</span>
                      </li>
                    ))
                  ) : (
                    <li className="superadmin-tenant-empty">Chưa có tenant nào hoặc thiếu quyền truy cập.</li>
                  )
                ) : (
                  <li className="superadmin-tenant-empty">Đăng nhập superadmin để xem danh sách tenant.</li>
                )}
              </ul>
            </section>

            <section className="superadmin-section">
              <h4>Thêm tenant mới</h4>
              <form className="superadmin-form" onSubmit={handleCreateTenant}>
                <label>
                  Tenant ID
                  <input value={newTenantId} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantId(event.target.value)} placeholder="Ví dụ: tenant-ban-hang" />
                </label>
                <label>
                  Tên hiển thị
                  <input value={newTenantName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantName(event.target.value)} placeholder="Tên hiển thị cho tenant" />
                </label>
                <label>
                  Client ID
                  <input value={newTenantClientId} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantClientId(event.target.value)} placeholder="Ví dụ: app-ban-hang" />
                </label>
                <label>
                  API key
                  <input value={newTenantApiKey} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantApiKey(event.target.value)} placeholder="Khóa API cho client" />
                </label>
                <label>
                  Gói dịch vụ
                  <select value={newTenantPlan} onChange={(event) => setNewTenantPlan(event.target.value as 'free' | 'pro' | 'enterprise')}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                {createTenantError && <p className="create-card__error">{createTenantError}</p>}
                {createTenantSuccess && <p className="create-card__success">{createTenantSuccess}</p>}
                <div className="superadmin-actions">
                  <button type="submit" disabled={!superAdminToken}>
                    Tạo tenant
                  </button>
                </div>
              </form>
            </section>

            <section className="superadmin-section">
              <h4>Thêm quản trị viên đầu tiên</h4>
              <form className="superadmin-form" onSubmit={handleCreateTenantAdmin}>
                <label>
                  Tenant
                  <select
                    value={selectedTenantForAdmin}
                    onChange={(event) => setSelectedTenantForAdmin(event.target.value)}
                    disabled={!superAdminToken}
                  >
                    <option value="" disabled>
                      Chọn tenant
                    </option>
                    {superAdminTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.id})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tài khoản quản trị
                  <input value={newTenantAdminId} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantAdminId(event.target.value)} placeholder="Ví dụ: admin:tenant" />
                </label>
                <label>
                  Tên hiển thị
                  <input value={newTenantAdminName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantAdminName(event.target.value)} placeholder="Tên quản trị viên" />
                </label>
                <label>
                  Mật khẩu
                  <input type="password" value={newTenantAdminPassword} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTenantAdminPassword(event.target.value)} placeholder="Mật khẩu đăng nhập" />
                </label>
                {createTenantAdminError && <p className="create-card__error">{createTenantAdminError}</p>}
                {createTenantAdminSuccess && <p className="create-card__success">{createTenantAdminSuccess}</p>}
                <div className="superadmin-actions">
                  <button type="submit" disabled={!superAdminToken}>
                    Tạo quản trị viên
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
