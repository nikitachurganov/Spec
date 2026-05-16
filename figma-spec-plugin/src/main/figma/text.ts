/// <reference types="@figma/plugin-typings" />

import type { StyleResolver } from '../tokens/styleResolver';

export async function applyHeadingFontFamily(
  textNode: TextNode,
  resolver: StyleResolver,
  fallbackFontName: FontName
): Promise<void> {
  await resolver.applyFontFamilyToken(textNode, 'headingFontFamily', fallbackFontName);
}

export async function applyParagraphFontFamily(
  textNode: TextNode,
  resolver: StyleResolver,
  fallbackFontName: FontName
): Promise<void> {
  await resolver.applyFontFamilyToken(textNode, 'paragraphFontFamily', fallbackFontName);
}
