import { type ChangeEvent, type FormEvent } from 'react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';

import type { LoginMode, TenantOption, UserOption } from '../../types/app';

interface LoginOverlayProps {
  visible: boolean;
  loginMode: LoginMode;
  onLoginModeChange: (mode: LoginMode) => void;
  tenantOptions: TenantOption[];
  tenantSelectStyles: StylesConfig<TenantOption, false>;
  selectedTenant: TenantOption | null;
  onSelectTenant: (tenant: TenantOption | null) => void;
  isLoadingTenants: boolean;
  userOptions: UserOption[];
  userSelectStyles: StylesConfig<UserOption, false>;
  selectedUser: UserOption | null;
  onSelectUser: (user: UserOption | null) => void;
  isLoadingTenantDirectory: boolean;
  tenantDirectoryError: string | null;
  loginSecret: string;
  onLoginSecretChange: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  isAuthenticating: boolean;
  authError: string | null;
  superAdminUsername: string;
  onSuperAdminUsernameChange: (value: string) => void;
  superAdminPassword: string;
  onSuperAdminPasswordChange: (value: string) => void;
  superAdminStatusMessage: string;
  superAdminError: string | null;
  onSuperAdminLogin: (event: FormEvent<HTMLFormElement>) => void;
  isAuthenticatingSuperAdmin: boolean;
  isSuperAdminEnabled: boolean | null;
  superAdminToken: string;
  onOpenSuperAdmin: () => void;
}

export function LoginOverlay({
  visible,
  loginMode,
  onLoginModeChange,
  tenantOptions,
  tenantSelectStyles,
  selectedTenant,
  onSelectTenant,
  isLoadingTenants,
  userOptions,
  userSelectStyles,
  selectedUser,
  onSelectUser,
  isLoadingTenantDirectory,
  tenantDirectoryError,
  loginSecret,
  onLoginSecretChange,
  onLogin,
  isAuthenticating,
  authError,
  superAdminUsername,
  onSuperAdminUsernameChange,
  superAdminPassword,
  onSuperAdminPasswordChange,
  superAdminStatusMessage,
  superAdminError,
  onSuperAdminLogin,
  isAuthenticatingSuperAdmin,
  isSuperAdminEnabled,
  superAdminToken,
  onOpenSuperAdmin
}: LoginOverlayProps) {
  if (!visible) return null;

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-dialog">
        <div className="login-card">
          <div className="login-toggle" role="tablist" aria-label="Chọn phương thức đăng nhập">
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'tenant'}
              className={loginMode === 'tenant' ? 'login-toggle__button login-toggle__button--active' : 'login-toggle__button'}
              onClick={() => onLoginModeChange('tenant')}
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
              onClick={() => onLoginModeChange('superadmin')}
            >
              Superadmin
            </button>
          </div>

          {loginMode === 'tenant' ? (
            <form className="login-card__form" onSubmit={onLogin}>
              <h2>Đăng nhập vào VIChat</h2>
              <p className="login-helper">Chọn tài khoản sẵn có và nhập mật khẩu để bắt đầu trò chuyện.</p>
              <label>
                Đơn vị
                <Select<TenantOption>
                  classNamePrefix="rs"
                  styles={tenantSelectStyles}
                  options={tenantOptions}
                  value={selectedTenant}
                  onChange={(option) => onSelectTenant((option as SingleValue<TenantOption>) ?? null)}
                  placeholder="Chọn đơn vị của bạn"
                  isLoading={isLoadingTenants}
                  noOptionsMessage={() => 'Chưa có đơn vị khả dụng'}
                />
              </label>
              <label>
                Tài khoản
                <Select<UserOption>
                  classNamePrefix="rs"
                  styles={userSelectStyles}
                  options={userOptions}
                  value={selectedUser}
                  onChange={(option) => onSelectUser((option as SingleValue<UserOption>) ?? null)}
                  placeholder="Chọn tài khoản của bạn"
                  formatOptionLabel={(option: UserOption) => <span className="user-option__name-only">{option.label}</span>}
                  isLoading={isLoadingTenantDirectory}
                  isDisabled={!selectedTenant || isLoadingTenantDirectory}
                  noOptionsMessage={() => 'Chưa có người dùng khả dụng'}
                />
              </label>
              {tenantDirectoryError && <p className="login-error">{tenantDirectoryError}</p>}
              <label>
                Mật khẩu
                <input
                  type="password"
                  value={loginSecret}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onLoginSecretChange(event.target.value)}
                  placeholder="Nhập mật khẩu để đăng nhập"
                  autoComplete="current-password"
                />
              </label>
              {authError && <p className="login-error">{authError}</p>}
              <button type="submit" disabled={isAuthenticating || isLoadingTenants || !selectedTenant}>
                {isAuthenticating ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
          ) : (
            <form className="login-card__form" onSubmit={onSuperAdminLogin}>
              <h2>Đăng nhập Superadmin</h2>
              <p className="login-helper login-helper--left">
                Superadmin dùng để cấu hình tenant và tạo quản trị viên đầu tiên cho từng đơn vị.
              </p>
              <label>
                Tài khoản superadmin
                <input
                  value={superAdminUsername}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onSuperAdminUsernameChange(event.target.value)}
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onSuperAdminPasswordChange(event.target.value)}
                  placeholder="Nhập mật khẩu superadmin"
                  autoComplete="current-password"
                  disabled={isSuperAdminEnabled !== true}
                />
              </label>
              <small className="login-hint">{superAdminStatusMessage}</small>
              {superAdminError && <p className="login-error">{superAdminError}</p>}
              <div className="login-actions">
                <button type="submit" disabled={isAuthenticatingSuperAdmin || isSuperAdminEnabled !== true}>
                  {isAuthenticatingSuperAdmin
                    ? 'Đang đăng nhập...'
                    : superAdminToken
                    ? 'Đăng nhập lại'
                    : 'Đăng nhập'}
                </button>
                <button
                  type="button"
                  className="login-card__secondary-action"
                  onClick={onOpenSuperAdmin}
                  disabled={!superAdminToken}
                >
                  Mở bảng điều khiển
                </button>
              </div>
              {superAdminToken && (
                <p className="login-success">Đã đăng nhập superadmin, bạn có thể mở bảng điều khiển để quản lý tenant.</p>
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
          <button type="button" className="login-card__secondary-action" onClick={onOpenSuperAdmin}>
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
  );
}
