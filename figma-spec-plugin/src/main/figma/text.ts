/// <reference types="@figma/plugin-typings" />

import type { StyleResolver } from '../tokens/styleResolver';

const loadedFonts = new Set<string>();

function fontCacheKey(fontName: FontName): string {
  return `${fontName.family}__${fontName.style}`;
}

export async function loadFontOnce(fontName: FontName): Promise<void> {
  const key = fontCacheKey(fontName);
  if (loadedFonts.has(key)) return;
  await figma.loadFontAsync(fontName);
  loadedFonts.add(key);
}

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
