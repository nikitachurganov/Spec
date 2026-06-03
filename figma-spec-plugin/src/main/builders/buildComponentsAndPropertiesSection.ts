/// <reference types="@figma/plugin-typings" />

import { createPluginFrame, createPluginText } from '../figma/pluginSceneNodes';
import { loadFontOnce, setTextCharactersWithFont } from '../figma/text';
import { hexToRgb, SPEC_TOKEN_MAP, COLOR_TOKEN_MAP } from '../tokens/tokenMap';
import { getSpecBuildStyleContext } from '../tokens/specStyleContext';
import {
  buildPropertiesDescriptionList,
  buildTemplateMissingFallback,
  buildVariantsTemplateBlock,
} from '../components/componentsPropertiesLayout';
import { parseComponentSetVariants } from '../components/componentVariantModel';
import {
  DEBUG_COMPONENTS_PROPERTIES,
  NOT_COMPONENT_SET_MESSAGE,
  NO_VARIANTS_MESSAGE,
} from '../components/variantAxes';
import { resolveComponentsPropertiesSource } from '../components/resolveComponentsPropertiesSource';
import type { BuildContext } from './buildTypes';

const SECTION_FRAME_NAME = 'Components & properties';
const SECTION_TITLE_TEXT = 'Component and properties';
const SECTION_DESCRIPTION_TEXT = 'Описание';
const LOG_PREFIX = '[Components & properties]';

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };

const SECTION_TITLE_STYLE = {
  fontSize: 32,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
};

const DESCRIPTION_STYLE = {
  fontSize: 18,
  lineHeight: { unit: 'PERCENT' as const, value: 130 },
  color: hexToRgb(COLOR_TOKEN_MAP.textSecondary.fallback),
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
  const sectionTitleFont = SPEC_TOKEN_MAP.textStyles.sectionTitle.fallback.fontName;
  await loadFontOnce(FONT_REGULAR);
  await loadFontOnce(sectionTitleFont);

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

async function createSectionDescriptionText(): Promise<TextNode> {
  const text = createPluginText();
  text.name = `${SECTION_FRAME_NAME} description`;
  text.fontSize = DESCRIPTION_STYLE.fontSize;
  text.lineHeight = DESCRIPTION_STYLE.lineHeight;
  text.fills = [{ type: 'SOLID', color: DESCRIPTION_STYLE.color }];
  text.textAutoResize = 'WIDTH_AND_HEIGHT';
  await setTextCharactersWithFont(text, SECTION_DESCRIPTION_TEXT, FONT_REGULAR);

  const ctx = getSpecBuildStyleContext();
  if (ctx?.resolver) {
    try {
      await ctx.resolver.applyTextStyle(
        text,
        ['Body/Paragraph', 'Body/Paragraph (18px)', 'body/paragraph'],
        {
          fontName: FONT_REGULAR,
          fontSize: DESCRIPTION_STYLE.fontSize,
          lineHeight: DESCRIPTION_STYLE.lineHeight,
          fills: [{ type: 'SOLID', color: DESCRIPTION_STYLE.color }],
        }
      );
    } catch (error) {
      console.warn(`${LOG_PREFIX} description text style`, error);
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
  const componentSet = sourceInfo.resolvedComponentSet;
  if (!componentSet) return;

  const model = parseComponentSetVariants(componentSet);

  if (model.variants.length === 0) {
    const warning = await createWarningText(NO_VARIANTS_MESSAGE, `${SECTION_FRAME_NAME} warning`);
    content.appendChild(warning);
    stretchInParent(warning);
    return;
  }

  if (model.axes.length === 0) {
    console.warn(`${LOG_PREFIX} No variantProperties found for selected Component Set`);
  }

  const templateResult = await buildVariantsTemplateBlock(sourceInfo, model);

  if (templateResult.templateRoot) {
    content.appendChild(templateResult.templateRoot);
    stretchInParent(templateResult.templateRoot);
  } else {
    const fallback = await buildTemplateMissingFallback(sourceInfo, model);
    content.appendChild(fallback);
    stretchInParent(fallback);
  }

  const propertiesList = await buildPropertiesDescriptionList(model);
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

  void context.resolver;
  void context.spacingTokenResolver;

  const section = createSectionFrame(SECTION_FRAME_NAME, 32);
  stretchInParent(section);

  const intro = createSectionFrame(`${SECTION_FRAME_NAME} intro`, 12);
  const title = await createSectionTitleText();
  const description = await createSectionDescriptionText();
  intro.appendChild(title);
  stretchInParent(title);
  intro.appendChild(description);
  stretchInParent(description);
  section.appendChild(intro);
  stretchInParent(intro);

  const content = createSectionFrame(`${SECTION_FRAME_NAME} content`, 32);
  stretchInParent(content);

  const sourceInfo = await resolveComponentsPropertiesSource(context.root);

  if (!sourceInfo.resolvedComponentSet || sourceInfo.sourceKind === 'unsupported') {
    const warning = await createWarningText(NOT_COMPONENT_SET_MESSAGE, `${SECTION_FRAME_NAME} warning`);
    content.appendChild(warning);
    stretchInParent(warning);
    section.appendChild(content);
    stretchInParent(content);
    return section;
  }

  await fillComponentsPropertiesContent(content, sourceInfo);

  section.appendChild(content);
  stretchInParent(content);

  return section;
}
