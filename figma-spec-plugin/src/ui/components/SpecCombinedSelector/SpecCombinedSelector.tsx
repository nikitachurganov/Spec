import type { AnatomyPreviewPayload } from '@shared/anatomyPreview';
import type { SpecLayerOption } from '@shared/messages';
import { AnatomyPreviewSelector } from '../AnatomyPreviewSelector/AnatomyPreviewSelector';
import { SpecLayerMultiSelect } from '../SpecLayerMultiSelect';
import styles from './SpecCombinedSelector.module.css';

export type SpecCombinedSelectorProps = {
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

export function SpecCombinedSelector({
  options,
  preview,
  selectedPaths,
  isLoading,
  error,
  emptyHint,
  rootId,
  onSelectedPathsChange,
  onResetToAuto,
}: SpecCombinedSelectorProps) {
  return (
    <section className={styles.root}>
      <div className={styles.splitArea}>
        <div className={styles.previewSection}>
          <AnatomyPreviewSelector
            payload={preview}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={onSelectedPathsChange}
            purpose="spec"
            showTitle={false}
            selectedCountLabel={`Выбрано: ${selectedPaths.length} эл.`}
            fallbackText="Preview is unavailable. Use the layer tree to select Spec containers."
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
            title="Декомпозиция Spec"
          />
        </div>
      </div>
    </section>
  );
}
