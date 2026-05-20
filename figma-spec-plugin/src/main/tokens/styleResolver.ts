/// <reference types="@figma/plugin-typings" />

import { debugLog } from '../debug';
import { loadFontOnce } from '../figma/text';
import {
  getLocalPaintStylesSafe,
  getLocalTextStylesSafe,
  preloadLocalStylesCache,
} from '../figma/localStyles';
import { getLocalVariablesSafe } from '../figma/variables';
import type {
  ResolvedColorToken,
  ResolvedNumberToken,
  TextStyleFallback,
} from './tokenTypes';
import {
  TYPOGRAPHY_VARIABLE_TOKEN_MAP,
  type TypographyFontFamilyTokenKey,
} from './tokenMap';

export type ResolveColorOptions = {
  preferredCollectionNames?: readonly string[];
};

export type ApplyFillExtras = ResolveColorOptions & {
  debugTokenKey?: string;
  debugNodeLabel?: string;
};

export function normalizeTokenName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ');
}

/** 1:1 совпадение нормализованного имени (без fuzzy). */
export function findExactByTokenName<T extends { name: string }>(
  items: readonly T[],
  names: readonly string[]
): T | null {
  const normalizedNames = names.map(normalizeTokenName).filter(Boolean);
  if (!normalizedNames.length) return null;
  const want = new Set(normalizedNames);
  for (const item of items) {
    const itemName = normalizeTokenName(item.name);
    if (itemName && want.has(itemName)) return item;
  }
  return null;
}

export function findByAliases<T extends { name: string }>(items: T[], names: string[]): T | null {
  for (const want of names) {
    const w = normalizeTokenName(want);
    if (!w) continue;
    for (const item of items) {
      const actual = normalizeTokenName(item.name);
      if (!actual) continue;
      if (actual === w || actual.endsWith('/' + w)) return item;
    }
  }
  return null;
}

export function isStringVariable(variable: {
  resolvedType: VariableResolvedDataType;
}): boolean {
  return variable.resolvedType === 'STRING';
}

export function trySetBoundVariable(
  node: SceneNode,
  field: VariableBindableNodeField,
  variable: Variable
): boolean {
  try {
    const n = node as SceneNode & {
      setBoundVariable?: (f: VariableBindableNodeField, v: Variable) => void;
    };
    if (typeof n.setBoundVariable === 'function') {
      n.setBoundVariable(field, variable);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

type LibraryVarDescriptor = LibraryVariable & {
  collectionKey: string;
  collectionName: string;
};

type DebugResolutions = {
  colors: Record<string, ResolvedColorToken['source']>;
  spacing: Record<string, ResolvedNumberToken['source']>;
  radius: Record<string, ResolvedNumberToken['source']>;
  textStyles: Record<string, string>;
};

function specDebugEnabled(): boolean {
  return (
    (typeof process !== 'undefined' && process.env?.FIGMA_SPEC_DEBUG === '1') || false
  );
}

function cacheKey(names: readonly string[], suffix = ''): string {
  return `${names.map(normalizeTokenName).join('|')}${suffix}`;
}

function debugResolvedColorToken(
  tokenKey: string | undefined,
  resolved: ResolvedColorToken,
  fallback: RGB,
  extra?: Record<string, unknown>
): void {
  if (!specDebugEnabled()) return;
  const row: Record<string, unknown> = {
    tokenKey,
    tokenName: resolved.name,
    source: resolved.source,
    id: resolved.id,
    key: resolved.key,
    fallback,
    ...extra,
  };
  if (resolved.variable) {
    row.variableCollectionId = resolved.variable.variableCollectionId;
    row.resolvedType = resolved.variable.resolvedType;
    console.log('[StyleResolver] Variable raw valuesByMode', {
      name: resolved.variable.name,
      collectionId: resolved.variable.variableCollectionId,
      valuesByMode: resolved.variable.valuesByMode,
    });
  }
  console.log('[StyleResolver] Resolved color token', row);
}

function rgbFromVariableValue(val: VariableValue): RGB | null {
  if (val !== null && typeof val === 'object' && 'r' in val) {
    const o = val as RGB;
    if (
      typeof o.r === 'number' &&
      typeof o.g === 'number' &&
      typeof o.b === 'number'
    ) {
      return { r: o.r, g: o.g, b: o.b };
    }
  }
  return null;
}

/** RGB для SOLID перед bind: переменная → resolveForConsumer или первый режим коллекции, иначе fallback. */
function solidRgbForResolvedColor(
  r: ResolvedColorToken,
  fallback: RGB,
  consumer: SceneNode | null
): RGB {
  if (r.source === 'local-paint-style') return r.value;
  if (r.source === 'fallback') return r.value;

  if (r.variable) {
    try {
      if (consumer) {
        const rs = r.variable.resolveForConsumer(consumer);
        if (rs.resolvedType === 'COLOR') {
          const rgb = rgbFromVariableValue(rs.value);
          if (rgb) return rgb;
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const vc = figma.variables.getVariableCollectionById(r.variable.variableCollectionId);
      const modeId = vc?.modes?.[0]?.modeId;
      if (modeId != null) {
        const raw = r.variable.valuesByMode[modeId];
        const rgb = raw !== undefined ? rgbFromVariableValue(raw) : null;
        if (rgb) return rgb;
      }
    } catch {
      /* ignore */
    }
  }

  return fallback;
}

export function resolvedColorToSolidRgb(
  r: ResolvedColorToken,
  fallback: RGB,
  consumer?: SceneNode | null
): RGB {
  return solidRgbForResolvedColor(r, fallback, consumer ?? null);
}

export type StyleResolver = {
  init(): Promise<void>;
  resolveColor(
    names: string[],
    fallback: RGB,
    options?: ResolveColorOptions
  ): Promise<ResolvedColorToken>;
  resolveNumber(names: string[], fallback: number): Promise<ResolvedNumberToken>;
  resolveTextStyle(names: string[]): Promise<TextStyle | null>;
  applyFill(
    node: GeometryMixin,
    names: string[],
    fallback: RGB,
    opacity?: number,
    extras?: ApplyFillExtras
  ): Promise<void>;
  applyStroke(
    node: MinimalStrokesMixin,
    names: string[],
    fallback: RGB,
    opacity?: number
  ): Promise<void>;
  applyTextStyle(node: TextNode, names: string[], fallback: TextStyleFallback): Promise<void>;
  applyCornerRadius(node: RectangleCornerMixin, names: string[], fallback: number): Promise<void>;
  applyPadding(frame: FrameNode, names: string[], fallback: number): Promise<void>;
  resolveStringVariable(names: string[]): Promise<Variable | null>;
  applyFontFamilyToken(
    node: TextNode,
    tokenKey: TypographyFontFamilyTokenKey,
    fallbackFontName: FontName
  ): Promise<void>;
  getDebugSummary(): DebugResolutions;
};

type CreateOptions = {
  useLibraryTokens: boolean;
};

export function createStyleResolver(options: CreateOptions): StyleResolver {
  const useLibrary = options.useLibraryTokens !== false;

  const localColorVars = new Map<string, Variable>();
  const localColorVarList: Variable[] = [];
  const localStringVars = new Map<string, Variable>();
  const localStringVarList: Variable[] = [];
  const localFloatVars = new Map<string, Variable>();
  const libraryByNormName = new Map<string, LibraryVarDescriptor[]>();
  const importedByKey = new Map<string, Variable>();
  const colorTokenCache = new Map<string, ResolvedColorToken>();
  const numberTokenCache = new Map<string, ResolvedNumberToken>();
  const fontFamilyTokenCache = new Map<
    TypographyFontFamilyTokenKey,
    ResolvedStringVarMeta | null
  >();
  let initialized = false;

  const debug: DebugResolutions = {
    colors: {},
    spacing: {},
    radius: {},
    textStyles: {},
  };

  function warnFallback(kind: string, names: string[]): void {
    console.warn('[StyleResolver] Token not found, fallback used', kind, names.join(' | '));
  }

  async function indexLocalVariables(): Promise<void> {
    localColorVarList.length = 0;
    localStringVarList.length = 0;
    localColorVars.clear();
    localStringVars.clear();
    localFloatVars.clear();

    const vars = await getLocalVariablesSafe();
    for (const v of vars) {
      const k = normalizeTokenName(v.name);
      if (v.resolvedType === 'COLOR') {
        localColorVarList.push(v);
        localColorVars.set(k, v);
      }
      if (v.resolvedType === 'STRING') {
        localStringVarList.push(v);
        localStringVars.set(k, v);
      }
      if (v.resolvedType === 'FLOAT') localFloatVars.set(k, v);
    }
  }

  async function loadLibraryVariables(): Promise<void> {
    if (!useLibrary) return;
    try {
      const team = (
        figma as PluginAPI & {
          teamLibrary?: {
            getAvailableLibraryVariableCollectionsAsync?: () => Promise<LibraryVariableCollection[]>;
            getVariablesInLibraryCollectionAsync?: (
              collectionKey: string
            ) => Promise<LibraryVariable[]>;
          };
        }
      ).teamLibrary;
      if (!team?.getAvailableLibraryVariableCollectionsAsync) return;

      const collections = await team.getAvailableLibraryVariableCollectionsAsync();
      for (const col of collections) {
        try {
          const vars = await team.getVariablesInLibraryCollectionAsync!(col.key);
          for (const v of vars) {
            const nn = normalizeTokenName(v.name);
            const desc: LibraryVarDescriptor = {
              ...v,
              collectionKey: col.key,
              collectionName: col.name,
            };
            const list = libraryByNormName.get(nn) ?? [];
            list.push(desc);
            libraryByNormName.set(nn, list);
          }
        } catch (e) {
          console.warn('[StyleResolver] library collection failed', col.name, e);
        }
      }
    } catch (e) {
      console.warn('[StyleResolver] teamLibrary unavailable', e);
    }
  }

  function findLocalColorVar(names: string[]): Variable | null {
    const exact = findExactByTokenName(localColorVarList, names);
    if (exact) return exact;

    for (const n of names) {
      const k = normalizeTokenName(n);
      if (!k) continue;
      for (const v of localColorVarList) {
        const actual = normalizeTokenName(v.name);
        if (!actual) continue;
        if (actual.endsWith('/' + k) || k.endsWith('/' + actual)) return v;
      }
    }
    return null;
  }

  function findLocalFloatVar(names: string[]): Variable | null {
    for (const n of names) {
      const k = normalizeTokenName(n);
      const hit = localFloatVars.get(k);
      if (hit) return hit;
      for (const [nk, v] of localFloatVars) {
        if (nk.endsWith('/' + k) || k.endsWith('/' + nk)) return v;
      }
    }
    return null;
  }

  type ResolvedStringVarMeta = {
    variable: Variable;
    tokenName: string;
    source: 'local-variable' | 'library-variable';
  };

  /** Strict exact match (normalized name): local STRING vars, then library (imported by key). */
  async function findResolvedStringVariable(names: string[]): Promise<ResolvedStringVarMeta | null> {
    for (const name of names) {
      const k = normalizeTokenName(name);
      if (!k) continue;
      for (const v of localStringVarList) {
        if (!isStringVariable(v)) continue;
        if (normalizeTokenName(v.name) === k) {
          return { variable: v, tokenName: v.name, source: 'local-variable' };
        }
      }
    }

    for (const name of names) {
      const k = normalizeTokenName(name);
      if (!k) continue;
      const rawList = libraryByNormName.get(k) ?? [];
      const stringDescs = rawList.filter((d) => isStringVariable(d));
      const list = sortLibraryDescriptors(stringDescs, ['Typography & Colors']);

      for (const d of list) {
        let v: Variable;
        if (importedByKey.has(d.key)) {
          v = importedByKey.get(d.key)!;
        } else {
          try {
            v = await figma.variables.importVariableByKeyAsync(d.key);
            importedByKey.set(d.key, v);
          } catch {
            continue;
          }
        }
        if (!isStringVariable(v)) continue;
        return { variable: v, tokenName: v.name, source: 'library-variable' };
      }
    }

    return null;
  }

  async function resolveStringVariable(names: string[]): Promise<Variable | null> {
    const meta = await findResolvedStringVariable(names);
    return meta?.variable ?? null;
  }

  function sortLibraryDescriptors(
    descriptors: LibraryVarDescriptor[],
    preferredCollectionNames?: readonly string[]
  ): LibraryVarDescriptor[] {
    const pref = preferredCollectionNames;
    if (!pref?.length) return descriptors.slice();

    const rank = (d: LibraryVarDescriptor): number => {
      const cn = normalizeTokenName(d.collectionName);
      for (let i = 0; i < pref.length; i++) {
        if (normalizeTokenName(pref[i]!) === cn) return i;
      }
      return pref.length + 50;
    };

    return descriptors.slice().sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return normalizeTokenName(a.collectionName).localeCompare(
        normalizeTokenName(b.collectionName)
      );
    });
  }

  async function importLibraryVar(
    names: string[],
    type: VariableResolvedDataType,
    preferredCollectionNames?: readonly string[]
  ): Promise<Variable | null> {
    for (const n of names) {
      const k = normalizeTokenName(n);
      const rawList = libraryByNormName.get(k) ?? [];

      const sameType = rawList.filter((d) => d.resolvedType === type);
      if (sameType.length > 1 && specDebugEnabled()) {
        console.log('[StyleResolver] Multiple library variables for exact name', {
          nameKey: k,
          count: sameType.length,
          collections: sameType.map((d) => ({ collectionName: d.collectionName, key: d.key })),
        });
      }

      const list = sortLibraryDescriptors(sameType, preferredCollectionNames);

      for (const d of list) {
        if (importedByKey.has(d.key)) {
          const v = importedByKey.get(d.key)!;
          if (v.resolvedType === type) return v;
        }
        try {
          const v = await figma.variables.importVariableByKeyAsync(d.key);
          importedByKey.set(d.key, v);
          if (v.resolvedType === type) return v;
        } catch {
          /* continue */
        }
      }
    }
    return null;
  }

  function solidPaint(color: RGB, opacity?: number): SolidPaint {
    if (opacity != null && opacity !== 1) {
      return { type: 'SOLID', color, opacity };
    }
    return { type: 'SOLID', color };
  }

  async function resolveColor(
    names: string[],
    fallback: RGB,
    colorOptions?: ResolveColorOptions
  ): Promise<ResolvedColorToken> {
    const pref = colorOptions?.preferredCollectionNames;
    const key =
      cacheKey(names) +
      (pref?.length ? `|${pref.map(normalizeTokenName).join(',')}` : '');
    const cached = colorTokenCache.get(key);
    if (cached) return cached;

    const vLocal = findLocalColorVar(names);
    if (vLocal) {
      const resolved: ResolvedColorToken = {
        name: vLocal.name,
        value: fallback,
        source: 'local-variable',
        id: vLocal.id,
        key: vLocal.key,
        variable: vLocal,
      };
      colorTokenCache.set(key, resolved);
      return resolved;
    }

    const vLib = await importLibraryVar(names, 'COLOR', pref);
    if (vLib) {
      const resolved: ResolvedColorToken = {
        name: vLib.name,
        value: fallback,
        source: 'library-variable',
        id: vLib.id,
        key: vLib.key,
        variable: vLib,
      };
      colorTokenCache.set(key, resolved);
      return resolved;
    }

    const styles = await getLocalPaintStylesSafe();
    const exactStyle = findExactByTokenName(styles, names);
    let style =
      exactStyle &&
      exactStyle.paints.length &&
      exactStyle.paints[0]?.type === 'SOLID'
        ? exactStyle
        : null;
    if (!style) style = findByAliases(styles, names);

    if (style && style.paints.length) {
      const p = style.paints[0];
      if (p.type === 'SOLID') {
        const resolved: ResolvedColorToken = {
          name: style.name,
          value: p.color,
          source: 'local-paint-style',
          id: style.id,
        };
        colorTokenCache.set(key, resolved);
        return resolved;
      }
    }

    warnFallback('color', names);
    const resolved: ResolvedColorToken = {
      name: names[0] ?? 'color',
      value: fallback,
      source: 'fallback',
    };
    colorTokenCache.set(key, resolved);
    return resolved;
  }

  async function resolveNumber(names: string[], fallback: number): Promise<ResolvedNumberToken> {
    const key = cacheKey(names);
    const cached = numberTokenCache.get(key);
    if (cached) return cached;

    const vLocal = findLocalFloatVar(names);
    if (vLocal) {
      const resolved: ResolvedNumberToken = {
        name: vLocal.name,
        value: fallback,
        source: 'local-variable',
        id: vLocal.id,
        key: vLocal.key,
        variable: vLocal,
      };
      numberTokenCache.set(key, resolved);
      return resolved;
    }

    const vLib = await importLibraryVar(names, 'FLOAT');
    if (vLib) {
      const resolved: ResolvedNumberToken = {
        name: vLib.name,
        value: fallback,
        source: 'library-variable',
        id: vLib.id,
        key: vLib.key,
        variable: vLib,
      };
      numberTokenCache.set(key, resolved);
      return resolved;
    }

    warnFallback('number', names);
    const resolved: ResolvedNumberToken = {
      name: names[0] ?? 'number',
      value: fallback,
      source: 'fallback',
    };
    numberTokenCache.set(key, resolved);
    return resolved;
  }

  async function resolveTextStyle(names: string[]): Promise<TextStyle | null> {
    const styles = await getLocalTextStylesSafe();
    const exact = findExactByTokenName(styles, names);
    if (exact) return exact;
    return findByAliases(styles, names);
  }

  async function applyFill(
    node: GeometryMixin,
    names: string[],
    fallback: RGB,
    opacity?: number,
    extras?: ApplyFillExtras
  ): Promise<void> {
    const r = await resolveColor(names, fallback, {
      preferredCollectionNames: extras?.preferredCollectionNames,
    });
    const dbgKey = extras?.debugTokenKey ?? names[0] ?? 'fill';
    debug.colors[dbgKey] = r.source;

    const consumer = (node as unknown as SceneNode).type ? (node as SceneNode) : null;
    const rgb = solidRgbForResolvedColor(r, fallback, consumer);

    const paint = solidPaint(rgb, opacity);
    const setBound = figma.variables?.setBoundVariableForPaint;

    debugResolvedColorToken(extras?.debugTokenKey, r, fallback, {
      debugNodeLabel: extras?.debugNodeLabel,
    });

    if (r.variable && typeof setBound === 'function') {
      try {
        const bound = setBound.call(figma.variables, paint, 'color', r.variable);
        node.fills = [bound];
        if (extras?.debugNodeLabel && specDebugEnabled()) {
          console.log(`[${extras.debugNodeLabel}] fills after token`, node.fills);
        }
        return;
      } catch {
        /* fall through */
      }
    }
    node.fills = [paint];
    if (extras?.debugNodeLabel && specDebugEnabled()) {
      console.log(`[${extras.debugNodeLabel}] fills after token`, node.fills);
    }

    try {
      const f = node.fills?.[0];
      if (f?.type === 'SOLID') {
        const opacityOk = f.opacity === undefined || f.opacity === 1;
        if (!opacityOk) {
          console.warn(`[StyleResolver${extras?.debugNodeLabel ? `: ${extras.debugNodeLabel}` : ''}] Unexpected fill opacity`, f.opacity);
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function applyStroke(
    node: MinimalStrokesMixin,
    names: string[],
    fallback: RGB,
    opacity?: number
  ): Promise<void> {
    const r = await resolveColor(names, fallback);
    const consumer = (node as unknown as SceneNode).type ? (node as SceneNode) : null;
    const rgb = solidRgbForResolvedColor(r, fallback, consumer);
    const paint = solidPaint(rgb, opacity);
    const setBound = figma.variables?.setBoundVariableForPaint;
    if (r.variable && typeof setBound === 'function') {
      try {
        const bound = setBound.call(figma.variables, paint, 'color', r.variable);
        node.strokes = [bound];
        return;
      } catch {
        /* fall through */
      }
    }
    node.strokes = [paint];
  }

  async function applyTextStyle(
    node: TextNode,
    names: string[],
    fallback: TextStyleFallback
  ): Promise<void> {
    const style = await resolveTextStyle(names);
    if (style) {
      try {
        await loadFontOnce(style.fontName);
        node.textStyleId = style.id;
        debug.textStyles[names[0] ?? 'text'] = 'local-style';
        return;
      } catch {
        /* fall through */
      }
    }

    await loadFontOnce(fallback.fontName);
    node.fontName = fallback.fontName;
    node.fontSize = fallback.fontSize;
    node.lineHeight = fallback.lineHeight;
    node.fills = fallback.fills;
    debug.textStyles[names[0] ?? 'text'] = 'fallback';
  }

  async function applyCornerRadius(
    node: RectangleCornerMixin,
    names: string[],
    fallback: number
  ): Promise<void> {
    const r = await resolveNumber(names, fallback);
    debug.radius[names[0] ?? 'radius'] = r.source;
    if (r.variable) {
      if (trySetBoundVariable(node as SceneNode, 'topLeftRadius', r.variable)) {
        trySetBoundVariable(node as SceneNode, 'topRightRadius', r.variable);
        trySetBoundVariable(node as SceneNode, 'bottomLeftRadius', r.variable);
        trySetBoundVariable(node as SceneNode, 'bottomRightRadius', r.variable);
        return;
      }
    }
    (node as FrameNode).cornerRadius = r.value;
  }

  async function applyPadding(frame: FrameNode, names: string[], fallback: number): Promise<void> {
    const r = await resolveNumber(names, fallback);
    debug.spacing[names[0] ?? 'padding'] = r.source;
    const v = r.variable;
    const sides: VariableBindableNodeField[] = [
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
    ];
    if (v) {
      let ok = true;
      for (const f of sides) {
        if (!trySetBoundVariable(frame, f, v)) ok = false;
      }
      if (ok) return;
    }
    frame.paddingTop = r.value;
    frame.paddingRight = r.value;
    frame.paddingBottom = r.value;
    frame.paddingLeft = r.value;
  }

  async function applyFontFamilyToken(
    node: TextNode,
    tokenKey: TypographyFontFamilyTokenKey,
    fallbackFontName: FontName
  ): Promise<void> {
    const token = TYPOGRAPHY_VARIABLE_TOKEN_MAP[tokenKey];
    let resolved = fontFamilyTokenCache.get(tokenKey);
    if (resolved === undefined) {
      resolved = await findResolvedStringVariable([...token.names]);
      fontFamilyTokenCache.set(tokenKey, resolved);
    }

    await loadFontOnce(fallbackFontName);
    node.fontName = fallbackFontName;

    if (!resolved) {
      console.warn('[StyleResolver] Font family token not found', tokenKey, token.names);
      return;
    }

    debugLog('[StyleResolver] Font family token resolved', {
      tokenKey,
      tokenName: resolved.tokenName,
      source: resolved.source,
      id: resolved.variable.id,
      key: resolved.variable.key,
    });

    try {
      node.setBoundVariable('fontFamily', resolved.variable);
    } catch (error) {
      console.warn('[StyleResolver] Cannot bind fontFamily variable', tokenKey, error);
    }
  }

  return {
    async init(): Promise<void> {
      if (initialized) return;
      await Promise.all([indexLocalVariables(), preloadLocalStylesCache()]);
      if (useLibrary) await loadLibraryVariables();
      initialized = true;
      if (specDebugEnabled()) {
        debugLog('[StyleResolver] init', {
          useLibraryTokens: useLibrary,
          localColorVars: localColorVars.size,
          localColorVarList: localColorVarList.length,
          localStringVarList: localStringVarList.length,
          localFloatVars: localFloatVars.size,
          libraryNameSlots: libraryByNormName.size,
        });
      }
    },

    resolveColor,
    resolveNumber,
    resolveTextStyle,

    applyFill,
    applyStroke,
    applyTextStyle,
    applyCornerRadius,
    applyPadding,
    resolveStringVariable,
    applyFontFamilyToken,

    getDebugSummary(): DebugResolutions {
      return { ...debug, textStyles: { ...debug.textStyles } };
    },
  };
}