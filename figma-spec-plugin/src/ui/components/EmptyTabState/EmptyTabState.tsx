import { LinkButton } from '../LinkButton';
import styles from './EmptyTabState.module.css';

export type EmptyTabStateProps = {
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyTabState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyTabStateProps) {
  return (
    <div className={styles.root}>
      <div className={styles.body}>
        {title ? <p className={styles.title}>{title}</p> : null}
        <p className={styles.description}>{description}</p>
        {actionLabel && onAction ? (
          <LinkButton onClick={onAction}>{actionLabel}</LinkButton>
        ) : null}
      </div>
    </div>
  );
}
