import { type FormEvent, type MouseEvent } from 'react';
import { Badge, Box, Button, Card, Flex, Heading, Separator, Text, TextField } from '@radix-ui/themes';
import { ShieldCheck, X } from 'lucide-react';

import type { TenantUserProfile } from '../../types/app';

interface UserManagerDialogProps {
  isOpen: boolean;
  tenantUsers: TenantUserProfile[];
  newUserId: string;
  newUserName: string;
  newUserPassword: string;
  onUserIdChange: (value: string) => void;
  onUserNameChange: (value: string) => void;
  onUserPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  isCreatingUser: boolean;
  createUserError: string | null;
  createUserSuccess: string | null;
}

export function UserManagerDialog({
  isOpen,
  tenantUsers,
  newUserId,
  newUserName,
  newUserPassword,
  onUserIdChange,
  onUserNameChange,
  onUserPasswordChange,
  onSubmit,
  onClose,
  isCreatingUser,
  createUserError,
  createUserSuccess
}: UserManagerDialogProps) {
  if (!isOpen) return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="create-dialog" role="dialog" aria-modal="true" onClick={handleBackdrop}>
      <Card className="user-manager-card">
        <Flex justify="between" align="start" className="user-manager-header">
          <Flex gap="3" align="start">
            <Box className="user-manager-icon" aria-hidden>
              <ShieldCheck size={20} />
            </Box>
            <Box>
              <Heading as="h3" size="4">
                Quản lý người dùng
              </Heading>
              <Text as="p" size="2" color="gray">
                Thêm hoặc xem nhanh danh sách thành viên của tenant.
              </Text>
            </Box>
          </Flex>
          <Button variant="ghost" color="gray" onClick={onClose} aria-label="Đóng quản lý người dùng">
            <X size={16} aria-hidden />
          </Button>
        </Flex>

        <Separator my="4" size="4" />

        <Flex direction={{ initial: 'column', md: 'row' }} gap="5" className="user-manager-content">
          <Box flexGrow="1">
            <Heading as="h4" size="3" mb="3">
              Thành viên hiện có
            </Heading>
            <div className="user-manager-list">
              {tenantUsers.length ? (
                tenantUsers.map((user) => (
                  <Card key={user.userId} className="user-manager-item" variant="surface">
                    <Flex justify="between" align="center">
                      <Box>
                        <Text as="strong" size="3">
                          {user.displayName}
                        </Text>
                        <Text as="p" size="2" color="gray">
                          {user.userId}
                        </Text>
                      </Box>
                      <Badge color={user.roles.includes('admin') ? 'blue' : 'gray'}>{
                        user.roles.length ? user.roles.join(', ') : 'member'
                      }</Badge>
                    </Flex>
                  </Card>
                ))
              ) : (
                <Card variant="ghost" className="user-manager-empty">
                  <Text size="2" color="gray">
                    Chưa có người dùng nào trong tenant.
                  </Text>
                </Card>
              )}
            </div>
          </Box>

          <Box flexBasis="320px" className="user-manager-form">
            <Heading as="h4" size="3" mb="3">
              Thêm người dùng mới
            </Heading>
            <form
              className="user-manager-form-fields"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                onSubmit(event);
              }}
            >
              <label className="user-manager-field">
                <Text as="span" size="2" weight="medium">
                  Tài khoản đăng nhập
                </Text>
                <TextField.Root size="3">
                  <TextField.Input
                    value={newUserId}
                    onChange={(event) => onUserIdChange(event.target.value)}
                    placeholder="Ví dụ: user:khachhang"
                    autoComplete="username"
                  />
                </TextField.Root>
              </label>
              <label className="user-manager-field">
                <Text as="span" size="2" weight="medium">
                  Tên hiển thị
                </Text>
                <TextField.Root size="3">
                  <TextField.Input
                    value={newUserName}
                    onChange={(event) => onUserNameChange(event.target.value)}
                    placeholder="Tên sẽ hiển thị với mọi người"
                    autoComplete="name"
                  />
                </TextField.Root>
              </label>
              <label className="user-manager-field">
                <Text as="span" size="2" weight="medium">
                  Mật khẩu
                </Text>
                <TextField.Root size="3">
                  <TextField.Input
                    type="password"
                    value={newUserPassword}
                    onChange={(event) => onUserPasswordChange(event.target.value)}
                    placeholder="Đặt mật khẩu cho tài khoản"
                    autoComplete="new-password"
                  />
                </TextField.Root>
              </label>

              {createUserError && (
                <Text as="p" color="red" size="2" className="user-manager-feedback">
                  {createUserError}
                </Text>
              )}
              {createUserSuccess && (
                <Text as="p" color="green" size="2" className="user-manager-feedback">
                  {createUserSuccess}
                </Text>
              )}

              <Flex gap="3" mt="4">
                <Button type="button" variant="soft" color="gray" onClick={onClose} className="user-manager-cancel">
                  Đóng
                </Button>
                <Button type="submit" disabled={isCreatingUser} className="user-manager-submit">
                  {isCreatingUser ? 'Đang tạo...' : 'Tạo người dùng'}
                </Button>
              </Flex>
            </form>
          </Box>
        </Flex>
      </Card>
    </div>
  );
}
