import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@radix-ui/themes';
import type { StylesConfig } from 'react-select';
import ChatKit from '@vichat/sdk';
import type { ConversationDescriptor, MessagePayload, StickerPayload } from '@vichat/shared';
import './App.css';

import {
  deviceInfo,
  emojiPalette,
  loginScopes,
  stickerCatalog,
  THEME_STORAGE_KEY
} from './constants/app';
import {
  type AppTheme,
  type ConversationView,
  type LoginMode,
  type TenantDirectorySummary,
  type TenantOption,
  type TenantSummary,
  type TenantUserDirectoryEntry,
  type TenantUserProfile,
  type UserOption
} from './types/app';
import { readStoredSession, writeStoredSession } from './utils/session';
import { messageToSnippet, sortConversations, truncate } from './utils/chat';
import { ChatPanel } from './components/chat/ChatPanel';
import { ConversationSidebar } from './components/sidebar/ConversationSidebar';
import { CreateConversationDialog } from './components/dialogs/CreateConversationDialog';
import { UserManagerDialog } from './components/dialogs/UserManagerDialog';
import { LoginOverlay } from './components/auth/LoginOverlay';
import { SuperAdminDialog } from './components/dialogs/SuperAdminDialog';
import { TopBar } from './components/layout/TopBar';

interface SelectPalette {
  surface: string;
  border: string;
  focusBorder: string;
  focusShadow: string;
  placeholder: string;
  text: string;
  menu: string;
  menuShadow: string;
  optionHover: string;
  optionSelected: string;
  optionText: string;
  indicator: string;
  indicatorHover: string;
  multiBackground: string;
  multiBorder: string;
  multiText: string;
  multiRemove: string;
  multiRemoveHover: string;
  input: string;
}

const lightSelectPalette: SelectPalette = {
  surface: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(148, 163, 184, 0.45)',
  focusBorder: 'rgba(59, 130, 246, 0.6)',
  focusShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
  placeholder: 'rgba(71, 85, 105, 0.7)',
  text: '#0f172a',
  menu: 'rgba(255, 255, 255, 0.98)',
  menuShadow: '0 18px 36px rgba(15, 23, 42, 0.15)',
  optionHover: 'rgba(59, 130, 246, 0.15)',
  optionSelected: 'rgba(59, 130, 246, 0.25)',
  optionText: '#0f172a',
  indicator: 'rgba(71, 85, 105, 0.65)',
  indicatorHover: 'rgba(37, 99, 235, 0.9)',
  multiBackground: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(14, 165, 233, 0.12))',
  multiBorder: 'rgba(59, 130, 246, 0.35)',
  multiText: '#0f172a',
  multiRemove: '#1d4ed8',
  multiRemoveHover: '#ef4444',
  input: '#0f172a'
};

const darkSelectPalette: SelectPalette = {
  surface: 'rgba(15, 23, 42, 0.85)',
  border: 'rgba(148, 163, 184, 0.25)',
  focusBorder: 'rgba(59, 130, 246, 0.65)',
  focusShadow: '0 0 0 2px rgba(59, 130, 246, 0.25)',
  placeholder: 'rgba(226, 232, 240, 0.6)',
  text: '#f8fafc',
  menu: 'rgba(15, 23, 42, 0.95)',
  menuShadow: '0 18px 36px rgba(15, 23, 42, 0.45)',
  optionHover: 'rgba(59, 130, 246, 0.2)',
  optionSelected: 'rgba(59, 130, 246, 0.35)',
  optionText: '#f8fafc',
  indicator: 'rgba(226, 232, 240, 0.75)',
  indicatorHover: '#bae6fd',
  multiBackground: 'linear-gradient(135deg, rgba(59, 130, 246, 0.35), rgba(14, 165, 233, 0.25))',
  multiBorder: 'rgba(14, 165, 233, 0.35)',
  multiText: '#e0f2fe',
  multiRemove: '#cbd5f5',
  multiRemoveHover: '#fca5a5',
  input: '#f8fafc'
};

function buildMultiSelectStyles<Option>(palette: SelectPalette): StylesConfig<Option, true> {
  return {
    control: (base, state) => ({
      ...base,
      borderRadius: '1rem',
      backgroundColor: palette.surface,
      borderColor: state.isFocused ? palette.focusBorder : palette.border,
      boxShadow: state.isFocused ? palette.focusShadow : 'none',
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
      color: palette.placeholder,
      fontWeight: 500
    }),
    multiValue: (base) => ({
      ...base,
      borderRadius: '999px',
      background: palette.multiBackground,
      border: `1px solid ${palette.multiBorder}`,
      color: palette.multiText,
      margin: '0.15rem'
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: palette.multiText,
      fontWeight: 600,
      letterSpacing: '0.05em'
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: palette.multiRemove,
      ':hover': {
        backgroundColor: 'transparent',
        color: palette.multiRemoveHover
      }
    }),
    menu: (base) => ({
      ...base,
      marginTop: '0.5rem',
      backgroundColor: palette.menu,
      borderRadius: '1rem',
      overflow: 'hidden',
      border: `1px solid ${palette.border}`,
      boxShadow: palette.menuShadow
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? palette.optionSelected
        : state.isFocused
        ? palette.optionHover
        : 'transparent',
      color: palette.optionText,
      padding: '0.65rem 0.85rem'
    }),
    singleValue: (base) => ({
      ...base,
      color: palette.text,
      fontWeight: 500
    }),
    input: (base) => ({
      ...base,
      color: palette.input
    }),
    indicatorsContainer: (base) => ({
      ...base,
      paddingRight: '0.75rem'
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? palette.indicatorHover : palette.indicator,
      ':hover': {
        color: palette.indicatorHover
      }
    }),
    clearIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? palette.indicatorHover : palette.indicator,
      ':hover': {
        color: palette.indicatorHover
      }
    })
  } as StylesConfig<Option, true>;
}

function buildSingleSelectStyles<Option>(palette: SelectPalette): StylesConfig<Option, false> {
  return {
    control: (base, state) => ({
      ...base,
      borderRadius: '0.9rem',
      backgroundColor: palette.surface,
      borderColor: state.isFocused ? palette.focusBorder : palette.border,
      boxShadow: state.isFocused ? palette.focusShadow : 'none',
      minHeight: '3rem',
      cursor: 'pointer'
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0.25rem 0.75rem'
    }),
    placeholder: (base) => ({
      ...base,
      color: palette.placeholder,
      fontWeight: 500
    }),
    singleValue: (base) => ({
      ...base,
      color: palette.text,
      fontWeight: 600
    }),
    input: (base) => ({
      ...base,
      color: palette.input
    }),
    menu: (base) => ({
      ...base,
      marginTop: '0.5rem',
      backgroundColor: palette.menu,
      borderRadius: '0.9rem',
      overflow: 'hidden',
      border: `1px solid ${palette.border}`,
      boxShadow: palette.menuShadow
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? palette.optionSelected
        : state.isFocused
        ? palette.optionHover
        : 'transparent',
      color: palette.optionText,
      padding: '0.55rem 0.85rem'
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? palette.indicatorHover : palette.indicator,
      ':hover': {
        color: palette.indicatorHover
      }
    }),
    clearIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? palette.indicatorHover : palette.indicator,
      ':hover': {
        color: palette.indicatorHover
      }
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: palette.border
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: palette.placeholder,
      fontWeight: 500
    })
  } as StylesConfig<Option, false>;
}

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });
  const selectPalette = useMemo<SelectPalette>(() => (theme === 'light' ? lightSelectPalette : darkSelectPalette), [theme]);
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
  const [tenantCatalog, setTenantCatalog] = useState<TenantDirectorySummary[]>([]);
  const [selectedLoginTenant, setSelectedLoginTenant] = useState<TenantOption | null>(null);
  const [activeTenant, setActiveTenant] = useState<TenantOption | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoadingTenantDirectory, setIsLoadingTenantDirectory] = useState(false);
  const [tenantDirectoryError, setTenantDirectoryError] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('tenant');
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

  const isAuthenticated = Boolean(sessionUser && accessToken && activeTenant);

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const sendingMessageRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.theme = theme;
    return () => {
      document.body.removeAttribute('data-theme');
    };
  }, [theme]);

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
    const tenantOption: TenantOption = {
      value: stored.tenant.id,
      label: stored.tenant.name,
      clientId: stored.tenant.clientId
    };
    setActiveTenant(tenantOption);
    setSelectedLoginTenant(tenantOption);
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
    setActiveTenant(null);
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
    setTenantDirectoryError(null);
    if (!keepAuthError) {
      setAuthError(null);
    }
    writeStoredSession(null);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
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

  const openUserManager = useCallback(() => {
    setIsUserManagerOpen(true);
    setCreateUserError(null);
    setCreateUserSuccess(null);
    setNewUserId('');
    setNewUserName('');
    setNewUserPassword('');
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
    if (isAuthenticated) {
      return;
    }

    const tenant = selectedLoginTenant;
    if (!tenant) {
      setTenantUsers([]);
      setSelectedLoginUser(null);
      setIsLoadingTenantDirectory(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTenantDirectory(true);
    setTenantDirectoryError(null);

    const loadDirectory = async () => {
      try {
        const response = await fetch(
          `http://localhost:4000/v1/tenants/${tenant.value}/users?clientId=${encodeURIComponent(tenant.clientId)}`
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Không thể tải danh sách người dùng.');
        }

        const users = (await response.json()) as TenantUserDirectoryEntry[];
        if (cancelled) {
          return;
        }

        setTenantUsers(
          users.map((user) => ({
            userId: user.userId,
            displayName: user.displayName,
            roles: [],
            status: 'active',
            lastLoginAt: null
          }))
        );
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.warn('Không thể tải danh sách người dùng tenant', err);
        setTenantUsers([]);
        setTenantDirectoryError('Không thể tải người dùng của đơn vị đã chọn.');
      } finally {
        if (!cancelled) {
          setIsLoadingTenantDirectory(false);
        }
      }
    };

    void loadDirectory();

    return () => {
      cancelled = true;
      setIsLoadingTenantDirectory(false);
    };
  }, [isAuthenticated, selectedLoginTenant]);

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

  const refreshTenantCatalog = useCallback(async () => {
    setIsLoadingTenants(true);
    setTenantDirectoryError(null);

    try {
      const response = await fetch('http://localhost:4000/v1/tenants');
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Không thể tải danh sách đơn vị.');
      }

      const payload = (await response.json()) as TenantDirectorySummary[];
      const sorted = [...payload].sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
      setTenantCatalog(sorted);
    } catch (err) {
      console.error('Không thể tải danh sách đơn vị', err);
      setTenantCatalog([]);
      setTenantDirectoryError('Không thể tải danh sách đơn vị. Vui lòng thử lại sau.');
    } finally {
      setIsLoadingTenants(false);
    }
  }, []);

  useEffect(() => {
    void refreshTenantCatalog();
  }, [refreshTenantCatalog]);

  useEffect(() => {
    if (!tenantCatalog.length) {
      if (!isAuthenticated) {
        setSelectedLoginTenant(null);
      }
      return;
    }

    setSelectedLoginTenant((prev) => {
      const existing = prev ? tenantCatalog.find((tenant) => tenant.id === prev.value) : null;
      if (existing) {
        if (existing.name !== prev.label || existing.clientId !== prev.clientId) {
          return { value: existing.id, label: existing.name, clientId: existing.clientId };
        }
        return prev;
      }

      const fallback = activeTenant
        ? tenantCatalog.find((tenant) => tenant.id === activeTenant.value)
        : tenantCatalog[0];

      return fallback ? { value: fallback.id, label: fallback.name, clientId: fallback.clientId } : null;
    });
  }, [tenantCatalog, activeTenant, isAuthenticated]);

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
        void refreshTenantCatalog();
      } catch (err) {
        console.error('Không thể tải danh sách tenant', err);
        setSuperAdminError((err as Error).message || 'Không thể tải danh sách tenant.');
        setSuperAdminTenants([]);
      } finally {
        setIsLoadingSuperAdmin(false);
      }
    },
    [refreshTenantCatalog]
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
        setIsSuperAdminOpen(true);
        await fetchSuperAdminTenants(result.token);
      } catch (err) {
        console.error('Không thể đăng nhập superadmin', err);
        setSuperAdminToken('');
        setSuperAdminTenants([]);
        setSuperAdminError((err as Error).message || 'Không thể đăng nhập superadmin.');
        setIsSuperAdminOpen(false);
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
      void refreshTenantCatalog();
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

  const tenantOptions = useMemo<TenantOption[]>(
    () => tenantCatalog.map((tenant) => ({ value: tenant.id, label: tenant.name, clientId: tenant.clientId })),
    [tenantCatalog]
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
    if (loginSecret || selectedLoginUser || selectedLoginTenant) {
      setAuthError(null);
    }
  }, [authError, loginSecret, selectedLoginUser, selectedLoginTenant]);

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
    () => buildMultiSelectStyles<UserOption>(selectPalette),
    [selectPalette]
  );
  const tenantSelectStyles = useMemo(
    () => buildSingleSelectStyles<TenantOption>(selectPalette),
    [selectPalette]
  );
  const userSelectStyles = useMemo(
    () => buildSingleSelectStyles<UserOption>(selectPalette),
    [selectPalette]
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
    if (!sessionUser || !accessToken || !activeTenant) {
      setChat((prev) => {
        prev?.disconnect();
        return null;
      });
      setConversations([]);
      setSelectedConversationId(null);
      setMessages([]);
      setStatus('disconnected');
      if (!accessToken) {
        setTenantUsers([]);
      }
      return;
    }

    const activeUser = sessionUser;
    const tenantContext = activeTenant;
    let isMounted = true;
    let cleanupListeners: (() => void) | undefined;
    let instance: ChatKit | null = null;

    async function bootstrap() {
      setStatus('connecting');
      setError(null);
      setMessages([]);

      try {
        const chatInstance = await ChatKit.init({
          tenantId: tenantContext.value,
          clientId: tenantContext.clientId,
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
          const usersResponse = await fetch(`http://localhost:4000/v1/tenants/${tenantContext.value}/users`, {
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
  }, [accessToken, sessionUser, activeTenant, handleError, resetSession]);

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

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setSidebarOpen(false);
  }, []);

  const handleToggleEmoji = useCallback(() => {
    if (!chat || !selectedConversation || !isAuthenticated) return;
    setShowStickers(false);
    setShowEmojiPicker((value) => !value);
  }, [chat, selectedConversation, isAuthenticated]);

  const handleToggleStickers = useCallback(() => {
    if (!chat || !selectedConversation || !isAuthenticated) return;
    setShowEmojiPicker(false);
    setShowStickers((value) => !value);
  }, [chat, selectedConversation, isAuthenticated]);

  const handleClosePickers = useCallback(() => {
    setShowEmojiPicker(false);
    setShowStickers(false);
  }, []);

  const handleGroupNameChange = useCallback((value: string, isDirty: boolean) => {
    setIsGroupNameDirty(isDirty);
    setNewConversationName(value);
  }, []);

  const refreshSuperAdminTenants = useCallback(() => {
    if (!superAdminToken) return;
    void fetchSuperAdminTenants(superAdminToken);
  }, [fetchSuperAdminTenants, superAdminToken]);

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedLoginTenant) {
      setAuthError('Vui lòng chọn đơn vị để đăng nhập.');
      return;
    }

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
          clientId: selectedLoginTenant.clientId,
          tenantId: selectedLoginTenant.value,
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
      setActiveTenant(selectedLoginTenant);
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
        tenant: {
          id: selectedLoginTenant.value,
          name: selectedLoginTenant.label,
          clientId: selectedLoginTenant.clientId
        },
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
      setActiveTenant(null);
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

    if (!activeTenant) {
      setCreateUserError('Không xác định được đơn vị hiện tại.');
      return;
    }

    setIsCreatingUser(true);
    setCreateUserError(null);
    setCreateUserSuccess(null);

    try {
      const url = new URL(`http://localhost:4000/v1/tenants/${activeTenant.value}/users`);
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

  const isAdmin = sessionUser?.roles.includes('admin') ?? false;

  const canSubmitConversation =
    isAuthenticated &&
    (createConversationType === 'group'
      ? selectedMemberOptions.length >= 2
      : selectedMemberOptions.length === 1);

  const createConversationLabel = createConversationType === 'group' ? 'Nhóm' : 'Trò chuyện 1-1';

  const canSendMessage = Boolean(draft.trim() && selectedConversation && isAuthenticated);
  const appClassName = useMemo(() => `app${theme === 'light' ? ' app--light' : ''}`, [theme]);
  const layoutClassName = useMemo(
    () => `layout${sidebarOpen ? ' layout--sidebar-open' : ''}`,
    [sidebarOpen]
  );
  const loginOverlayVisible = !isAuthenticated && !isSuperAdminOpen;

  return (
    <Theme appearance={theme} accentColor="sky" grayColor="slate" radius="large">
      <div className={appClassName} data-theme={theme}>
      <TopBar
        status={status}
        onToggleSidebar={toggleSidebar}
        isAuthenticated={isAuthenticated}
        sessionUser={sessionUser}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className={layoutClassName}>
        <ConversationSidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={() => setIsCreateDialogOpen(true)}
          onOpenUserManager={openUserManager}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
        />
        {sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            onClick={toggleSidebar}
            aria-label="Đóng danh sách cuộc trò chuyện"
          />
        )}

        <ChatPanel
          selectedConversation={selectedConversation}
          currentConversationLabel={currentConversationLabel}
          currentConversationMeta={currentConversationMeta}
          activeTenant={activeTenant}
          error={error}
          isLoadingMessages={isLoadingMessages}
          messages={messages}
          sessionUser={sessionUser}
          messageEndRef={messageEndRef}
          composerInputRef={composerInputRef}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          onSendMessage={sendMessage}
          canSendMessage={canSendMessage}
          isAuthenticated={isAuthenticated}
          chatReady={Boolean(chat)}
          showStickers={showStickers}
          showEmojiPicker={showEmojiPicker}
          onToggleStickers={handleToggleStickers}
          onToggleEmoji={handleToggleEmoji}
          onClosePickers={handleClosePickers}
          onSendSticker={handleSendSticker}
          stickers={stickerCatalog}
          emojiPalette={emojiPalette}
        />
      </div>

      <CreateConversationDialog
        isOpen={isCreateDialogOpen}
        memberOptions={memberOptions}
        selectedMemberOptions={selectedMemberOptions}
        onMembersChange={(options) => setSelectedMemberOptions(options)}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateConversation}
        createConversationType={createConversationType}
        conversationPreviewName={conversationPreviewName}
        newConversationName={newConversationName}
        onGroupNameChange={handleGroupNameChange}
        creationError={creationError}
        canSubmitConversation={canSubmitConversation}
        createConversationLabel={createConversationLabel}
        sharedSelectStyles={sharedSelectStyles}
      />

      <UserManagerDialog
        isOpen={isUserManagerOpen}
        tenantUsers={tenantUsers}
        newUserId={newUserId}
        newUserName={newUserName}
        newUserPassword={newUserPassword}
        onUserIdChange={setNewUserId}
        onUserNameChange={setNewUserName}
        onUserPasswordChange={setNewUserPassword}
        onSubmit={handleCreateUser}
        onClose={closeUserManager}
        isCreatingUser={isCreatingUser}
        createUserError={createUserError}
        createUserSuccess={createUserSuccess}
      />

      <LoginOverlay
        visible={loginOverlayVisible}
        loginMode={loginMode}
        onLoginModeChange={setLoginMode}
        tenantOptions={tenantOptions}
        tenantSelectStyles={tenantSelectStyles}
        selectedTenant={selectedLoginTenant}
        onSelectTenant={setSelectedLoginTenant}
        isLoadingTenants={isLoadingTenants}
        userOptions={userOptions}
        userSelectStyles={userSelectStyles}
        selectedUser={selectedLoginUser}
        onSelectUser={setSelectedLoginUser}
        isLoadingTenantDirectory={isLoadingTenantDirectory}
        tenantDirectoryError={tenantDirectoryError}
        loginSecret={loginSecret}
        onLoginSecretChange={setLoginSecret}
        onLogin={handleLogin}
        isAuthenticating={isAuthenticating}
        authError={authError}
        superAdminUsername={superAdminUsername}
        onSuperAdminUsernameChange={setSuperAdminUsername}
        superAdminPassword={superAdminPassword}
        onSuperAdminPasswordChange={setSuperAdminPassword}
        superAdminStatusMessage={superAdminStatusMessage}
        superAdminError={superAdminError}
        onSuperAdminLogin={handleSuperAdminLogin}
        isAuthenticatingSuperAdmin={isAuthenticatingSuperAdmin}
        isSuperAdminEnabled={isSuperAdminEnabled}
        superAdminToken={superAdminToken}
        onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
      />
      <SuperAdminDialog
        isOpen={isSuperAdminOpen}
        onClose={closeSuperAdmin}
        superAdminUsername={superAdminUsername}
        onSuperAdminUsernameChange={setSuperAdminUsername}
        superAdminPassword={superAdminPassword}
        onSuperAdminPasswordChange={setSuperAdminPassword}
        onSuperAdminLogin={handleSuperAdminLogin}
        isSuperAdminEnabled={isSuperAdminEnabled}
        isAuthenticatingSuperAdmin={isAuthenticatingSuperAdmin}
        superAdminToken={superAdminToken}
        superAdminStatusMessage={superAdminStatusMessage}
        superAdminError={superAdminError}
        onSuperAdminLogout={handleSuperAdminLogout}
        onRefreshTenants={refreshSuperAdminTenants}
        isLoadingSuperAdmin={isLoadingSuperAdmin}
        superAdminTenants={superAdminTenants}
        createTenantError={createTenantError}
        createTenantSuccess={createTenantSuccess}
        newTenantId={newTenantId}
        onNewTenantIdChange={setNewTenantId}
        newTenantName={newTenantName}
        onNewTenantNameChange={setNewTenantName}
        newTenantClientId={newTenantClientId}
        onNewTenantClientIdChange={setNewTenantClientId}
        newTenantApiKey={newTenantApiKey}
        onNewTenantApiKeyChange={setNewTenantApiKey}
        newTenantPlan={newTenantPlan}
        onNewTenantPlanChange={setNewTenantPlan}
        onCreateTenant={handleCreateTenant}
        createTenantAdminError={createTenantAdminError}
        createTenantAdminSuccess={createTenantAdminSuccess}
        selectedTenantForAdmin={selectedTenantForAdmin}
        onSelectTenantForAdmin={setSelectedTenantForAdmin}
        newTenantAdminId={newTenantAdminId}
        onNewTenantAdminIdChange={setNewTenantAdminId}
        newTenantAdminName={newTenantAdminName}
        onNewTenantAdminNameChange={setNewTenantAdminName}
        newTenantAdminPassword={newTenantAdminPassword}
        onNewTenantAdminPasswordChange={setNewTenantAdminPassword}
        onCreateTenantAdmin={handleCreateTenantAdmin}
      />
      </div>
    </Theme>
  );
}
