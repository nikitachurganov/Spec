import type { ReactNode } from 'react';
import styles from './LinkButton.module.css';

export type LinkButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
};

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function LinkButton({
  children,
  onClick,
  className,
  disabled = false,
}: LinkButtonProps) {
  return (
    <button
      type="button"
      className={joinClassNames(styles.link, className)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
