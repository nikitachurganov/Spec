/// <reference types="@figma/plugin-typings" />

import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';
import type { HeaderSettings } from '../../shared/headerSettings';
import { applyHeaderSettingsToInstance } from '../header/applyHeaderSettings';
import {
  HEADER_TEMPLATE_ERROR_MESSAGE,
  notifyHeaderComponentMissing,
  resolveLocalHeaderComponent,
} from '../header/resolveHeaderComponent';

import { applyParagraphFontFamilyToken } from '../tokens/applyTokens';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import { hexToRgb } from '../tokens/tokenMap';

/** Совпадает с `SPECIFICATION_LAYOUT.width` в legacy. */
const SPECIFICATION_OUTER_WIDTH = 1440;

const HEADER_FALLBACK_FONT: FontName = { family: 'Inter', style: 'Regular' };

/**
 * Компонент шапки: локальный компонент или сохранённый Header template.
 */
export async function findDsTemplateHeader(): Promise<ComponentNode | null> {
  return resolveLocalHeaderComponent();
}

function tryStretchInAutoLayout(node: SceneNode): void {
  if (!('layoutAlign' in node)) return;
  try {
    (node as LayoutMixin).layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('Cannot stretch node in DS specification wrapper', node.name || '', error);
  }
}

async function appendHeaderComponentNotFoundFallback(wrapper: FrameNode): Promise<void> {
  try {
    await figma.loadFontAsync(HEADER_FALLBACK_FONT);
    const fallback = createPluginText();
    fallback.name = 'Header fallback';
    fallback.characters = HEADER_TEMPLATE_ERROR_MESSAGE;
    fallback.fontName = HEADER_FALLBACK_FONT;
    fallback.fontSize = 14;
    fallback.lineHeight = { unit: 'PERCENT', value: 130 };
    fallback.fills = [{ type: 'SOLID', color: hexToRgb('#8C8C8C') }];
    const ctx = getSpecBuildStyleContext();
    if (ctx?.resolver) {
      await applyParagraphFontFamilyToken(fallback, HEADER_FALLBACK_FONT, ctx.resolver);
    }
    wrapper.appendChild(fallback);
    tryStretchInAutoLayout(fallback);
  } catch (error) {
    console.warn('[SpecWrapper] Failed to create header fallback text', error);
  }
}

/**
 * Корень DS specification: два прямых ребёнка — инстанс шапки и фрейм спецификации.
 */
export type SpecificationWrapperOptions = {
  /** When false, neither header instance nor fallback text is added. */
  includeHeader?: boolean;
  headerSettings?: HeaderSettings;
  /** Used when headerSettings.name is empty. */
  defaultComponentName?: string;
};

export async function createSpecificationWrapper(
  rootName: string,
  headerInstance: InstanceNode | null,
  specificationFrame: FrameNode,
  options?: SpecificationWrapperOptions
): Promise<FrameNode> {
  const includeHeader = options?.includeHeader !== false;
  const wrapper = createPluginFrame();

  wrapper.name = `DS specification / ${rootName}`;
  wrapper.layoutMode = 'VERTICAL';
  wrapper.primaryAxisSizingMode = 'AUTO';
  wrapper.counterAxisSizingMode = 'FIXED';
  wrapper.resize(SPECIFICATION_OUTER_WIDTH, 100);

  wrapper.itemSpacing = 0;

  wrapper.paddingTop = 0;
  wrapper.paddingRight = 0;
  wrapper.paddingBottom = 0;
  wrapper.paddingLeft = 0;

  wrapper.fills = [];
  wrapper.strokes = [];
  wrapper.clipsContent = true;

  try {
    wrapper.cornerRadius = 30;
  } catch {
    /* ignore */
  }

  if (includeHeader) {
    if (headerInstance) {
      await applyHeaderSettingsToInstance(headerInstance, options?.headerSettings, {
        defaultComponentName: options?.defaultComponentName,
      });
      headerInstance.name = '.DS-Template-header/Default';

      try {
        headerInstance.layoutAlign = 'STRETCH';
      } catch (error) {
        console.warn('Cannot stretch header instance', error);
      }

      wrapper.appendChild(headerInstance);
    } else {
      notifyHeaderComponentMissing();
      await appendHeaderComponentNotFoundFallback(wrapper);
    }
  }

  specificationFrame.name = `Specification / ${rootName}`;

  try {
    specificationFrame.layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn('Cannot stretch Specification frame', error);
  }

  wrapper.appendChild(specificationFrame);

  return wrapper;
}

/**
 * Создаёт инстанс компонента шапки из файла и собирает внешний wrapper вокруг `Specification / …`.
 */
export async function assembleSpecificationWrapper(
  rootName: string,
  specificationFrame: FrameNode,
  headerComponent: ComponentNode | null,
  options?: SpecificationWrapperOptions
): Promise<FrameNode> {
  const includeHeader = options?.includeHeader !== false;
  let headerInstance: InstanceNode | null = null;

  if (includeHeader && headerComponent) {
    try {
      headerInstance = headerComponent.createInstance();
    } catch (e) {
      console.warn('[SpecWrapper] createInstance DS header failed', e);
    }
  }

  return createSpecificationWrapper(rootName, headerInstance, specificationFrame, {
    ...options,
    defaultComponentName: options?.defaultComponentName ?? rootName,
  });
}
