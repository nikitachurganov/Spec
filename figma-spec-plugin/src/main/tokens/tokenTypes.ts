/// <reference types="@figma/plugin-typings" />

export type TokenRef = {
  name: string;
  fallback?: unknown;
};

export type TextStyleFallback = {
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  fills: Paint[];
};

export type TextStyleTokenRef = {
  name: string;
  fallback: TextStyleFallback;
};

export type ColorTokenRef = {
  name: string;
  fallback: RGB;
  opacity?: number;
};

export type NumberTokenRef = {
  name: string;
  fallback: number;
};

/** Источник для заливок: локальный paint style → local-paint-style. */
export type ResolvedColorSource =
  | 'local-paint-style'
  | 'local-variable'
  | 'library-variable'
  | 'fallback';

export type ResolvedColorToken = {
  name: string;
  value: RGB;
  source: ResolvedColorSource;
  id?: string;
  key?: string;
  variable?: Variable | null;
};

export type ResolvedNumberSource =
  | 'local-variable'
  | 'library-variable'
  | 'fallback';

export type ResolvedNumberToken = {
  name: string;
  value: number;
  source: ResolvedNumberSource;
  id?: string;
  key?: string;
  variable?: Variable | null;
};

export type ResolvedStringSource = 'local-variable' | 'library-variable' | 'fallback';

export type ResolvedStringToken = {
  name: string;
  value: string;
  source: ResolvedStringSource;
  id?: string;
  key?: string;
  variable?: Variable | null;
};
