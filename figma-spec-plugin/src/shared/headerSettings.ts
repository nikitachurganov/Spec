export type HeaderSettings = {
  showStatus: boolean;
  showDescription: boolean;
  name: string;
  description: string;
  date: string;
  project: string;
  status: string;
  statusSize: string;
};

export const HEADER_COMPONENT_NAME = '.DS-Template-header/Default';

export const HEADER_TEMPLATE_ERROR_MESSAGE =
  'Не найден локальный компонент .DS-Template-header/Default. Добавьте его в файл или выберите компонент шапки как Header template.';

export const DEFAULT_STATUS_OPTIONS = [
  'Draft',
  'Ready',
  'Deprecated',
  'In progress',
] as const;

export const DEFAULT_STATUS_SIZE_OPTIONS = ['Small', 'Medium', 'Large'] as const;

export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  showStatus: true,
  showDescription: true,
  name: '',
  description: '',
  date: '',
  project: '',
  status: 'Draft',
  statusSize: 'Medium',
};

export function normalizeHeaderSettings(value: unknown): HeaderSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_HEADER_SETTINGS };
  }

  const input = value as Partial<HeaderSettings>;

  return {
    showStatus:
      typeof input.showStatus === 'boolean'
        ? input.showStatus
        : DEFAULT_HEADER_SETTINGS.showStatus,
    showDescription:
      typeof input.showDescription === 'boolean'
        ? input.showDescription
        : DEFAULT_HEADER_SETTINGS.showDescription,
    name: typeof input.name === 'string' ? input.name : DEFAULT_HEADER_SETTINGS.name,
    description:
      typeof input.description === 'string'
        ? input.description
        : DEFAULT_HEADER_SETTINGS.description,
    date: typeof input.date === 'string' ? input.date : DEFAULT_HEADER_SETTINGS.date,
    project:
      typeof input.project === 'string' ? input.project : DEFAULT_HEADER_SETTINGS.project,
    status:
      typeof input.status === 'string' && input.status.trim()
        ? input.status
        : DEFAULT_HEADER_SETTINGS.status,
    statusSize:
      typeof input.statusSize === 'string' && input.statusSize.trim()
        ? input.statusSize
        : DEFAULT_HEADER_SETTINGS.statusSize,
  };
}

export function formatHeaderDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}
