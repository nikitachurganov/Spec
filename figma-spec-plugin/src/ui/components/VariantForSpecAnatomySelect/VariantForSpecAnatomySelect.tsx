import type { ComponentSetVariantOption } from '@shared/componentSetVariants';
import styles from './VariantForSpecAnatomySelect.module.css';

export type VariantForSpecAnatomySelectProps = {
  options: ComponentSetVariantOption[];
  value: string | null;
  disabled?: boolean;
  onChange: (variantId: string) => void;
};

export function VariantForSpecAnatomySelect({
  options,
  value,
  disabled = false,
  onChange,
}: VariantForSpecAnatomySelectProps) {
  if (options.length === 0) {
    return (
      <div className={styles.root}>
        <label className={styles.label}>Variant for Anatomy and Spec</label>
        <p className={styles.hint}>В Component Set нет вариантов для Anatomy и Spec.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor="variant-for-spec-anatomy">
        Variant for Anatomy and Spec
      </label>
      <select
        id="variant-for-spec-anatomy"
        className={styles.select}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
