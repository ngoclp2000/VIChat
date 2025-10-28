import { IconButton, Tooltip } from '@radix-ui/themes';
import { Moon, Sun } from 'lucide-react';

import type { AppTheme } from '../../types/app';

interface ThemeToggleProps {
  theme: AppTheme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  return (
    <Tooltip content={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
      <IconButton
        aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        onClick={onToggle}
        size="3"
        variant="soft"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>
    </Tooltip>
  );
}
