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
  const hasSource = Boolean(rootId);
  return (
    <section className={styles.root}>
      <div className={styles.splitArea}>
        <div className={styles.previewSection}>
          <AnatomyPreviewSelector
            payload={preview}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={onSelectedPathsChange}
            showTitle={false}
            selectedCountLabel={`Выбрано: ${selectedPaths.length} эл.`}
            emptyStateTitle={hasSource ? 'Превью недоступно' : 'Выберите слой'}
            emptyStateDescription={
              hasSource
                ? 'Используйте дерево для выбора элементов.'
                : 'Выберите фрейм, компонент или инстанс на холсте, чтобы увидеть превью.'
            }
          />
        </div>
        <div className={styles.decompositionDivider} />
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
            showResetButton={false}
            cascadeSelection={false}
            title="Декомпозиция анатомии"
          />
        </div>
      </div>
    </section>
  );
}
