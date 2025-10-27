import React, { useEffect, useMemo, useRef, useState } from 'react';

export type ChangeAction = 'select-option' | 'deselect-option' | 'remove-value';
export type SingleValue<Option> = Option | null;
export type MultiValue<Option> = Option[];

export interface FormatOptionLabelMeta {
  context: 'menu' | 'value';
}

export interface OptionBase {
  value: unknown;
  label?: React.ReactNode;
  [key: string]: unknown;
}

export interface SelectProps<Option extends OptionBase = OptionBase> {
  options?: Option[];
  value?: SingleValue<Option> | MultiValue<Option>;
  onChange?: (value: SingleValue<Option> | MultiValue<Option>, meta: { action: ChangeAction; option: Option }) => void;
  isMulti?: boolean;
  classNamePrefix?: string;
  placeholder?: string;
  isDisabled?: boolean;
  isSearchable?: boolean;
  formatOptionLabel?: (option: Option, meta: FormatOptionLabelMeta) => React.ReactNode;
  isLoading?: boolean;
  noOptionsMessage?: (context: { inputValue: string }) => React.ReactNode;
  menuPlacement?: 'auto' | 'top' | 'bottom';
}

const defaultNoOptions = () => 'No options';

function getOptionLabel<Option extends OptionBase>(option: Option | null | undefined): string {
  if (!option) return '';
  const { label, value } = option;
  if (typeof label === 'string') return label;
  if (label != null) return String(label);
  if (typeof value === 'string') return value;
  if (value != null) return String(value);
  return '';
}

function getOptionKey<Option extends OptionBase>(option: Option | null | undefined): string {
  if (!option) return '';
  const { value, label } = option;
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (value != null) {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }
  if (label != null) {
    return getOptionLabel(option);
  }
  return '';
}

const createClassName = (prefix: string, element: string, modifiers: Array<string | false | null | undefined>): string => {
  const base = `${prefix}__${element}`;
  const modifierClasses = modifiers.filter(Boolean).map((modifier) => `${base}--${modifier}`);
  return [base, ...modifierClasses].join(' ');
};

function Select<Option extends OptionBase = OptionBase>(props: SelectProps<Option>): JSX.Element {
  const {
    options = [],
    value,
    onChange,
    isMulti = false,
    classNamePrefix = 'react-select',
    placeholder = 'Select...',
    isDisabled = false,
    isSearchable = true,
    formatOptionLabel,
    isLoading = false,
    noOptionsMessage,
    menuPlacement = 'auto'
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const selectedSingle: Option | null = !isMulti && value && !Array.isArray(value) ? (value as Option) : null;

  const selectedArray = useMemo<Option[]>(() => {
    if (isMulti) {
      if (Array.isArray(value)) {
        return (value as Option[]).filter((item): item is Option => Boolean(item));
      }
      if (value && !Array.isArray(value)) {
        return [value as Option];
      }
      return [];
    }

    return selectedSingle ? [selectedSingle] : [];
  }, [isMulti, value, selectedSingle]);

  const valueMap = useMemo(() => {
    const map = new Map<string, Option>();
    for (const option of selectedArray) {
      map.set(getOptionKey(option), option);
    }
    return map;
  }, [selectedArray]);

  const filteredOptions = useMemo(() => {
    if (isLoading) {
      return [] as Option[];
    }

    if (!search.trim()) {
      return options;
    }

    const query = search.trim().toLowerCase();
    return options.filter((option) => {
      const label = getOptionLabel(option).toLowerCase();
      const key = getOptionKey(option).toLowerCase();
      return label.includes(query) || key.includes(query);
    });
  }, [isLoading, options, search]);

  useEffect(() => {
    if (!menuOpen) {
      setSearch('');
      setFocusedIndex(-1);
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && isSearchable !== false) {
      inputRef.current?.focus();
    }
  }, [isSearchable, menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setSearch('');
    setFocusedIndex(-1);
  };

  const handleControlClick = () => {
    if (isDisabled) return;
    setMenuOpen((prev) => !prev);
  };

  const emitChange = (next: SingleValue<Option> | MultiValue<Option>, action: ChangeAction, option: Option) => {
    onChange?.(next, { action, option });
  };

  const handleOptionSelect = (option: Option) => {
    if (isMulti) {
      const key = getOptionKey(option);
      const exists = valueMap.has(key);
      if (exists) {
        const next = selectedArray.filter((item) => getOptionKey(item) !== key);
        emitChange(next, 'deselect-option', option);
      } else {
        const next = [...selectedArray, option];
        emitChange(next, 'select-option', option);
      }
    } else {
      emitChange(option, 'select-option', option);
      closeMenu();
    }
  };

  const handleRemove = (option: Option) => {
    if (!isMulti) return;
    const key = getOptionKey(option);
    const next = selectedArray.filter((item) => getOptionKey(item) !== key);
    emitChange(next, 'remove-value', option);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isDisabled) return;

    if (!menuOpen && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setMenuOpen(true);
      return;
    }

    if (!menuOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev + 1;
        if (next >= filteredOptions.length) return 0;
        return next;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((prev) => {
        if (prev <= 0) return Math.max(filteredOptions.length - 1, 0);
        return prev - 1;
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[focusedIndex];
      if (option) {
        handleOptionSelect(option);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };

  const prefix = classNamePrefix;
  const isPlaceholderVisible = isMulti ? selectedArray.length === 0 : !selectedSingle;
  const renderedPlaceholder = isPlaceholderVisible ? placeholder : null;

  const renderOption = (option: Option, context: FormatOptionLabelMeta['context']) => {
    if (typeof formatOptionLabel === 'function') {
      return formatOptionLabel(option, { context });
    }
    return getOptionLabel(option);
  };

  const menuStyles: React.CSSProperties = menuPlacement === 'top' ? { bottom: '100%' } : {};

  return (
    <div
      className={`${prefix}__container`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
      aria-haspopup="listbox"
      aria-expanded={menuOpen}
    >
      <button
        type="button"
        className={createClassName(prefix, 'control', [
          isDisabled ? 'is-disabled' : '',
          menuOpen ? 'menu-is-open' : '',
          menuOpen ? 'is-focused' : ''
        ])}
        onClick={handleControlClick}
        disabled={isDisabled}
      >
        <div className={createClassName(prefix, 'value-container', [])}>
          {isMulti && selectedArray.length > 0 && (
            <div className={createClassName(prefix, 'multi-value-wrapper', [])}>
              {selectedArray.map((option) => {
                const key = getOptionKey(option);
                return (
                  <span key={key} className={createClassName(prefix, 'multi-value', [])}>
                    <span className={createClassName(prefix, 'multi-value__label', [])}>
                      {renderOption(option, 'value')}
                    </span>
                    <button
                      type="button"
                      className={createClassName(prefix, 'multi-value__remove', [])}
                      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                        event.stopPropagation();
                        handleRemove(option);
                      }}
                      aria-label="Remove selected option"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {!isMulti && selectedSingle && (
            <span className={createClassName(prefix, 'single-value', [])}>
              {renderOption(selectedSingle, 'value')}
            </span>
          )}
          {renderedPlaceholder && (
            <span className={createClassName(prefix, 'placeholder', [])}>{renderedPlaceholder}</span>
          )}
          {isSearchable !== false && !isDisabled && (
            <input
              ref={inputRef}
              className={createClassName(prefix, 'input', [])}
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
              onFocus={() => setMenuOpen(true)}
              placeholder=""
            />
          )}
        </div>
        <span className={createClassName(prefix, 'indicator', [])}>▾</span>
      </button>
      {menuOpen && (
        <div className={createClassName(prefix, 'menu', [])} style={menuStyles} role="listbox">
          <div className={createClassName(prefix, 'menu-list', [])}>
            {isLoading && (
              <div className={createClassName(prefix, 'loading-indicator', [])}>Đang tải...</div>
            )}
            {!isLoading && filteredOptions.length === 0 && (
              <div className={createClassName(prefix, 'no-options', [])}>
                {(noOptionsMessage ?? defaultNoOptions)({ inputValue: search })}
              </div>
            )}
            {!isLoading &&
              filteredOptions.map((option: Option, index: number) => {
                const key = getOptionKey(option);
                const isSelected = valueMap.has(key);
                const optionClasses = createClassName(prefix, 'option', [
                  isSelected ? 'is-selected' : '',
                  index === focusedIndex ? 'is-focused' : ''
                ]);
                return (
                  <div
                    key={key}
                    className={optionClasses}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
                      event.preventDefault();
                      handleOptionSelect(option);
                    }}
                  >
                    {renderOption(option, 'menu')}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Select;
export const components: Record<string, React.ComponentType<unknown>> = {};
export const createFilter = () => () => true;
