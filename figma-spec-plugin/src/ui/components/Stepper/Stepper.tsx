import type { ReactNode } from 'react';
import styles from './Stepper.module.css';

export type StepperProps = {
  value: ReactNode;
  onMinus?: () => void;
  onPlus?: () => void;
  disabled?: boolean;
  minusAriaLabel?: string;
  plusAriaLabel?: string;
  className?: string;
};

function joinClassNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Stepper({
  value,
  onMinus,
  onPlus,
  disabled = false,
  minusAriaLabel = 'Уменьшить',
  plusAriaLabel = 'Увеличить',
  className,
}: StepperProps) {
  return (
    <div className={joinClassNames(styles.stepper, className)}>
      <div
        className={joinClassNames(styles.input, disabled && styles.inputDisabled)}
      >
        <button
          type="button"
          className={joinClassNames(styles.stepperButton, styles.minusButton)}
          disabled={disabled}
          aria-label={minusAriaLabel}
          onClick={onMinus}
        >
          <span className={styles.icon} aria-hidden="true">
            −
          </span>
        </button>
        <div className={styles.value}>{value}</div>
        <button
          type="button"
          className={joinClassNames(styles.stepperButton, styles.plusButton)}
          disabled={disabled}
          aria-label={plusAriaLabel}
          onClick={onPlus}
        >
          <span className={styles.icon} aria-hidden="true">
            +
          </span>
        </button>
      </div>
    </div>
  );
}
