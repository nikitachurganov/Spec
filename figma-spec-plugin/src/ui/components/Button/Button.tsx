import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonSize = 'medium' | 'small';

export type ButtonProps = {
  children: ReactNode;
  id?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  size?: ButtonSize;
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  children,
  id,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  className,
  type = 'button',
}: ButtonProps) {
  const isInteractiveDisabled = disabled || loading;
  const sizeClass = size === 'small' ? styles.buttonSmall : styles.buttonMedium;

  return (
    <button
      id={id}
      type={type}
      className={joinClassNames(
        styles.button,
        styles[variant],
        sizeClass,
        loading && styles.loading,
        disabled && !loading && styles.disabled,
        className
      )}
      disabled={isInteractiveDisabled}
      aria-busy={loading || undefined}
      aria-label={loading ? 'Собираю...' : undefined}
      onClick={onClick}
    >
      <span
        className={joinClassNames(styles.label, loading && styles.contentHidden)}
      >
        {children}
      </span>
      {loading ? (
        <span className={styles.spinnerSlot} aria-hidden="true">
          <span className={styles.spinner} />
        </span>
      ) : null}
    </button>
  );
}
