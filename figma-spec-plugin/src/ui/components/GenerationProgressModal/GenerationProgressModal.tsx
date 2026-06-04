import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GenerationProgressStep } from '@shared/messages';
import { Button } from '../Button';
import { Portal } from '../Portal/Portal';
import styles from './GenerationProgressModal.module.css';

export type GenerationProgressModalProps = {
  open: boolean;
  steps: GenerationProgressStep[];
  isComplete: boolean;
  error?: string | null;
  generatedNodeId?: string | null;
  onClose: () => void;
  onDelete: () => void;
};

function getDescription(isComplete: boolean, error?: string | null): string {
  if (error) {
    return 'Не удалось завершить сборку. Проверьте этап, на котором возникла ошибка.';
  }
  if (isComplete) {
    return 'Документация готова.';
  }
  return 'Плагин собирает выбранные блоки. Это может занять некоторое время.';
}

function getStatusText(status: GenerationProgressStep['status']): string {
  switch (status) {
    case 'pending':
      return 'Ожидает';
    case 'running':
      return 'Выполняется';
    case 'success':
      return 'Готово';
    case 'error':
      return 'Ошибка';
    case 'skipped':
      return 'Пропущено';
    default:
      return 'Ожидает';
  }
}

export function GenerationProgressModal({
  open,
  steps,
  isComplete,
  error = null,
  generatedNodeId = null,
  onClose,
  onDelete,
}: GenerationProgressModalProps) {
  const titleId = useId();
  const deleteConfirmPopoverId = useId();
  const deleteConfirmTitleId = useId();
  const deleteCancelButtonId = useId();
  const closeButtonId = `${titleId}-close`;
  const isRunning = !isComplete && !error;
  const isSuccess = isComplete && !error;
  const isError = Boolean(error);
  const description = useMemo(() => getDescription(isComplete, error), [isComplete, error]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteButtonWrapperRef = useRef<HTMLDivElement | null>(null);
  const deleteConfirmPopoverRef = useRef<HTMLDivElement | null>(null);

  const handleDeleteClick = () => {
    setDeleteConfirmOpen((prev) => !prev);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
  };

  const handleConfirmDelete = () => {
    setDeleteConfirmOpen(false);
    onDelete();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const closeButton = document.getElementById(closeButtonId);
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.focus();
    }
  }, [open, closeButtonId]);

  useEffect(() => {
    if (!open) {
      setDeleteConfirmOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!deleteConfirmOpen) return;
    const cancelButton = document.getElementById(deleteCancelButtonId);
    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.focus();
    }
  }, [deleteConfirmOpen, deleteCancelButtonId]);

  useEffect(() => {
    if (!deleteConfirmOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedInsidePopover = deleteConfirmPopoverRef.current?.contains(target) ?? false;
      const clickedInsideDeleteWrapper =
        deleteButtonWrapperRef.current?.contains(target) ?? false;

      if (clickedInsidePopover || clickedInsideDeleteWrapper) {
        return;
      }

      setDeleteConfirmOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [deleteConfirmOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, deleteConfirmOpen]);

  if (!open) return null;

  return (
    <Portal>
      <div className={styles.overlay}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={styles.modalDialog}
        >
          <div className={styles.modalHeader}>
            <h2 id={titleId} className={styles.headerTitle}>
              Сборка документации
            </h2>
            <button
              type="button"
              className={styles.dismissButton}
              aria-label="Закрыть"
              onClick={onClose}
            >
              <svg
                className={styles.dismissIcon}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className={styles.modalContent}>
            <ol className={styles.timeline} aria-live="polite">
              {steps.map((step, index) => (
                <li
                  key={step.id}
                  className={styles.timelineItem}
                  data-status={step.status}
                  aria-current={step.status === 'running' ? 'step' : undefined}
                >
                  <div className={styles.timelineMarkerRow}>
                    <div className={styles.timelineRail} aria-hidden="true">
                      <span className={styles.timelineMarker} data-status={step.status}>
                        {step.status === 'error' ? '!' : ''}
                      </span>
                    </div>
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineTitle}>{step.title}</span>
                      <span className={styles.srOnly}>{getStatusText(step.status)}</span>
                    </div>
                  </div>
                  {index < steps.length - 1 ? (
                    <div className={styles.timelineConnectorRow} aria-hidden="true">
                      <div className={styles.timelineRail}>
                        <span className={styles.timelineConnectorWrap}>
                          <span className={styles.timelineConnector} data-status={step.status} />
                        </span>
                      </div>
                      <div className={styles.timelineConnectorContentSpacer} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            {error ? (
              <div className={styles.globalError}>
                {description}
              </div>
            ) : null}
          </div>

          <div className={styles.modalFooter}>
            <div className={styles.buttonGroup}>
              {isRunning ? (
                <Button variant="secondary" size="small" onClick={onClose}>
                  Отменить
                </Button>
              ) : null}
              {isSuccess ? (
                <>
                  <Button
                    id={closeButtonId}
                    variant="primary"
                    size="small"
                    onClick={onClose}
                  >
                    Готово
                  </Button>
                  {generatedNodeId ? (
                    <div ref={deleteButtonWrapperRef} className={styles.deleteButtonWrapper}>
                      {deleteConfirmOpen ? (
                        <div
                          id={deleteConfirmPopoverId}
                          ref={deleteConfirmPopoverRef}
                          className={styles.deleteConfirmPopover}
                          role="alertdialog"
                          aria-labelledby={deleteConfirmTitleId}
                        >
                          <h3 id={deleteConfirmTitleId} className={styles.deleteConfirmTitle}>
                            Удалить документацию?
                          </h3>
                          <div className={styles.deleteConfirmActions}>
                            <Button variant="danger" size="small" onClick={handleConfirmDelete}>
                              Да
                            </Button>
                            <Button
                              id={deleteCancelButtonId}
                              variant="secondary"
                              size="small"
                              onClick={handleCancelDelete}
                            >
                              Нет
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <Button
                        variant="danger"
                        size="small"
                        onClick={handleDeleteClick}
                      >
                        Удалить
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
              {isError ? (
                <Button
                  id={closeButtonId}
                  variant="primary"
                  size="small"
                  onClick={onClose}
                >
                  Готово
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
