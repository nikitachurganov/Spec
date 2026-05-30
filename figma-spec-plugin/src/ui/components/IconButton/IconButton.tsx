import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

export type IconButtonSize = 'tiny' | 'small' | 'medium';

export type IconButtonProps = {
  icon: ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: IconButtonSize;
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function IconButton({
  icon,
  ariaLabel,
  onClick,
  disabled = false,
  size = 'tiny',
  className,
  type = 'button',
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames(styles.iconButton, styles[size], className)}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.icon}>{icon}</span>
    </button>
  );
}
