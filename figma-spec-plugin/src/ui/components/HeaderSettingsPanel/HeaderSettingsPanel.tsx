import type { HeaderSettings } from '@shared/headerSettings';
import { HEADER_TEMPLATE_ERROR_MESSAGE } from '@shared/headerSettings';
import { LinkButton } from '../LinkButton';
import { ToggleRow } from '../ToggleRow';
import styles from './HeaderSettingsPanel.module.css';

export type HeaderSettingsPanelProps = {
  settings: HeaderSettings;
  statusOptions: string[];
  statusSizeOptions: string[];
  headerFound: boolean;
  savedTemplateName?: string | null;
  onChange: (patch: Partial<HeaderSettings>) => void;
  onSaveTemplateFromSelection?: () => void;
};

export function HeaderSettingsPanel({
  settings,
  statusOptions,
  statusSizeOptions,
  headerFound,
  savedTemplateName,
  onChange,
  onSaveTemplateFromSelection,
}: HeaderSettingsPanelProps) {
  return (
    <div className={styles.headerSettings}>
      {!headerFound ? (
        <p className={styles.hint}>{HEADER_TEMPLATE_ERROR_MESSAGE}</p>
      ) : savedTemplateName ? (
        <p className={styles.hint}>Header template: {savedTemplateName}</p>
      ) : null}

      {onSaveTemplateFromSelection ? (
        <LinkButton onClick={onSaveTemplateFromSelection}>
          Использовать выбранный компонент как Header template
        </LinkButton>
      ) : null}

      <ToggleRow
        label="Show Status"
        checked={settings.showStatus}
        onChange={(checked) => onChange({ showStatus: checked })}
      />

      <ToggleRow
        label="Show Description"
        checked={settings.showDescription}
        onChange={(checked) => onChange({ showDescription: checked })}
      />

      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          type="text"
          value={settings.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          value={settings.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Date</span>
        <input
          className={styles.input}
          type="text"
          value={settings.date}
          placeholder="ДД.ММ.ГГГГ"
          onChange={(event) => onChange({ date: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Project</span>
        <input
          className={styles.input}
          type="text"
          value={settings.project}
          onChange={(event) => onChange({ project: event.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Status</span>
        <select
          className={styles.select}
          value={settings.status}
          onChange={(event) => onChange({ status: event.target.value })}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Size</span>
        <select
          className={styles.select}
          value={settings.statusSize}
          onChange={(event) => onChange({ statusSize: event.target.value })}
        >
          {statusSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
