/// <reference types="@figma/plugin-typings" />

import type {
  ResolvedColorToken,
  ResolvedNumberToken,
  TextStyleFallback,
} from './tokenTypes';

export function normalizeTokenName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ');
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

type LibraryVarDescriptor = {
  key: string;
  name: string;
  resolvedType: VariableResolvedDataType;
};

type DebugResolutions = {
  colors: Record<string, ResolvedColorToken['source']>;
  spacing: Record<string, ResolvedNumberToken['source']>;
  radius: Record<string, ResolvedNumberToken['source']>;
  textStyles: Record<string, string>;
};

export type StyleResolver = {
  init(): Promise<void>;
  resolveColor(names: string[], fallback: RGB): Promise<ResolvedColorToken>;
  resolveNumber(names: string[], fallback: number): Promise<ResolvedNumberToken>;
  resolveTextStyle(names: string[]): Promise<TextStyle | null>;
  applyFill(
    node: GeometryMixin,
    names: string[],
    fallback: RGB,
    opacity?: number
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
  getDebugSummary(): DebugResolutions;
};

type CreateOptions = {
  useLibraryTokens: boolean;
};

export function createStyleResolver(options: CreateOptions): StyleResolver {
  const useLibrary = options.useLibraryTokens !== false;

  const localColorVars = new Map<string, Variable>();
  const localFloatVars = new Map<string, Variable>();
  const libraryByNormName = new Map<string, LibraryVarDescriptor[]>();
  const importedByKey = new Map<string, Variable>();

  const debug: DebugResolutions = {
    colors: {},
    spacing: {},
    radius: {},
    textStyles: {},
  };

  function warnFallback(kind: string, names: string[]): void {
    console.warn('[StyleResolver] Token not found, fallback used', kind, names.join(' | '));
  }

  function indexLocalVariables(): void {
    try {
      const vars = figma.variables.getLocalVariables();
      for (const v of vars) {
        const k = normalizeTokenName(v.name);
        if (v.resolvedType === 'COLOR') localColorVars.set(k, v);
        if (v.resolvedType === 'FLOAT') localFloatVars.set(k, v);
      }
    } catch (e) {
      console.warn('[StyleResolver] getLocalVariables failed', e);
    }
  }

  async function loadLibraryVariables(): Promise<void> {
    if (!useLibrary) return;
    try {
      const team = (
        figma as PluginAPI & {
          teamLibrary?: {
            getAvailableLibraryVariableCollectionsAsync?: () => Promise<
              { key: string; name: string }[]
            >;
            getVariablesInLibraryCollectionAsync?: (
              collectionKey: string
            ) => Promise<LibraryVarDescriptor[]>;
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
            const list = libraryByNormName.get(nn) ?? [];
            list.push(v);
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
    for (const n of names) {
      const k = normalizeTokenName(n);
      const hit = localColorVars.get(k);
      if (hit) return hit;
      for (const [nk, v] of localColorVars) {
        if (nk.endsWith('/' + k) || k.endsWith('/' + nk)) return v;
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

  async function importLibraryVar(
    names: string[],
    type: VariableResolvedDataType
  ): Promise<Variable | null> {
    for (const n of names) {
      const k = normalizeTokenName(n);
      const list = libraryByNormName.get(k) ?? [];
      for (const d of list) {
        if (d.resolvedType !== type) continue;
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

  async function resolveColor(names: string[], fallback: RGB): Promise<ResolvedColorToken> {
    const vLocal = findLocalColorVar(names);
    if (vLocal) {
      return {
        name: vLocal.name,
        value: fallback,
        source: 'local-variable',
        id: vLocal.id,
        key: vLocal.key,
        variable: vLocal,
      };
    }

    const vLib = await importLibraryVar(names, 'COLOR');
    if (vLib) {
      return {
        name: vLib.name,
        value: fallback,
        source: 'library-variable',
        id: vLib.id,
        key: vLib.key,
        variable: vLib,
      };
    }

    const style = findByAliases(figma.getLocalPaintStyles(), names);
    if (style && style.paints.length) {
      const p = style.paints[0];
      if (p.type === 'SOLID') {
        return {
          name: style.name,
          value: p.color,
          source: 'local-style',
          id: style.id,
        };
      }
    }

    warnFallback('color', names);
    return { name: names[0] ?? 'color', value: fallback, source: 'fallback' };
  }

  async function resolveNumber(names: string[], fallback: number): Promise<ResolvedNumberToken> {
    const vLocal = findLocalFloatVar(names);
    if (vLocal) {
      return {
        name: vLocal.name,
        value: fallback,
        source: 'local-variable',
        id: vLocal.id,
        key: vLocal.key,
        variable: vLocal,
      };
    }

    const vLib = await importLibraryVar(names, 'FLOAT');
    if (vLib) {
      return {
        name: vLib.name,
        value: fallback,
        source: 'library-variable',
        id: vLib.id,
        key: vLib.key,
        variable: vLib,
      };
    }

    warnFallback('number', names);
    return { name: names[0] ?? 'number', value: fallback, source: 'fallback' };
  }

  async function resolveTextStyle(names: string[]): Promise<TextStyle | null> {
    return findByAliases(figma.getLocalTextStyles(), names);
  }

  async function applyFill(
    node: GeometryMixin,
    names: string[],
    fallback: RGB,
    opacity?: number
  ): Promise<void> {
    const r = await resolveColor(names, fallback);
    debug.colors[names[0] ?? 'fill'] = r.source;
    const paint = solidPaint(r.value, opacity);
    const setBound = figma.variables?.setBoundVariableForPaint;
    if (r.variable && typeof setBound === 'function') {
      try {
        const bound = setBound.call(figma.variables, paint, 'color', r.variable);
        node.fills = [bound];
        return;
      } catch {
        /* fall through */
      }
    }
    node.fills = [paint];
  }

  async function applyStroke(
    node: MinimalStrokesMixin,
    names: string[],
    fallback: RGB,
    opacity?: number
  ): Promise<void> {
    const r = await resolveColor(names, fallback);
    const paint = solidPaint(r.value, opacity);
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
        await figma.loadFontAsync(style.fontName);
        node.textStyleId = style.id;
        debug.textStyles[names[0] ?? 'text'] = 'local-style';
        return;
      } catch {
        /* fall through */
      }
    }

    await figma.loadFontAsync(fallback.fontName);
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

  return {
    async init(): Promise<void> {
      indexLocalVariables();
      if (useLibrary) await loadLibraryVariables();
      if (typeof process !== 'undefined' && process.env?.FIGMA_SPEC_DEBUG === '1') {
        console.log('[StyleResolver] init', {
          useLibraryTokens: useLibrary,
          localColorVars: localColorVars.size,
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

    getDebugSummary(): DebugResolutions {
      return { ...debug, textStyles: { ...debug.textStyles } };
    },
  };
}
