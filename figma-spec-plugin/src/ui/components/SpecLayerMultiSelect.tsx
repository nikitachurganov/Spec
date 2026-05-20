import type { SpecLayerOption } from '@shared/messages';

export type SpecLayerMultiSelectProps = {
  options: SpecLayerOption[];
  selectedPaths: string[];
  isLoading?: boolean;
  error?: string | null;
  emptyHint?: string | null;
  onChange: (selectedPaths: string[]) => void;
  onRefresh: () => void;
  onResetToAuto: () => void;
};

export function SpecLayerMultiSelect({
  options,
  selectedPaths,
  isLoading,
  error,
  emptyHint,
  onChange,
  onRefresh,
  onResetToAuto,
}: SpecLayerMultiSelectProps) {
  const selectedSet = new Set(selectedPaths);

  function togglePath(path: string, checked: boolean) {
    if (checked) {
      if (!selectedSet.has(path)) {
        onChange([...selectedPaths, path]);
      }
      return;
    }
    onChange(selectedPaths.filter((p) => p !== path));
  }

  return (
    <section className="spec-layer-settings">
      <div className="spec-layer-settings__header">
        <h2 className="spec-layer-settings__title">Настройки Spec</h2>
        <button
          type="button"
          className="spec-layer-settings__refresh"
          onClick={onRefresh}
          disabled={isLoading}
        >
          Обновить слои
        </button>
      </div>

      <div className="spec-layer-settings__subheader">
        <span className="spec-layer-settings__label">Слои для декомпозиции</span>
        <button
          type="button"
          className="spec-layer-settings__reset"
          onClick={onResetToAuto}
          disabled={isLoading || options.length === 0}
        >
          Сбросить к авто
        </button>
      </div>

      {isLoading ? (
        <p className="spec-layer-settings__hint">Загрузка слоёв…</p>
      ) : null}

      {error ? <p className="spec-layer-settings__hint spec-layer-settings__hint--error">{error}</p> : null}

      {!isLoading && !error && options.length === 0 && emptyHint ? (
        <p className="spec-layer-settings__hint">{emptyHint}</p>
      ) : null}

      {!isLoading && !error && options.length > 0 ? (
        <div className="spec-layer-list" role="listbox" aria-multiselectable="true">
          {options.map((option) => {
            const checked = selectedSet.has(option.path);
            const disabled = !option.isSelectable;

            return (
              <label
                key={option.path}
                className="spec-layer-row"
                data-disabled={disabled ? 'true' : 'false'}
                style={{ paddingLeft: `${12 + option.depth * 12}px` }}
              >
                <input
                  type="checkbox"
                  className="spec-layer-row__checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => togglePath(option.path, event.target.checked)}
                />
                <span className="spec-layer-row__name">{option.name}</span>
                <span className="spec-layer-row__meta">
                  <span className="spec-layer-row__type">{option.type}</span>
                  {option.isComponentBoundary ? (
                    <span className="spec-layer-row__badge">component</span>
                  ) : null}
                  {option.isAutoSelected ? (
                    <span className="spec-layer-row__badge">Авто</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
