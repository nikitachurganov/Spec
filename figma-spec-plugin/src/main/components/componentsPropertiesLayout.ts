/// <reference types="@figma/plugin-typings" />

import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';
import { loadFontOnce, setTextCharactersWithFont } from '../figma/text';
import { hexToRgb, COLOR_TOKEN_MAP } from '../tokens/tokenMap';
import {
  resetVariantsTemplateLookupWarnings,
  resolveVariantsTemplateComponent,
  VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE,
  warnVariantsTemplateMissing,
} from './resolveVariantsTemplateComponent';
import {
  applyTemplateOrientation,
  configureAxisTemplateInstance,
  logTemplatePropertyDebug,
  safeAxisLabel,
} from './componentInstanceProperties';
import {
  DEBUG_COMPONENTS_PROPERTIES,
  VARIANTS_TEMPLATE_MISSING_WARNING,
} from './variantAxes';
import {
  getTemplateAxisPropertyNames,
  type ComponentVariantModel,
} from './componentVariantModel';
import type { ComponentsPropertiesSourceInfo } from './resolveComponentsPropertiesSource';

const LOG_PREFIX = '[Components & properties]';

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };
const FONT_BOLD: FontName = { family: 'PT Sans', style: 'Bold' };

const VARIANTS_LAYOUT_GAP = 16;

export const CHILD_COMPONENT_MESSAGE =
  'Блок был сгенерирован, так как выбран был дочерний компонент';

function stretchInParent(node: SceneNode): void {
  if (!('layoutAlign' in node)) return;
  try {
    (node as LayoutMixin).layoutAlign = 'STRETCH';
  } catch {
    /* ignore */
  }
}

function createVariantsLayoutFrame(
  name: string,
  layoutMode: 'HORIZONTAL' | 'VERTICAL'
): FrameNode {
  const frame = createPluginFrame();
  frame.name = name;
  frame.layoutMode = layoutMode;
  frame.itemSpacing = VARIANTS_LAYOUT_GAP;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;
  return frame;
}

function createLeftSpacer(width: number): FrameNode {
  const spacer = createPluginFrame();
  spacer.name = 'Variants left spacer';
  const roundedWidth = Math.max(0, Math.round(width));
  spacer.resize(roundedWidth, 1);
  if ('layoutSizingHorizontal' in spacer) {
    spacer.layoutSizingHorizontal = 'FIXED';
  }
  if ('layoutSizingVertical' in spacer) {
    spacer.layoutSizingVertical = 'FIXED';
  }
  spacer.fills = [];
  spacer.strokes = [];
  return spacer;
}

function cloneComponentSetForDocumentation(componentSet: ComponentSetNode): ComponentSetNode {
  const clone = componentSet.clone();
  clone.name = componentSet.name || 'Component set';
  return clone;
}

async function createBodyMessageText(message: string, layerName: string): Promise<TextNode> {
  const text = createPluginText();
  text.name = layerName;
  text.fontSize = 16;
  text.lineHeight = { unit: 'PERCENT', value: 130 };
  text.fills = [{ type: 'SOLID', color: hexToRgb(COLOR_TOKEN_MAP.textSecondary.fallback) }];
  text.textAutoResize = 'WIDTH_AND_HEIGHT';
  await setTextCharactersWithFont(text, message, FONT_REGULAR);
  return text;
}

async function buildMatrixContentNode(
  sourceInfo: ComponentsPropertiesSourceInfo
): Promise<SceneNode> {
  if (sourceInfo.sourceKind === 'child-component') {
    return createBodyMessageText(CHILD_COMPONENT_MESSAGE, 'Child component notice');
  }

  if (!sourceInfo.resolvedComponentSet) {
    return createBodyMessageText('Component set не найден.', 'Component set missing notice');
  }

  return cloneComponentSetForDocumentation(sourceInfo.resolvedComponentSet);
}

function createAxisTemplateInstance(template: ComponentNode, layerName: string): InstanceNode | null {
  try {
    const instance = template.createInstance();
    instance.name = layerName;
    return instance;
  } catch (error) {
    console.warn(`${LOG_PREFIX} createInstance ${layerName} failed`, error);
    return null;
  }
}

function inactiveAxisValue(): string {
  return '';
}

export type BuildVariantsTemplateResult = {
  templateRoot: SceneNode | null;
  usedFallback: boolean;
};

/**
 * Builds dual `.DS-Template-variants` axis instances (top + left) and places
 * Component Set clone / notice in `Component set content` beside them.
 */
export async function buildVariantsTemplateBlock(
  sourceInfo: ComponentsPropertiesSourceInfo,
  model: ComponentVariantModel
): Promise<BuildVariantsTemplateResult> {
  await loadFontOnce(FONT_REGULAR);
  await loadFontOnce(FONT_BOLD);

  resetVariantsTemplateLookupWarnings();

  const template = await resolveVariantsTemplateComponent();
  if (!template) {
    warnVariantsTemplateMissing();
    console.warn(VARIANTS_TEMPLATE_MISSING_WARNING);
    return { templateRoot: null, usedFallback: true };
  }

  const horizontalAxisInstance = createAxisTemplateInstance(
    template,
    'Variants horizontal axis'
  );
  const verticalAxisInstance = createAxisTemplateInstance(template, 'Variants vertical axis');

  if (!horizontalAxisInstance || !verticalAxisInstance) {
    return { templateRoot: null, usedFallback: true };
  }

  const { horizontal: horizontalAxisName, vertical: verticalAxisName } =
    getTemplateAxisPropertyNames(model);

  const horizontalLabel = safeAxisLabel(
    horizontalAxisName.trim() !== '' ? horizontalAxisName : 'Variant'
  );
  const verticalLabel =
    verticalAxisName.trim() !== '' ? safeAxisLabel(verticalAxisName) : inactiveAxisValue();

  configureAxisTemplateInstance(horizontalAxisInstance, template, {
    horizontal: horizontalLabel,
    vertical: inactiveAxisValue(),
  });
  applyTemplateOrientation(horizontalAxisInstance, template, 'horizontal');

  configureAxisTemplateInstance(verticalAxisInstance, template, {
    horizontal: inactiveAxisValue(),
    vertical: verticalLabel,
  });
  applyTemplateOrientation(verticalAxisInstance, template, 'vertical');

  const contentNode = await buildMatrixContentNode(sourceInfo);
  const componentSetContent = createVariantsLayoutFrame('Component set content', 'VERTICAL');
  componentSetContent.appendChild(contentNode);

  const verticalAxisWidth = verticalAxisInstance.width;
  const leftSpacer = createLeftSpacer(verticalAxisWidth);

  const topRow = createVariantsLayoutFrame('Variants top row', 'HORIZONTAL');
  topRow.appendChild(leftSpacer);
  topRow.appendChild(horizontalAxisInstance);

  const bodyRow = createVariantsLayoutFrame('Variants body row', 'HORIZONTAL');
  bodyRow.appendChild(verticalAxisInstance);
  bodyRow.appendChild(componentSetContent);

  const variantsLayout = createVariantsLayoutFrame('Variants layout', 'VERTICAL');
  variantsLayout.appendChild(topRow);
  variantsLayout.appendChild(bodyRow);

  logTemplatePropertyDebug(template, horizontalAxisInstance, verticalAxisInstance);

  if (DEBUG_COMPONENTS_PROPERTIES) {
    console.log(`${LOG_PREFIX} axis names`, {
      horizontal: horizontalLabel,
      vertical: verticalLabel,
      verticalAxisWidth,
    });
    console.log(`${LOG_PREFIX} content placement`, {
      contentLayer: componentSetContent.name,
      sourceKind: sourceInfo.sourceKind,
    });
  }

  return { templateRoot: variantsLayout, usedFallback: false };
}

/** Minimal fallback when `.DS-Template-variants` is unavailable. */
export async function buildTemplateMissingFallback(
  sourceInfo: ComponentsPropertiesSourceInfo,
  model: ComponentVariantModel
): Promise<FrameNode> {
  const frame = createPluginFrame();
  frame.name = 'Variants layout (fallback)';
  frame.layoutMode = 'VERTICAL';
  frame.itemSpacing = 24;
  frame.fills = [];
  frame.strokes = [];

  const notice = await createBodyMessageText(
    VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE,
    'Template missing notice'
  );
  frame.appendChild(notice);

  const contentNode = await buildMatrixContentNode(sourceInfo);
  const contentWrap = createVariantsLayoutFrame('Component set content', 'VERTICAL');
  contentWrap.appendChild(contentNode);
  frame.appendChild(contentWrap);

  void model;
  return frame;
}

async function createPropertyRow(axisName: string, index: number): Promise<FrameNode> {
  const row = createPluginFrame();
  row.name = `Property row / ${index + 1}`;
  row.layoutMode = 'HORIZONTAL';
  row.itemSpacing = 0;
  row.primaryAxisAlignItems = 'MIN';
  row.counterAxisAlignItems = 'CENTER';
  row.fills = [];
  row.strokes = [];

  const nameText = createPluginText();
  nameText.name = 'Property name';
  nameText.fontSize = 18;
  nameText.lineHeight = { unit: 'PERCENT', value: 130 };
  nameText.fills = [{ type: 'SOLID', color: hexToRgb('#1A1A1A') }];
  nameText.textAutoResize = 'WIDTH_AND_HEIGHT';
  await setTextCharactersWithFont(nameText, axisName, FONT_BOLD);

  const descText = createPluginText();
  descText.name = 'Property description';
  descText.fontSize = 18;
  descText.lineHeight = { unit: 'PERCENT', value: 130 };
  descText.fills = [{ type: 'SOLID', color: hexToRgb(COLOR_TOKEN_MAP.textSecondary.fallback) }];
  descText.textAutoResize = 'WIDTH_AND_HEIGHT';
  await setTextCharactersWithFont(descText, ' — описание.', FONT_REGULAR);

  row.appendChild(nameText);
  row.appendChild(descText);
  return row;
}

export async function buildPropertiesDescriptionList(
  model: ComponentVariantModel
): Promise<FrameNode> {
  const list = createPluginFrame();
  list.name = 'Properties description list';
  list.layoutMode = 'VERTICAL';
  list.itemSpacing = 16;
  list.fills = [];
  list.strokes = [];

  const axesForList =
    model.axes.length > 0
      ? model.axes
      : [{ name: 'Variant', values: model.variants.map((v) => v.component.name) }];

  for (let i = 0; i < axesForList.length; i++) {
    const row = await createPropertyRow(axesForList[i].name, i);
    list.appendChild(row);
    stretchInParent(row);
  }

  return list;
}
