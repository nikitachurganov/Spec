/// <reference types="@figma/plugin-typings" />

/** Для совместимости; иконки собираются в `propertyIconResolver.ts`. */
export type ContainerCardForIcons = {
  layout: {
    direction: string;
    primaryAxisAlignment?: string;
    counterAxisAlignment?: string;
  };
};

/** Нормализация подписи: Padding-left, Padding Left → padding-left */
export function normalizeContainerPropertyKey(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/padding\s*-\s*/i, 'padding-')
    .replace(/padding\s+/i, 'padding-');
}
