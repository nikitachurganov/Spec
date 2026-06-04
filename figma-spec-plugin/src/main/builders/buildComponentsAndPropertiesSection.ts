/// <reference types="@figma/plugin-typings" />

import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';
import { setTextCharactersWithFont } from '../figma/text';
import { hexToRgb } from '../tokens/tokenMap';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import {
  buildPropertiesDescriptionList,
  buildTemplateMissingFallback,
  buildVariantsTemplateBlock,
  preloadComponentsPropertiesFonts,
} from '../components/componentsPropertiesLayout';
import type { ComponentVariantModel } from '../components/componentVariantModel';
import { parseComponentSetVariants } from '../components/componentVariantModel';
import {
  DEBUG_COMPONENTS_PROPERTIES,
  NOT_COMPONENT_SET_MESSAGE,
  NO_VARIANTS_MESSAGE,
} from '../components/variantAxes';
import { resolveComponentsPropertiesSource } from '../components/resolveComponentsPropertiesSource';
import {
  cpTimeEnd,
  cpTimeStart,
  warnComponentsPropertiesSlow,
} from '../components/componentsPropertiesPerf';
import type { BuildContext } from './buildTypes';

const SECTION_FRAME_NAME = 'Components & properties';
const SECTION_TITLE_TEXT = 'Component and properties';
const LOG_PREFIX = '[Components & properties]';

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };

const SECTION_TITLE_STYLE = {
  fontSize: 32,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const WARNING_TEXT_STYLE = {
  fontSize: 14,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
  color: hexToRgb('#8C8C8C'),
};

function stretchInParent(node: SceneNode): void {
  if (!('layoutAlign' in node)) return;
  try {
    (node as LayoutMixin).layoutAlign = 'STRETCH';
  } catch (error) {
    console.warn(`${LOG_PREFIX} stretchInParent`, node.name, error);
  }
}

function createSectionFrame(name: string, itemSpacing: number): FrameNode {
  const frame = createPluginFrame();
  frame.name = name;
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.itemSpacing = itemSpacing;
  frame.paddingTop = 0;
  frame.paddingRight = 0;
  frame.paddingBottom = 0;
  frame.paddingLeft = 0;
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;
  return frame;
}

async function createWarningText(message: string, name: string): Promise<TextNode> {
  const text = createPluginText();
  text.name = name;
  text.fontSize = WARNING_TEXT_STYLE.fontSize;
  text.lineHeight = WARNING_TEXT_STYLE.lineHeight;
  text.fills = [{ type: 'SOLID', color: WARNING_TEXT_STYLE.color }];
  await setTextCharactersWithFont(text, message, FONT_REGULAR);
  return text;
}

async function createSectionTitleText(): Promise<TextNode> {
  const text = createPluginText();
  text.name = `${SECTION_FRAME_NAME} title`;
  text.fontSize = SECTION_TITLE_STYLE.fontSize;
  text.lineHeight = SECTION_TITLE_STYLE.lineHeight;
  text.fills = [{ type: 'SOLID', color: hexToRgb('#1A1A1A') }];
  await setTextCharactersWithFont(text, SECTION_TITLE_TEXT, FONT_REGULAR);

  const ctx = getSpecBuildStyleContext();
  if (ctx?.apply && ctx.resolver) {
    try {
      await ctx.apply.applySectionTitleTokens(text, ctx.resolver);
    } catch (error) {
      console.warn(`${LOG_PREFIX} section title tokens`, error);
    }
  }

  return text;
}

function logComponentsPropertiesDebug(
  sourceInfo: Awaited<ReturnType<typeof resolveComponentsPropertiesSource>>
): void {
  if (!DEBUG_COMPONENTS_PROPERTIES) return;

  console.log(`${LOG_PREFIX} sourceKind`, sourceInfo.sourceKind);
  console.log(`${LOG_PREFIX} initialSource`, {
    type: sourceInfo.initialSource.type,
    name: sourceInfo.initialSource.name,
    id: sourceInfo.initialSource.id,
  });
  console.log(`${LOG_PREFIX} resolvedComponentSet`, sourceInfo.resolvedComponentSet?.name ?? null);
}

async function fillComponentsPropertiesContent(
  content: FrameNode,
  sourceInfo: Awaited<ReturnType<typeof resolveComponentsPropertiesSource>>
): Promise<void> {
  let model: ComponentVariantModel;
  const componentSet = sourceInfo.resolvedComponentSet;
  if (componentSet) {
    cpTimeStart('[C&P] parse variants');
    model = parseComponentSetVariants(componentSet);
    cpTimeEnd('[C&P] parse variants');

    if (model.variants.length === 0) {
      const warning = await createWarningText(NO_VARIANTS_MESSAGE, `${SECTION_FRAME_NAME} warning`);
      content.appendChild(warning);
      stretchInParent(warning);
      return;
    }
  } else {
    model = {
      componentSetName: sourceInfo.initialSource.name,
      axes: [],
      variants: [],
    };
  }

  if (model.axes.length === 0) {
    console.warn(`${LOG_PREFIX} No variantProperties found for selected Component Set`);
  }

  const templateResult = await buildVariantsTemplateBlock(sourceInfo, model);

  if (templateResult.templateRoot) {
    content.appendChild(templateResult.templateRoot);
  } else {
    const fallback = buildTemplateMissingFallback(sourceInfo, model);
    content.appendChild(fallback);
    stretchInParent(fallback);
  }

  const propertiesList = buildPropertiesDescriptionList(model);
  content.appendChild(propertiesList);
  stretchInParent(propertiesList);

  logComponentsPropertiesDebug(sourceInfo);
}

/** Builds the Components & properties documentation section from the selected Component Set. */
export async function buildComponentsAndPropertiesSection(
  context: BuildContext
): Promise<FrameNode | null> {
  if (context.settings.componentsProperties === false) {
    return null;
  }

  const sectionStart = Date.now();
  cpTimeStart('[C&P] total');

  void context.resolver;
  void context.spacingTokenResolver;

  await preloadComponentsPropertiesFonts();

  const section = createSectionFrame(SECTION_FRAME_NAME, 32);
  stretchInParent(section);

  const title = await createSectionTitleText();
  section.appendChild(title);
  stretchInParent(title);

  const content = createSectionFrame(`${SECTION_FRAME_NAME} content`, 32);
  stretchInParent(content);

  cpTimeStart('[C&P] source resolution');
  const sourceInfo = await resolveComponentsPropertiesSource(context.root);
  cpTimeEnd('[C&P] source resolution');

  if (sourceInfo.sourceKind === 'unsupported') {
    const warning = await createWarningText(NOT_COMPONENT_SET_MESSAGE, `${SECTION_FRAME_NAME} warning`);
    content.appendChild(warning);
    stretchInParent(warning);
    cpTimeStart('[C&P] appending nodes into final section');
    section.appendChild(content);
    stretchInParent(content);
    cpTimeEnd('[C&P] appending nodes into final section');

    cpTimeEnd('[C&P] total');
    warnComponentsPropertiesSlow(Date.now() - sectionStart);
    return section;
  }

  await fillComponentsPropertiesContent(content, sourceInfo);

  cpTimeStart('[C&P] appending nodes into final section');
  section.appendChild(content);
  stretchInParent(content);
  cpTimeEnd('[C&P] appending nodes into final section');

  cpTimeEnd('[C&P] total');
  warnComponentsPropertiesSlow(Date.now() - sectionStart);

  return section;
}
