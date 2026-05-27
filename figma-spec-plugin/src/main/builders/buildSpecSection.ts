/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';

import { loadFontOnce } from '../figma/text';

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };

export type SpecContainersEmptyStateMode = 'manual' | 'auto';

/**
 * Empty state when Spec is enabled but no containers were built.
 */
export async function createSpecContainersEmptyState(
  mode: SpecContainersEmptyStateMode = 'auto'
): Promise<FrameNode> {
  const wrap = createPluginFrame();
  wrap.name = 'Spec empty state';
  wrap.layoutMode = 'VERTICAL';
  wrap.itemSpacing = 8;
  wrap.primaryAxisSizingMode = 'AUTO';
  wrap.counterAxisSizingMode = 'AUTO';
  wrap.fills = [];
  wrap.strokes = [];
  wrap.clipsContent = false;
  wrap.paddingTop = 8;
  wrap.paddingRight = 0;
  wrap.paddingBottom = 8;
  wrap.paddingLeft = 0;

  await loadFontOnce(FONT_REGULAR);

  const title = createPluginText();
  title.name = 'Spec empty title';
  title.fontName = FONT_REGULAR;
  title.fontSize = 14;
  title.lineHeight = { unit: 'PERCENT', value: 130 };
  title.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  title.characters =
    mode === 'manual' ? 'Не найдено слоёв для Spec' : 'Не найдено контейнеров для Spec';
  wrap.appendChild(title);

  const description = createPluginText();
  description.name = 'Spec empty description';
  description.fontName = FONT_REGULAR;
  description.fontSize = 12;
  description.lineHeight = { unit: 'PERCENT', value: 130 };
  description.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
  description.textAutoResize = 'HEIGHT';
  description.resize(400, description.height);
  description.characters =
    mode === 'manual'
      ? 'Выбранные слои нельзя декомпозировать. Выберите Auto Layout контейнеры или очистите выбор.'
      : 'Плагин не нашёл подходящих Auto Layout контейнеров в выбранном компоненте.';
  wrap.appendChild(description);

  return wrap;
}
