export type KeyboardKeyCombination = string[];

export type KeyboardKeyAction = {
  keys: KeyboardKeyCombination[];
  action: string;
};

const DEFAULT_KEYBOARD_ROWS_RU: ReadonlyArray<KeyboardKeyAction> = [
  {
    keys: [['Tab']],
    action: 'Перемещает фокус к следующему интерактивному элементу.',
  },
  {
    keys: [['Shift', 'Tab']],
    action: 'Перемещает фокус к предыдущему интерактивному элементу.',
  },
  {
    keys: [['Enter']],
    action: 'Активирует элемент в фокусе или подтверждает выбранное действие.',
  },
];

const COMPONENT_KEYBOARD_ROWS_RU: ReadonlyArray<KeyboardKeyAction> = [
  {
    keys: [['Space']],
    action: 'Активирует элемент в фокусе.',
  },
];

function keyboardRowKey(row: KeyboardKeyAction): string {
  const keysPart = row.keys.map((combo) => combo.join('+')).join(',');
  return `${keysPart}|${row.action.trim()}`;
}

export function getKeyboardRows(): KeyboardKeyAction[] {
  const merged = [...DEFAULT_KEYBOARD_ROWS_RU, ...COMPONENT_KEYBOARD_ROWS_RU];
  const seen = new Set<string>();
  const out: KeyboardKeyAction[] = [];
  for (const row of merged) {
    const key = keyboardRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export const SCREEN_READER_ITEMS: readonly string[] = [
  'Название элемента должно быть понятно без визуального контекста.',
  'Состояние элемента должно озвучиваться при изменении.',
  'Интерактивные элементы должны иметь доступное имя.',
  'Ошибки и системные сообщения должны передаваться через aria-live, если они появляются динамически.',
];

export type AriaCodeColumn = {
  title: string;
  code: string;
};

const DEFAULT_ARIA_COLUMNS: ReadonlyArray<AriaCodeColumn> = [
  {
    title: 'Container',
    code: '',
  },
  {
    title: 'Trigger',
    code: '',
  },
];

/** Generic ARIA markup examples for the documentation ARIA block. */
export function normalizeAriaCodeExample(code?: string): string {
  const normalized = code?.trim();
  if (!normalized) {
    return 'aria-label=""';
  }
  return code!;
}

export function getAriaColumns(): AriaCodeColumn[] {
  return DEFAULT_ARIA_COLUMNS.map((column) => ({
    title: column.title,
    code: normalizeAriaCodeExample(column.code),
  }));
}
