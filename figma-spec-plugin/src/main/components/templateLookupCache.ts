/// <reference types="@figma/plugin-typings" />

import { ensureDocumentReadyForTraversal } from '../figma/documentAccess';
import {
  DS_ASSETS_LIBRARY_NAME,
  LEGACY_VARIANTS_TEMPLATE_NAME,
  VARIANTS_TEMPLATE_KEY_IMPORT_FAILED_MESSAGE,
  VARIANTS_TEMPLATE_NAME,
  VARIANTS_TEMPLATE_NAME_CANDIDATES,
  VARIANTS_TEMPLATE_NOT_PUBLISHED_MESSAGE,
  VARIANTS_TEMPLATE_UNAVAILABLE_MESSAGE,
} from './variantAxes';
import {
  getStoredVariantsTemplateKey,
  setStoredVariantsTemplateKey,
  VARIANTS_TEMPLATE_LIBRARY_KEY,
} from './variantsTemplateKeyConfig';

export { DS_ASSETS_LIBRARY_NAME } from './variantAxes';

/** Set true to log Team Library diagnostics for template resolution. */
export const DEBUG_TEMPLATE_LIBRARY_LOOKUP = false;

const LOG_PREFIX = '[Components & properties]';

type AvailableLibraryComponentMeta = {
  key: string;
  name: string;
  libraryName: string;
};

type TeamLibraryComponentApi = {
  getAvailableLibraryComponentsAsync?: () => Promise<AvailableLibraryComponentMeta[]>;
};

type VariantsTemplateNode = ComponentNode | ComponentSetNode;

function normalizeLookupName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._]/g, '')
    .replace(/[/-]/g, '');
}

function isLooseNameMatch(value: string, target: string): boolean {
  const normalizedValue = normalizeLookupName(value);
  const normalizedTarget = normalizeLookupName(target);

  return (
    normalizedValue === normalizedTarget ||
    normalizedValue.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedValue)
  );
}

function isVariantsTemplateName(name: string): boolean {
  return (
    isLooseNameMatch(name, VARIANTS_TEMPLATE_NAME) ||
    isLooseNameMatch(name, LEGACY_VARIANTS_TEMPLATE_NAME)
  );
}

function isDsAssetsLibraryName(libraryName: string): boolean {
  return isLooseNameMatch(libraryName, DS_ASSETS_LIBRARY_NAME);
}

function isExactVariantsTemplateName(name: string): boolean {
  return (
    name === VARIANTS_TEMPLATE_NAME ||
    name === LEGACY_VARIANTS_TEMPLATE_NAME ||
    name.endsWith(`/${VARIANTS_TEMPLATE_NAME}`) ||
    name.endsWith(`/${LEGACY_VARIANTS_TEMPLATE_NAME}`)
  );
}

function pickVariantFromComponentSet(setNode: ComponentSetNode): ComponentNode | null {
  const defaultVariant = setNode.defaultVariant;
  if (defaultVariant?.type === 'COMPONENT') {
    return defaultVariant;
  }

  const firstComponent = setNode.children.find(
    (child): child is ComponentNode => child.type === 'COMPONENT'
  );
  return firstComponent ?? null;
}

let cachedVariantsTemplate: ComponentNode | null | undefined;
let cachedVariantsTemplatePromise: Promise<ComponentNode | null> | null = null;
let cachedLibraryComponentsPromise: Promise<AvailableLibraryComponentMeta[]> | null = null;
let isResolvingVariantsTemplate = false;

export function resetGenerationTemplateCache(): void {
  cachedVariantsTemplate = undefined;
  cachedVariantsTemplatePromise = null;
  cachedLibraryComponentsPromise = null;
}

/** Finds local `DS-Template-variants` as COMPONENT or COMPONENT_SET. */
export async function findLocalVariantsTemplateNode(): Promise<VariantsTemplateNode | null> {
  await ensureDocumentReadyForTraversal();

  for (const name of VARIANTS_TEMPLATE_NAME_CANDIDATES) {
    const node = figma.root.findOne(
      (candidate) =>
        (candidate.type === 'COMPONENT' || candidate.type === 'COMPONENT_SET') &&
        candidate.name === name
    );

    if (node?.type === 'COMPONENT' || node?.type === 'COMPONENT_SET') {
      return node;
    }
  }

  return null;
}

function resolveLocalVariantsTemplateForUse(node: VariantsTemplateNode): ComponentNode | null {
  if (node.type === 'COMPONENT') {
    return node;
  }

  const picked = pickVariantFromComponentSet(node);
  if (!picked) {
    console.warn(
      `${LOG_PREFIX} Local "${VARIANTS_TEMPLATE_NAME}" component set has no usable variant component.`
    );
  }
  return picked;
}

/**
 * When the plugin runs in a file that contains the local template, persist its published key
 * for import in other files.
 */
export async function syncVariantsTemplateKeyFromLocalFile(): Promise<string | null> {
  const template = await findLocalVariantsTemplateNode();
  if (!template) {
    return null;
  }

  const key = template.key?.trim();
  if (!key) {
    console.warn(
      `${LOG_PREFIX} Local "${VARIANTS_TEMPLATE_NAME}" was found, but key is empty.`
    );
    return null;
  }

  await setStoredVariantsTemplateKey(key);
  console.info(
    `${LOG_PREFIX} Local "${VARIANTS_TEMPLATE_NAME}" found. Component key saved automatically.`
  );
  return key;
}

function getTeamLibraryApi(): TeamLibraryComponentApi | null {
  const teamLibrary = (figma as PluginAPI & { teamLibrary?: TeamLibraryComponentApi }).teamLibrary;
  if (!teamLibrary) {
    return null;
  }
  if (typeof teamLibrary.getAvailableLibraryComponentsAsync !== 'function') {
    return null;
  }
  return teamLibrary;
}

function logLibraryLookupDebug(message: string, payload?: unknown): void {
  if (!DEBUG_TEMPLATE_LIBRARY_LOOKUP) return;
  if (payload !== undefined) {
    console.debug(`[Templates] ${message}`, payload);
    return;
  }
  console.debug(`[Templates] ${message}`);
}

function logAvailableLibraryDiagnostics(components: AvailableLibraryComponentMeta[]): void {
  if (!DEBUG_TEMPLATE_LIBRARY_LOOKUP) return;

  const teamLibrary = (figma as PluginAPI & { teamLibrary?: TeamLibraryComponentApi }).teamLibrary;
  logLibraryLookupDebug('teamLibrary available', Boolean(teamLibrary));
  logLibraryLookupDebug(
    'getAvailableLibraryComponentsAsync available',
    Boolean(teamLibrary?.getAvailableLibraryComponentsAsync)
  );
  logLibraryLookupDebug('available library components count', components.length);
  logLibraryLookupDebug(
    'available library names',
    Array.from(new Set(components.map((component) => component.libraryName)))
  );
  logLibraryLookupDebug(
    'possible template components',
    components
      .filter((component) => /template|variant|variants/i.test(component.name))
      .map((component) => ({
        name: component.name,
        libraryName: component.libraryName,
        key: component.key,
      }))
  );
}

function collectVariantsTemplateKeyCandidates(storedKey: string | null): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const value of [storedKey, VARIANTS_TEMPLATE_LIBRARY_KEY]) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    candidates.push(trimmed);
  }

  return candidates;
}

async function importVariantsTemplateByKey(key: string): Promise<ComponentNode | null> {
  const trimmedKey = key.trim();
  if (!trimmedKey) return null;

  try {
    const component = await figma.importComponentByKeyAsync(trimmedKey);
    console.info(
      `${LOG_PREFIX} Imported "${VARIANTS_TEMPLATE_NAME}" by saved component key.`
    );
    return component;
  } catch (componentError) {
    if (typeof figma.importComponentSetByKeyAsync !== 'function') {
      console.warn(
        `${LOG_PREFIX} Failed to import "${VARIANTS_TEMPLATE_NAME}" by saved component key.`,
        componentError
      );
      return null;
    }

    try {
      const componentSet = await figma.importComponentSetByKeyAsync(trimmedKey);
      const picked = pickVariantFromComponentSet(componentSet);
      if (picked) {
        console.info(
          `${LOG_PREFIX} Imported "${VARIANTS_TEMPLATE_NAME}" component set by saved key.`
        );
        return picked;
      }

      console.warn(
        `${LOG_PREFIX} Imported "${VARIANTS_TEMPLATE_NAME}" component set by key, but no variant component is available.`
      );
      return null;
    } catch (setError) {
      console.warn(
        `${LOG_PREFIX} Failed to import "${VARIANTS_TEMPLATE_NAME}" by saved component key (component and component set).`,
        { componentError, setError }
      );
      return null;
    }
  }
}

async function getAvailableLibraryComponentsCached(): Promise<AvailableLibraryComponentMeta[]> {
  if (!cachedLibraryComponentsPromise) {
    cachedLibraryComponentsPromise = loadAvailableLibraryComponents();
  }
  return cachedLibraryComponentsPromise;
}

async function loadAvailableLibraryComponents(): Promise<AvailableLibraryComponentMeta[]> {
  const teamLibrary = getTeamLibraryApi();
  if (!teamLibrary?.getAvailableLibraryComponentsAsync) {
    return [];
  }

  try {
    const components = await teamLibrary.getAvailableLibraryComponentsAsync();
    logAvailableLibraryDiagnostics(components);
    return components;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to read connected libraries.`, error);
    return [];
  }
}

function findVariantsTemplateLibraryComponent(
  components: AvailableLibraryComponentMeta[]
): AvailableLibraryComponentMeta | null {
  const exactNameMatches = components.filter((component) =>
    isExactVariantsTemplateName(component.name)
  );

  const looseNameMatches = components.filter((component) => isVariantsTemplateName(component.name));

  const candidates = exactNameMatches.length > 0 ? exactNameMatches : looseNameMatches;

  if (candidates.length === 0) {
    return null;
  }

  const dsAssetsCandidate =
    candidates.find((component) => isDsAssetsLibraryName(component.libraryName)) ?? null;

  if (dsAssetsCandidate) {
    return dsAssetsCandidate;
  }

  console.warn(
    `${LOG_PREFIX} Template "${VARIANTS_TEMPLATE_NAME}" was found, but not in a library named "${DS_ASSETS_LIBRARY_NAME}". Using first matching candidate from library "${candidates[0].libraryName}".`
  );

  return candidates[0];
}

async function importVariantsTemplateFromAvailableLibraries(): Promise<ComponentNode | null> {
  if (!getTeamLibraryApi()) {
    console.info(
      `${LOG_PREFIX} Figma Team Library discovery API is not available in this plugin environment. Skipping discovery.`
    );
    return null;
  }

  const components = await getAvailableLibraryComponentsCached();

  if (!components.length) {
    console.info(
      `${LOG_PREFIX} No published library components are available from connected libraries.`
    );
    return null;
  }

  const match = findVariantsTemplateLibraryComponent(components);
  if (!match) {
    console.warn(
      `${LOG_PREFIX} No library component named "${VARIANTS_TEMPLATE_NAME}" was found in available libraries.`
    );
    console.warn(VARIANTS_TEMPLATE_NOT_PUBLISHED_MESSAGE);
    return null;
  }

  logLibraryLookupDebug('Selected library template match', {
    name: match.name,
    key: match.key,
    libraryName: match.libraryName,
  });

  const importedByKey = await importVariantsTemplateByKey(match.key);
  if (importedByKey) {
    logLibraryLookupDebug('Imported template from library discovery', {
      id: importedByKey.id,
      name: importedByKey.name,
      key: match.key,
      libraryName: match.libraryName,
    });
    return importedByKey;
  }

  return null;
}

async function resolveVariantsTemplateComponentInternal(): Promise<ComponentNode | null> {
  const localTemplateNode = await findLocalVariantsTemplateNode();
  if (localTemplateNode) {
    const localTemplate = resolveLocalVariantsTemplateForUse(localTemplateNode);
    if (localTemplate) {
      console.info(`${LOG_PREFIX} Using local template "${VARIANTS_TEMPLATE_NAME}".`);
      return localTemplate;
    }
  }

  console.info(
    `${LOG_PREFIX} Local template "${VARIANTS_TEMPLATE_NAME}" was not found. Trying saved component key.`
  );

  const storedKey = await getStoredVariantsTemplateKey();
  const keyCandidates = collectVariantsTemplateKeyCandidates(storedKey);
  let keyImportAttempted = false;
  let keyImportFailed = false;

  for (const key of keyCandidates) {
    keyImportAttempted = true;
    const importedByKey = await importVariantsTemplateByKey(key);
    if (importedByKey) {
      return importedByKey;
    }
    keyImportFailed = true;
  }

  if (keyImportFailed) {
    console.warn(VARIANTS_TEMPLATE_KEY_IMPORT_FAILED_MESSAGE);
  }

  if (!keyImportAttempted) {
    console.info(
      `${LOG_PREFIX} No saved component key for "${VARIANTS_TEMPLATE_NAME}". Trying available library components.`
    );
  } else {
    console.info(
      `${LOG_PREFIX} Saved key import did not succeed. Trying available library components.`
    );
  }

  const importedFromDiscovery = await importVariantsTemplateFromAvailableLibraries();
  if (importedFromDiscovery) {
    return importedFromDiscovery;
  }

  console.warn(
    `${LOG_PREFIX} Template "${VARIANTS_TEMPLATE_NAME}" was not found locally, by saved key, or among available published library components.`
  );
  console.warn(VARIANTS_TEMPLATE_UNAVAILABLE_MESSAGE);
  return null;
}

/** Session-scoped cache for `DS-Template-variants` (single resolve per generation). */
export async function resolveVariantsTemplateCached(): Promise<ComponentNode | null> {
  if (cachedVariantsTemplate !== undefined) {
    return cachedVariantsTemplate;
  }

  if (isResolvingVariantsTemplate && cachedVariantsTemplatePromise) {
    return cachedVariantsTemplatePromise;
  }

  if (!cachedVariantsTemplatePromise) {
    isResolvingVariantsTemplate = true;
    cachedVariantsTemplatePromise = resolveVariantsTemplateComponentInternal().finally(() => {
      isResolvingVariantsTemplate = false;
    });
  }

  cachedVariantsTemplate = await cachedVariantsTemplatePromise;
  return cachedVariantsTemplate;
}
