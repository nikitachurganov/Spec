import styles from './LoadingState.module.css';

export type LoadingStateProps = {
  text?: string;
  minHeight?: number;
};

export function LoadingState({
  text = 'Загрузка слоев',
  minHeight = 160,
}: LoadingStateProps) {
  return (
    <div
      className={styles.loadingState}
      style={{ minHeight }}
      role="status"
    >
      <span className={styles.loadingSpinner} aria-hidden="true" />
      <div className={styles.loadingText}>{text}</div>
    </div>
  );
}
