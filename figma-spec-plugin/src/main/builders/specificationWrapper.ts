/// <reference types="@figma/plugin-typings" />

import { normalizeTokenName } from '../tokens/styleResolver';
import { hexToRgb } from '../tokens/tokenMap';

/** Совпадает с `SPECIFICATION_LAYOUT.width` в legacy. */
const SPECIFICATION_OUTER_WIDTH = 1440;

const HEADER_FALLBACK_FONT: FontName = { family: 'Inter', style: 'Regular' };

/**
 * Компонент шапки: полное имя варианта либо набор `.DS-Template-header` + вариант `Default`.
 */
export function findDsTemplateHeader(): ComponentNode | null {
  const fullMatch = normalizeTokenName('.DS-Template-header/Default');
  const setMatch = normalizeTokenName('.DS-Template-header');

  for (const child of figma.root.children) {
    if (child.type !== 'PAGE') continue;
    const hits = child.findAll(
      (n): n is ComponentNode | ComponentSetNode =>
        n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
    );

    for (const n of hits) {
      if (n.type === 'COMPONENT' && normalizeTokenName(n.name) === fullMatch) {
        return n;
      }
      if (n.type === 'COMPONENT_SET' && normalizeTokenName(n.name) === setMatch) {
        const def =
          (n.defaultVariant as ComponentNode | undefined) ??
          (n.children.find(
            (ch) =>
              ch.type === 'COMPONENT' &&
              normalizeTokenName(ch.name) === 'default'
          ) as ComponentNode | undefined);
        if (def?.type === 'COMPONENT') return def;
      }
    }
  }

  return null;
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
    const fallback = figma.createText();
    fallback.name = 'Header fallback';
    fallback.characters = 'Header component not found: .DS-Template-header/Default';
    fallback.fontName = HEADER_FALLBACK_FONT;
    fallback.fontSize = 14;
    fallback.lineHeight = { unit: 'PERCENT', value: 130 };
    fallback.fills = [{ type: 'SOLID', color: hexToRgb('#8C8C8C') }];
    wrapper.appendChild(fallback);
    tryStretchInAutoLayout(fallback);
  } catch (error) {
    console.warn('[SpecWrapper] Failed to create header fallback text', error);
  }
}

/**
 * Корень DS specification: два прямых ребёнка — инстанс шапки и фрейм спецификации.
 */
export async function createSpecificationWrapper(
  rootName: string,
  headerInstance: InstanceNode | null,
  specificationFrame: FrameNode
): Promise<FrameNode> {
  const wrapper = figma.createFrame();

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

  if (headerInstance) {
    headerInstance.name = '.DS-Template-header/Default';

    try {
      headerInstance.layoutAlign = 'STRETCH';
    } catch (error) {
      console.warn('Cannot stretch header instance', error);
    }

    wrapper.appendChild(headerInstance);
  } else {
    await appendHeaderComponentNotFoundFallback(wrapper);
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
  headerComponent: ComponentNode | null
): Promise<FrameNode> {
  let headerInstance: InstanceNode | null = null;

  if (headerComponent) {
    try {
      headerInstance = headerComponent.createInstance();
    } catch (e) {
      console.warn('[SpecWrapper] createInstance DS header failed', e);
    }
  }

  return createSpecificationWrapper(rootName, headerInstance, specificationFrame);
}
