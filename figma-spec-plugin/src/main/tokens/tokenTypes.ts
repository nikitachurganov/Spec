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

export type ResolvedToken<T> = {
  name: string;
  value: T;
  source: 'local-style' | 'local-variable' | 'library-variable' | 'fallback';
  id?: string;
  key?: string;
};

export type ResolvedColorToken = ResolvedToken<RGB> & {
  variable?: Variable | null;
};

export type ResolvedNumberToken = ResolvedToken<number> & {
  variable?: Variable | null;
};
