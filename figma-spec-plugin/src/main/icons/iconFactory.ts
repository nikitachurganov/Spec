/// <reference types="@figma/plugin-typings" />

import { SPEC_ICON_REGISTRY, type SpecIconName } from './iconRegistry';
import type { StyleResolver } from '../tokens/styleResolver';
import { COLOR_TOKEN_MAP, hexToRgb } from '../tokens/tokenMap';

const PROPERTY_ICON_SIZE = 16;
const missingIconWarnings = new Set<string>();

function getVectorNodesInsideIcon(node: SceneNode): Array<SceneNode & GeometryMixin> {
  const result: Array<SceneNode & GeometryMixin> = [];

  function walk(current: SceneNode): void {
    if (
      current.type === 'VECTOR' ||
      current.type === 'BOOLEAN_OPERATION' ||
      current.type === 'ELLIPSE' ||
      current.type === 'RECTANGLE' ||
      current.type === 'POLYGON' ||
      current.type === 'STAR' ||
      current.type === 'LINE'
    ) {
      if ('fills' in current) {
        result.push(current as SceneNode & GeometryMixin);
      }
    }

    if ('children' in current) {
      for (const child of current.children) {
        walk(child);
      }
    }
  }

  walk(node);
  return result;
}

/**
 * Создаёт иконку строки свойства: контейнер без заливки, заливка только на вложенных geometry.
 */
export async function createSpecIcon(
  iconName: SpecIconName,
  resolver: StyleResolver | null | undefined
): Promise<SceneNode | null> {
  const svg = SPEC_ICON_REGISTRY[iconName];

  if (!svg || typeof svg !== 'string') {
    if (!missingIconWarnings.has(iconName)) {
      console.warn('[SpecIcon] SVG not found for icon', iconName);
      missingIconWarnings.add(iconName);
    }
    return null;
  }

  const fillToken = COLOR_TOKEN_MAP.backgroundPrimaryInverse;
  const fallbackRgb = hexToRgb(fillToken.fallback);

  try {
    const figmaSvg = figma as PluginAPI & {
      createNodeFromSvg?: (raw: string) => SceneNode;
      createNodeFromSvgAsync?: (raw: string) => Promise<SceneNode>;
    };

    let icon: SceneNode;
    if (typeof figmaSvg.createNodeFromSvg === 'function') {
      icon = figmaSvg.createNodeFromSvg(svg);
    } else if (typeof figmaSvg.createNodeFromSvgAsync === 'function') {
      icon = await figmaSvg.createNodeFromSvgAsync(svg);
    } else {
      console.warn('[SpecIcon] createNodeFromSvg / Async unavailable');
      return null;
    }

    icon.name = `Property icon / ${iconName}`;

    const layout = icon as SceneNode & LayoutMixin;
    try {
      layout.resize(PROPERTY_ICON_SIZE, PROPERTY_ICON_SIZE);
    } catch {
      /* ignore */
    }

    icon.visible = true;
    if ('opacity' in icon) {
      (icon as BlendMixin).opacity = 1;
    }

    try {
      if ('fills' in icon) {
        icon.fills = [];
      }
      if ('strokes' in icon) {
        icon.strokes = [];
      }
    } catch (error) {
      console.warn('[SpecIcon] Cannot clear icon container paints', iconName, error);
    }

    const vectorNodes = getVectorNodesInsideIcon(icon);

    if (vectorNodes.length === 0) {
      console.warn('[SpecIcon] No vector nodes found inside icon', iconName);
    }

    for (const vectorNode of vectorNodes) {
      vectorNode.name = 'Vector';
      if (resolver) {
        await resolver.applyFill(vectorNode, [...fillToken.names], fallbackRgb);
      } else {
        vectorNode.fills = [{ type: 'SOLID', color: fallbackRgb }];
      }
    }

    return icon;
  } catch (error) {
    console.warn('[SpecIcon] Cannot create icon from SVG', iconName, error);
    return null;
  }
}
