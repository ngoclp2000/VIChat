import { type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import Select, { type StylesConfig } from 'react-select';
import { MessageCirclePlus, User, Users, X } from 'lucide-react';

import type { UserOption } from '../../types/app';

interface CreateConversationDialogProps {
  isOpen: boolean;
  memberOptions: UserOption[];
  selectedMemberOptions: UserOption[];
  onMembersChange: (options: UserOption[]) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  createConversationType: 'group' | 'dm';
  conversationPreviewName: string | null;
  newConversationName: string;
  onGroupNameChange: (value: string, isDirty: boolean) => void;
  creationError: string | null;
  canSubmitConversation: boolean;
  createConversationLabel: string;
  sharedSelectStyles: StylesConfig<UserOption, true>;
}

export function CreateConversationDialog({
  isOpen,
  memberOptions,
  selectedMemberOptions,
  onMembersChange,
  onClose,
  onSubmit,
  createConversationType,
  conversationPreviewName,
  newConversationName,
  onGroupNameChange,
  creationError,
  canSubmitConversation,
  createConversationLabel,
  sharedSelectStyles
}: CreateConversationDialogProps) {
  if (!isOpen) return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="create-dialog" role="dialog" aria-modal="true" onClick={handleBackdrop}>
      <form className="create-card" onSubmit={onSubmit}>
        <header className="create-card__header">
          <div className="create-card__title">
            <MessageCirclePlus size={20} aria-hidden />
            <div>
              <h3>Cuộc trò chuyện mới</h3>
              <p>Chọn người nhận để bắt đầu kết nối.</p>
            </div>
          </div>
          <button type="button" className="create-card__close" onClick={onClose} aria-label="Đóng tạo cuộc trò chuyện">
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="create-card__summary">
          <span className="summary-pill">
            <Users size={16} aria-hidden />
            {selectedMemberOptions.length ? `${selectedMemberOptions.length} thành viên` : 'Chưa chọn'}
          </span>
          <span className={`summary-type summary-type--${createConversationType}`}>
            {createConversationType === 'group' ? <Users size={16} aria-hidden /> : <User size={16} aria-hidden />}
            {createConversationLabel}
          </span>
        </div>
        <p className="create-card__hint">
          Hãy chọn người bạn muốn trò chuyện. Chọn một người để bắt đầu cuộc trò chuyện riêng hoặc nhiều người để lập nhóm và đặt
          tên bên dưới.
        </p>

        <label className="create-card__field">
          <span>Thành viên</span>
          <Select<UserOption, true>
            classNamePrefix="rs"
            styles={sharedSelectStyles}
            options={memberOptions}
            value={selectedMemberOptions}
            onChange={(value) => onMembersChange(Array.isArray(value) ? value : [])}
            placeholder="Tìm kiếm và chọn thành viên..."
            isMulti
            isSearchable
            isClearable
            closeMenuOnSelect={false}
            noOptionsMessage={() => 'Không tìm thấy thành viên phù hợp'}
            formatOptionLabel={(option: UserOption) => <span className="user-option__name-only">{option.label}</span>}
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
                const value = event.target.value;
                onGroupNameChange(value, Boolean(value.trim().length));
              }}
              placeholder={conversationPreviewName || 'Tên nhóm'}
            />
          </label>
        )}

        {creationError && <p className="create-card__error">{creationError}</p>}

        <div className="create-card__actions">
          <button type="button" className="create-card__cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" disabled={!canSubmitConversation}>
            Bắt đầu trò chuyện
          </button>
        </div>
      </form>
    </div>
  );
}
