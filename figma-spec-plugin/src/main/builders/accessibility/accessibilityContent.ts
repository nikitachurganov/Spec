export type KeyboardNavigationRow = { key: string; action: string };

export const KEYBOARD_ROWS: ReadonlyArray<KeyboardNavigationRow> = [
  {
    key: 'Tab',
    action:
      'Перемещает фокус. Фокусное состояние сообщается сверху-вниз, слево-направо',
  },
  {
    key: 'Shift + Tab',
    action: 'Перемещает фокус к предыдущему интерактивному элементу.',
  },
  { key: 'Enter / Space', action: 'Активирует элемент в фокусе.' },
];

export const SCREEN_READER_ITEMS: readonly string[] = [
  'Название элемента должно быть понятно без визуального контекста.',
  'Состояние элемента должно озвучиваться при изменении.',
  'Порядок чтения должен соответствовать визуальной структуре компонента.',
];
