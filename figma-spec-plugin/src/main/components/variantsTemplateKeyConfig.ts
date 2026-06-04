/// <reference types="@figma/plugin-typings" />

/** TODO: Fill with the published component key of DS-Template-variants from DS Assets. */
export const VARIANTS_TEMPLATE_LIBRARY_KEY = '';

export const VARIANTS_TEMPLATE_KEY_STORAGE_KEY = 'dsTemplateVariantsComponentKey';

export async function getStoredVariantsTemplateKey(): Promise<string | null> {
  const value = await figma.clientStorage.getAsync(VARIANTS_TEMPLATE_KEY_STORAGE_KEY);

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function setStoredVariantsTemplateKey(key: string): Promise<void> {
  await figma.clientStorage.setAsync(VARIANTS_TEMPLATE_KEY_STORAGE_KEY, key.trim());
}
