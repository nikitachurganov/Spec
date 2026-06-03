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

/** Cached alias used by documentation builders. */
export const ensureFontLoaded = loadFontOnce;

/**
 * Loads `fontName` and assigns it before `characters`.
 * New `figma.createText()` nodes default to Inter Regular, which must be loaded first.
 */
export async function setTextCharactersWithFont(
  text: TextNode,
  characters: string,
  fontName: FontName
): Promise<void> {
  await loadFontOnce(fontName);
  text.fontName = fontName;
  text.characters = characters;
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
