import { type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { ShieldCheck, X } from 'lucide-react';

import type { TenantSummary } from '../../types/app';

interface SuperAdminDialogProps {
  isOpen: boolean;
  onClose: () => void;
  superAdminUsername: string;
  onSuperAdminUsernameChange: (value: string) => void;
  superAdminPassword: string;
  onSuperAdminPasswordChange: (value: string) => void;
  onSuperAdminLogin: (event: FormEvent<HTMLFormElement>) => void;
  isSuperAdminEnabled: boolean | null;
  isAuthenticatingSuperAdmin: boolean;
  superAdminToken: string;
  superAdminStatusMessage: string;
  superAdminError: string | null;
  onSuperAdminLogout: () => void;
  onRefreshTenants: () => void;
  isLoadingSuperAdmin: boolean;
  superAdminTenants: TenantSummary[];
  createTenantError: string | null;
  createTenantSuccess: string | null;
  newTenantId: string;
  onNewTenantIdChange: (value: string) => void;
  newTenantName: string;
  onNewTenantNameChange: (value: string) => void;
  newTenantClientId: string;
  onNewTenantClientIdChange: (value: string) => void;
  newTenantApiKey: string;
  onNewTenantApiKeyChange: (value: string) => void;
  newTenantPlan: 'free' | 'pro' | 'enterprise';
  onNewTenantPlanChange: (value: 'free' | 'pro' | 'enterprise') => void;
  onCreateTenant: (event: FormEvent<HTMLFormElement>) => void;
  createTenantAdminError: string | null;
  createTenantAdminSuccess: string | null;
  selectedTenantForAdmin: string;
  onSelectTenantForAdmin: (value: string) => void;
  newTenantAdminId: string;
  onNewTenantAdminIdChange: (value: string) => void;
  newTenantAdminName: string;
  onNewTenantAdminNameChange: (value: string) => void;
  newTenantAdminPassword: string;
  onNewTenantAdminPasswordChange: (value: string) => void;
  onCreateTenantAdmin: (event: FormEvent<HTMLFormElement>) => void;
}

export function SuperAdminDialog({
  isOpen,
  onClose,
  superAdminUsername,
  onSuperAdminUsernameChange,
  superAdminPassword,
  onSuperAdminPasswordChange,
  onSuperAdminLogin,
  isSuperAdminEnabled,
  isAuthenticatingSuperAdmin,
  superAdminToken,
  superAdminStatusMessage,
  superAdminError,
  onSuperAdminLogout,
  onRefreshTenants,
  isLoadingSuperAdmin,
  superAdminTenants,
  createTenantError,
  createTenantSuccess,
  newTenantId,
  onNewTenantIdChange,
  newTenantName,
  onNewTenantNameChange,
  newTenantClientId,
  onNewTenantClientIdChange,
  newTenantApiKey,
  onNewTenantApiKeyChange,
  newTenantPlan,
  onNewTenantPlanChange,
  onCreateTenant,
  createTenantAdminError,
  createTenantAdminSuccess,
  selectedTenantForAdmin,
  onSelectTenantForAdmin,
  newTenantAdminId,
  onNewTenantAdminIdChange,
  newTenantAdminName,
  onNewTenantAdminNameChange,
  newTenantAdminPassword,
  onNewTenantAdminPasswordChange,
  onCreateTenantAdmin
}: SuperAdminDialogProps) {
  if (!isOpen) return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="create-dialog" role="dialog" aria-modal="true" onClick={handleBackdrop}>
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
            onClick={onClose}
            aria-label="Đóng màn hình superadmin"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <section className="superadmin-section">
          <h4>Đăng nhập superadmin</h4>
          <form className="superadmin-form" onSubmit={onSuperAdminLogin}>
            <label>
              Tài khoản
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
            <div className="superadmin-actions">
              <button type="submit" disabled={isAuthenticatingSuperAdmin || isSuperAdminEnabled !== true}>
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
                    onClick={onRefreshTenants}
                    disabled={isLoadingSuperAdmin || isAuthenticatingSuperAdmin || isSuperAdminEnabled !== true}
                  >
                    {isLoadingSuperAdmin ? 'Đang tải...' : 'Tải danh sách tenant'}
                  </button>
                  <button type="button" className="superadmin-actions__secondary" onClick={onSuperAdminLogout}>
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
          <form className="superadmin-form" onSubmit={onCreateTenant}>
            <label>
              Tenant ID
              <input
                value={newTenantId}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantIdChange(event.target.value)}
                placeholder="Ví dụ: tenant-ban-hang"
              />
            </label>
            <label>
              Tên hiển thị
              <input
                value={newTenantName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantNameChange(event.target.value)}
                placeholder="Tên hiển thị cho tenant"
              />
            </label>
            <label>
              Client ID
              <input
                value={newTenantClientId}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantClientIdChange(event.target.value)}
                placeholder="Ví dụ: app-ban-hang"
              />
            </label>
            <label>
              API key
              <input
                value={newTenantApiKey}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantApiKeyChange(event.target.value)}
                placeholder="Khóa API cho client"
              />
            </label>
            <label>
              Gói dịch vụ
              <select value={newTenantPlan} onChange={(event) => onNewTenantPlanChange(event.target.value as 'free' | 'pro' | 'enterprise')}>
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
          <form className="superadmin-form" onSubmit={onCreateTenantAdmin}>
            <label>
              Tenant
              <select value={selectedTenantForAdmin} onChange={(event) => onSelectTenantForAdmin(event.target.value)} disabled={!superAdminToken}>
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
              <input
                value={newTenantAdminId}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantAdminIdChange(event.target.value)}
                placeholder="Ví dụ: admin:tenant"
              />
            </label>
            <label>
              Tên hiển thị
              <input
                value={newTenantAdminName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantAdminNameChange(event.target.value)}
                placeholder="Tên quản trị viên"
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                value={newTenantAdminPassword}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNewTenantAdminPasswordChange(event.target.value)}
                placeholder="Mật khẩu đăng nhập"
              />
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
  );
}
