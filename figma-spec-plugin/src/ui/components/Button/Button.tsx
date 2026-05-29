import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'link';
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  className,
  type = 'button',
}: ButtonProps) {
  const isInteractiveDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={joinClassNames(
        styles.button,
        styles[variant],
        loading && styles.loading,
        disabled && !loading && styles.disabled,
        className
      )}
      disabled={isInteractiveDisabled}
      aria-busy={loading || undefined}
      aria-label={loading ? 'Собираю...' : undefined}
      onClick={onClick}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <span className={styles.label}>{children}</span>
      )}
    </button>
  );
}
