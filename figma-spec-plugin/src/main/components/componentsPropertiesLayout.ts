/// <reference types="@figma/plugin-typings" />

import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';
import { loadFontOnce } from '../figma/text';
import { hexToRgb, SPEC_TOKEN_MAP, COLOR_TOKEN_MAP } from '../tokens/tokenMap';
import {
  resetVariantsTemplateLookupWarnings,
  VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE,
  warnVariantsTemplateMissing,
} from './resolveVariantsTemplateComponent';
import { resolveVariantsTemplateCached } from './templateLookupCache';
import {
  applyTemplateOrientation,
  beginTemplatePropertyConfiguration,
  configureAxisTemplateInstance,
  endTemplatePropertyConfiguration,
  logTemplatePropertyDebug,
  safeAxisLabel,
} from './componentInstanceProperties';
import {
  cpTimeEnd,
  cpTimeStart,
  warnComponentsPropertiesSlow,
} from './componentsPropertiesPerf';
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
const DEBUG_COMPONENTS_PROPERTIES_LAYOUT = false;

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };
const FONT_BOLD: FontName = { family: 'PT Sans', style: 'Bold' };

const VARIANTS_LAYOUT_GAP = 16;
const FALLBACK_VERTICAL_AXIS_WIDTH = 120;

/** Preload all fonts used by Components & properties once per section build. */
export async function preloadComponentsPropertiesFonts(): Promise<void> {
  cpTimeStart('[C&P] font loading');
  const sectionTitleFont = SPEC_TOKEN_MAP.textStyles.sectionTitle.fallback.fontName;
  await Promise.all([
    loadFontOnce(FONT_REGULAR),
    loadFontOnce(FONT_BOLD),
    loadFontOnce(sectionTitleFont),
  ]);
  cpTimeEnd('[C&P] font loading');
}

type LayoutSizingNode = FrameNode | InstanceNode | TextNode;

function safeLayoutSizing(
  node: LayoutSizingNode,
  axis: 'horizontal' | 'vertical',
  mode: 'FIXED' | 'FILL' | 'HUG'
): void {
  try {
    if (axis === 'horizontal') {
      node.layoutSizingHorizontal = mode;
    } else {
      node.layoutSizingVertical = mode;
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} layoutSizing`, node.name, axis, mode, error);
  }
}

function tryLayoutGrow(node: SceneNode, grow = 1): void {
  if (!('layoutGrow' in node)) return;
  try {
    (node as LayoutMixin).layoutGrow = grow;
  } catch (error) {
    console.warn(`${LOG_PREFIX} layoutGrow`, node.name, error);
  }
}

function applyHugContents(frame: FrameNode): void {
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
}

function resolveVerticalAxisWidth(verticalAxisInstance: InstanceNode): number {
  const width = verticalAxisInstance.width;
  if (Number.isFinite(width) && width > 0) {
    return Math.round(width);
  }

  console.warn(
    `${LOG_PREFIX} vertical axis width invalid (${width}), using fallback ${FALLBACK_VERTICAL_AXIS_WIDTH}`
  );
  return FALLBACK_VERTICAL_AXIS_WIDTH;
}

function syncLeftSpacerWidth(spacer: FrameNode, verticalAxisInstance: InstanceNode): number {
  const width = resolveVerticalAxisWidth(verticalAxisInstance);
  spacer.resize(width, 1);
  safeLayoutSizing(spacer, 'horizontal', 'FIXED');
  safeLayoutSizing(spacer, 'vertical', 'FIXED');
  return width;
}

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
  safeLayoutSizing(spacer, 'horizontal', 'FIXED');
  safeLayoutSizing(spacer, 'vertical', 'FIXED');
  spacer.fills = [];
  spacer.strokes = [];
  return spacer;
}

function applyTopRowFillSizing(topRow: FrameNode, horizontalAxisInstance: InstanceNode): void {
  stretchInParent(topRow);
  safeLayoutSizing(topRow, 'horizontal', 'FILL');
  safeLayoutSizing(topRow, 'vertical', 'HUG');

  safeLayoutSizing(horizontalAxisInstance, 'horizontal', 'FILL');
  safeLayoutSizing(horizontalAxisInstance, 'vertical', 'HUG');
  tryLayoutGrow(horizontalAxisInstance, 1);
}

function logComponentsPropertiesLayout(message: string, payload: Record<string, unknown>): void {
  if (!DEBUG_COMPONENTS_PROPERTIES_LAYOUT) return;
  console.log(`${LOG_PREFIX} ${message}`, payload);
}

function createBodyMessageTextSync(message: string, layerName: string): TextNode {
  const text = createPluginText();
  text.name = layerName;
  text.fontSize = 16;
  text.lineHeight = { unit: 'PERCENT', value: 130 };
  text.fills = [{ type: 'SOLID', color: hexToRgb(COLOR_TOKEN_MAP.textSecondary.fallback) }];
  text.textAutoResize = 'WIDTH_AND_HEIGHT';
  text.fontName = FONT_REGULAR;
  text.characters = message;
  return text;
}

function buildComponentSetContentFrame(
  sourceInfo: ComponentsPropertiesSourceInfo,
  _model: ComponentVariantModel
): FrameNode {
  cpTimeStart('[C&P] creating component set content');
  const componentSetContent = createVariantsLayoutFrame('Component set content', 'VERTICAL');
  try {
    // Intentionally moves the original selected node into the generated documentation.
    // Do not clone here: product requirement is to insert the original Component Set / Component.
    componentSetContent.appendChild(sourceInfo.initialSource);
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to move selected source into Component set content`, error);
    componentSetContent.appendChild(
      createBodyMessageTextSync('Не удалось переместить выбранный компонент.', 'Component move failed notice')
    );
  }
  cpTimeEnd('[C&P] creating component set content');
  return componentSetContent;
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
 * Builds dual `DS-Template-variants` axis instances (top + left) and places
 * Component Set clone / notice in `Component set content` beside them.
 */
export async function buildVariantsTemplateBlock(
  sourceInfo: ComponentsPropertiesSourceInfo,
  model: ComponentVariantModel
): Promise<BuildVariantsTemplateResult> {
  resetVariantsTemplateLookupWarnings();

  cpTimeStart('[C&P] DS-Template-variants lookup');
  const template = await resolveVariantsTemplateCached();
  cpTimeEnd('[C&P] DS-Template-variants lookup');
  if (!template) {
    warnVariantsTemplateMissing();
    console.warn(VARIANTS_TEMPLATE_MISSING_WARNING);
    return { templateRoot: null, usedFallback: true };
  }

  cpTimeStart('[C&P] DS-Template-variants instance creation');
  const horizontalAxisInstance = createAxisTemplateInstance(
    template,
    'Variants horizontal axis'
  );
  const verticalAxisInstance = createAxisTemplateInstance(template, 'Variants vertical axis');
  cpTimeEnd('[C&P] DS-Template-variants instance creation');

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

  cpTimeStart('[C&P] setting template instance props');
  beginTemplatePropertyConfiguration(template);
  try {
    cpTimeStart('[C&P] creating horizontal axis');
    if (
      !configureAxisTemplateInstance(horizontalAxisInstance, template, {
        horizontal: horizontalLabel,
        vertical: inactiveAxisValue(),
        type: 'horizontal',
      })
    ) {
      applyTemplateOrientation(horizontalAxisInstance, template, 'horizontal');
    }
    cpTimeEnd('[C&P] creating horizontal axis');

    cpTimeStart('[C&P] creating vertical axis');
    if (
      !configureAxisTemplateInstance(verticalAxisInstance, template, {
        horizontal: inactiveAxisValue(),
        vertical: verticalLabel,
        type: 'vertical',
      })
    ) {
      applyTemplateOrientation(verticalAxisInstance, template, 'vertical');
    }
    cpTimeEnd('[C&P] creating vertical axis');
  } finally {
    endTemplatePropertyConfiguration();
  }
  cpTimeEnd('[C&P] setting template instance props');

  cpTimeStart('[C&P] creating spacer/top/body layout');
  const componentSetContent = buildComponentSetContentFrame(sourceInfo, model);
  safeLayoutSizing(componentSetContent, 'vertical', 'HUG');

  const bodyRow = createVariantsLayoutFrame('Variants body row', 'HORIZONTAL');
  bodyRow.counterAxisAlignItems = 'MIN';
  bodyRow.appendChild(verticalAxisInstance);
  bodyRow.appendChild(componentSetContent);

  const verticalAxisWidth = resolveVerticalAxisWidth(verticalAxisInstance);
  const leftSpacer = createLeftSpacer(verticalAxisWidth);

  const topRow = createVariantsLayoutFrame('Variants top row', 'HORIZONTAL');
  topRow.appendChild(leftSpacer);
  topRow.appendChild(horizontalAxisInstance);

  const variantsLayout = createVariantsLayoutFrame('Variants layout', 'VERTICAL');
  applyHugContents(variantsLayout);
  if ('layoutAlign' in variantsLayout) {
    variantsLayout.layoutAlign = 'MIN';
  }
  variantsLayout.appendChild(topRow);
  variantsLayout.appendChild(bodyRow);
  cpTimeEnd('[C&P] creating spacer/top/body layout');

  cpTimeStart('[C&P] final positioning/layout operations');
  applyTopRowFillSizing(topRow, horizontalAxisInstance);
  safeLayoutSizing(verticalAxisInstance, 'horizontal', 'HUG');
  safeLayoutSizing(verticalAxisInstance, 'vertical', 'FILL');
  const syncedSpacerWidth = syncLeftSpacerWidth(leftSpacer, verticalAxisInstance);
  cpTimeEnd('[C&P] final positioning/layout operations');

  logComponentsPropertiesLayout('variants body sizing', {
    bodyRowHeight: bodyRow.height,
    bodyRowCounterAxisAlignItems: bodyRow.counterAxisAlignItems,
    verticalAxisHeight: verticalAxisInstance.height,
    verticalAxisLayoutSizingVertical: verticalAxisInstance.layoutSizingVertical,
    componentSetContentHeight: componentSetContent.height,
  });

  logTemplatePropertyDebug(template, horizontalAxisInstance, verticalAxisInstance);

  if (DEBUG_COMPONENTS_PROPERTIES) {
    console.log(`${LOG_PREFIX} axis names`, {
      horizontal: horizontalLabel,
      vertical: verticalLabel,
      verticalAxisWidth,
      syncedSpacerWidth,
    });
    console.log(`${LOG_PREFIX} layout sizing`, {
      variantsLayout: {
        primaryAxisSizingMode: variantsLayout.primaryAxisSizingMode,
        counterAxisSizingMode: variantsLayout.counterAxisSizingMode,
        layoutSizingHorizontal: variantsLayout.layoutSizingHorizontal,
        layoutSizingVertical: variantsLayout.layoutSizingVertical,
      },
      topRow: {
        layoutSizingHorizontal: topRow.layoutSizingHorizontal,
        layoutSizingVertical: topRow.layoutSizingVertical,
      },
      horizontalAxis: {
        layoutSizingHorizontal: horizontalAxisInstance.layoutSizingHorizontal,
        layoutSizingVertical: horizontalAxisInstance.layoutSizingVertical,
        layoutGrow:
          'layoutGrow' in horizontalAxisInstance ? horizontalAxisInstance.layoutGrow : undefined,
      },
    });
    console.log(`${LOG_PREFIX} content placement`, {
      contentLayer: componentSetContent.name,
      sourceKind: sourceInfo.sourceKind,
    });
  }

  return { templateRoot: variantsLayout, usedFallback: false };
}

/** Minimal fallback when `DS-Template-variants` is unavailable. */
export function buildTemplateMissingFallback(
  sourceInfo: ComponentsPropertiesSourceInfo,
  model: ComponentVariantModel
): FrameNode {
  const frame = createPluginFrame();
  frame.name = 'Variants layout (fallback)';
  frame.layoutMode = 'VERTICAL';
  frame.itemSpacing = 24;
  frame.fills = [];
  frame.strokes = [];

  frame.appendChild(
    createBodyMessageTextSync(VARIANTS_TEMPLATE_NOT_FOUND_MESSAGE, 'Template missing notice')
  );
  frame.appendChild(buildComponentSetContentFrame(sourceInfo, model));

  void model;
  return frame;
}

function applyPropertyRowSizing(row: FrameNode): void {
  stretchInParent(row);
  safeLayoutSizing(row, 'horizontal', 'FILL');
  safeLayoutSizing(row, 'vertical', 'HUG');
}

function createPropertyRow(axisName: string, index: number): FrameNode {
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
  nameText.fontName = FONT_BOLD;
  nameText.characters = axisName;
  safeLayoutSizing(nameText, 'horizontal', 'HUG');
  safeLayoutSizing(nameText, 'vertical', 'HUG');
  tryLayoutGrow(nameText, 0);

  const descText = createPluginText();
  descText.name = 'Property description';
  descText.fontSize = 18;
  descText.lineHeight = { unit: 'PERCENT', value: 130 };
  descText.fills = [{ type: 'SOLID', color: hexToRgb(COLOR_TOKEN_MAP.textSecondary.fallback) }];
  descText.textAutoResize = 'WIDTH_AND_HEIGHT';
  descText.fontName = FONT_REGULAR;
  descText.characters = ' — описание.';
  safeLayoutSizing(descText, 'horizontal', 'HUG');
  safeLayoutSizing(descText, 'vertical', 'HUG');
  tryLayoutGrow(descText, 0);

  row.appendChild(nameText);
  row.appendChild(descText);

  logComponentsPropertiesLayout('property row sizing', {
    rowName: row.name,
    rowWidth: row.width,
    rowLayoutSizingHorizontal: row.layoutSizingHorizontal,
    propertyNameWidth: nameText.width,
    propertyNameLayoutSizingHorizontal: nameText.layoutSizingHorizontal,
    propertyDescriptionWidth: descText.width,
    propertyDescriptionLayoutSizingHorizontal: descText.layoutSizingHorizontal,
    propertyDescriptionTextAutoResize: descText.textAutoResize,
  });

  return row;
}

export function buildPropertiesDescriptionList(model: ComponentVariantModel): FrameNode {
  cpTimeStart('[C&P] creating property list');

  const list = createPluginFrame();
  list.name = 'Properties description list';
  list.layoutMode = 'VERTICAL';
  list.itemSpacing = 16;
  list.primaryAxisSizingMode = 'AUTO';
  list.counterAxisSizingMode = 'AUTO';
  list.fills = [];
  list.strokes = [];
  safeLayoutSizing(list, 'horizontal', 'FILL');
  safeLayoutSizing(list, 'vertical', 'HUG');
  stretchInParent(list);

  const axesForList =
    model.axes.length > 0
      ? model.axes
      : [{ name: 'Variant', values: model.variants.map((v) => v.component.name) }];

  for (let i = 0; i < axesForList.length; i++) {
    const row = createPropertyRow(axesForList[i].name, i);
    list.appendChild(row);
    applyPropertyRowSizing(row);
  }

  logComponentsPropertiesLayout('properties list sizing', {
    listWidth: list.width,
    listLayoutSizingHorizontal: list.layoutSizingHorizontal,
    listLayoutSizingVertical: list.layoutSizingVertical,
    rowCount: list.children.length,
  });

  cpTimeEnd('[C&P] creating property list');
  return list;
}
