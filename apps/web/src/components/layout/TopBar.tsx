import { Flex } from '@radix-ui/themes';
import { LogOut, Menu, ShieldCheck } from 'lucide-react';

import type { AppTheme } from '../../types/app';
import { ThemeToggle } from './ThemeToggle';

interface SessionUser {
  userId: string;
  displayName: string;
  roles: string[];
}

interface TopBarProps {
  status: string;
  onToggleSidebar: () => void;
  isAuthenticated: boolean;
  sessionUser: SessionUser | null;
  onLogout: () => void;
  theme: AppTheme;
  onToggleTheme: () => void;
}

export function TopBar({
  status,
  onToggleSidebar,
  isAuthenticated,
  sessionUser,
  onLogout,
  theme,
  onToggleTheme
}: TopBarProps) {
  return (
    <div className="top-bar">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggleSidebar}
        aria-label="Mở danh sách cuộc trò chuyện"
      >
        <Menu size={20} aria-hidden />
      </button>
      <div className="top-meta">
        <h1>VIChat</h1>
        <span className={`status status-${status}`}>{status}</span>
      </div>
      <Flex align="center" gap="3" className="top-actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <div className="user-pill">
          <span className="avatar" aria-hidden>
            <ShieldCheck size={20} />
          </span>
          <span className="user-details">
            <strong>{sessionUser?.displayName ?? 'Chưa đăng nhập'}</strong>
            <small>{sessionUser ? sessionUser.userId : 'Chọn người dùng để bắt đầu'}</small>
          </span>
          {isAuthenticated && (
            <button type="button" className="logout-button" onClick={onLogout}>
              <LogOut size={16} aria-hidden />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </Flex>
    </div>
  );
}
