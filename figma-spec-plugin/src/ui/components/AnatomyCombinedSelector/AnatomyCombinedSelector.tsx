import type { AnatomyPreviewPayload } from '@shared/anatomyPreview';
import type { SpecLayerOption } from '@shared/messages';
import { AnatomyPreviewSelector } from '../AnatomyPreviewSelector/AnatomyPreviewSelector';
import { SpecLayerMultiSelect } from '../SpecLayerMultiSelect';
import styles from './AnatomyCombinedSelector.module.css';

export type AnatomyCombinedSelectorProps = {
  options: SpecLayerOption[];
  preview: AnatomyPreviewPayload | null;
  selectedPaths: string[];
  isLoading?: boolean;
  error?: string | null;
  emptyHint?: string | null;
  rootId?: string | null;
  onSelectedPathsChange: (paths: string[]) => void;
  onResetToAuto?: () => void;
};

export function AnatomyCombinedSelector({
  options,
  preview,
  selectedPaths,
  isLoading,
  error,
  emptyHint,
  rootId,
  onSelectedPathsChange,
  onResetToAuto,
}: AnatomyCombinedSelectorProps) {
  return (
    <section className={styles.root}>
      <p className={styles.hint}>
        Выбирайте элементы в дереве или прямо на превью. Оба способа синхронизированы.
      </p>
      <div className={styles.panels}>
        <div className={`${styles.panel} ${styles.panelPreview}`}>
          <h3 className={styles.panelTitle}>Preview</h3>
          <AnatomyPreviewSelector
            payload={preview}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={onSelectedPathsChange}
          />
        </div>
        <div className={`${styles.panel} ${styles.panelTree}`}>
          <h3 className={styles.panelTitle}>Layers</h3>
          <div className={styles.treeWrap}>
            <SpecLayerMultiSelect
              options={options}
              selectedPaths={selectedPaths}
              isLoading={isLoading}
              error={error}
              emptyHint={emptyHint}
              onChange={onSelectedPathsChange}
              onResetToAuto={onResetToAuto}
              rootId={rootId}
              showHeader={false}
              showRefresh={false}
              showResetButton
              cascadeSelection={false}
              title="Декомпозиция анатомии"
            />
          </div>
        </div>
      </div>
      <p className={styles.summary}>
        Выбрано элементов: {selectedPaths.length}. Пустой выбор = автоматический режим Anatomy.
      </p>
    </section>
  );
}
