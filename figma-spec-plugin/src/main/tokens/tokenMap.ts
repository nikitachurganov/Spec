/// <reference types="@figma/plugin-typings" />

import type { TextStyleFallback } from './tokenTypes';

export function hexToRgb(hex: string): RGB {
  const s = String(hex || '').replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** Fallback в SPEC_TOKEN_MAP: hex (`#RRGGBB`) или уже RGB. */
export function specColorFallbackRgb(fallback: RGB | `#${string}`): RGB {
  return typeof fallback === 'string' ? hexToRgb(fallback) : fallback;
}

const interRegular: FontName = { family: 'Inter', style: 'Regular' };
const interBold: FontName = { family: 'Inter', style: 'Bold' };

/**
 * Семантические цвета UI-kit: переменные / paint styles / effect styles по имени.
 * Fallback — прежние hex из legacy.
 */
export const COLOR_TOKEN_MAP = {
  textSecondary: {
    names: ['Text/Secondary'],
    fallback: '#4E4E4E',
  },

  textInverse: {
    names: ['Text/Primary-inverse'],
    fallback: '#FFFFFF',
  },

  /** Icon vectors in property rows (not the same as text inverse). */
  backgroundPrimaryInverse: {
    names: ['Background/Primary-inverse'],
    fallback: '#FFFFFF',
  },

  textPrimary: {
    names: ['Text/Primary'],
    fallback: '#1F1F1F',
  },

  textTertiary: {
    names: ['Text/Tertiary'],
    fallback: '#8C8C8C',
  },

  anatomyPointerFill: {
    names: ['Background/Brand-dark'],
    fallback: '#FC8507',
  },

  anatomyConnector: {
    names: ['Background/Brand-dark'],
    fallback: '#FC8507',
  },

  gapStroke: {
    names: ['Stroke/Border-error'],
    fallback: '#F34747',
  },

  gapValueFill: {
    names: ['Background/Error-main'],
    fallback: '#F34747',
  },

  gapMeasureFill: {
    names: ['Effects/Button red shadow/20'],
    fallback: '#F34747',
    fallbackOpacity: 0.2,
    tokenType: 'effect',
  },

  paddingStroke: {
    names: ['Stroke/Border-info'],
    fallback: '#449AFF',
  },

  paddingValueFill: {
    names: ['Background/Info-main'],
    fallback: '#449AFF',
  },

  paddingMeasureFill: {
    names: ['Effects/Button blue shadow/18'],
    fallback: '#449AFF',
    fallbackOpacity: 0.2,
    tokenType: 'effect',
  },

  childOverlayFill: {
    names: ['Background/Skeleton'],
    fallback: '#FFFFFF',
    fallbackOpacity: 0.2,
  },

  childOverlayStroke: {
    names: ['Background/Skeleton'],
    fallback: '#FFFFFF',
  },

  targetOutlineStroke: {
    names: ['Stroke/Border-status-completed', 'Stroke/Border-status-comleted'],
    fallback: '#003F8A',
  },
} as const;

export type ColorSemanticKey = keyof typeof COLOR_TOKEN_MAP;

/** Каркас спеки: только цвета и текстовые стили (отступы/радиус — числа в legacy). */
export const SPEC_TOKEN_MAP = {
  colors: {
    backgroundPrimary: {
      names: ['Background/Primary'],
      fallback: '#FFFFFF',
    },
    backgroundSecondary: {
      names: ['Background/Secondary'],
      preferredCollectionNames: [
        'Typography & Colors',
        'Colors',
        'Primitives',
      ] as const,
      fallback: '#F7F7F7',
    },
    sectionTitle: {
      names: ['Text/Primary', 'Foreground/Primary', 'text/primary'],
      fallback: hexToRgb('#1F1F1F'),
    },
    divider: {
      names: ['Stroke/Divider-light', 'stroke/divider-light', 'Stroke/Divider Light'],
      fallback: hexToRgb('#EAE8E8'),
    },
    containerCard: {
      names: ['Background/Primary', 'background/primary', 'Background/Default'],
      fallback: hexToRgb('#FFFFFF'),
    },
  },

  textStyles: {
    sectionTitle: {
      names: ['desktop/h5', 'Desktop/H5', 'Heading/H5'],
      fallback: {
        fontName: interRegular,
        fontSize: 32,
        lineHeight: { unit: 'PERCENT', value: 130 },
        fills: [{ type: 'SOLID', color: hexToRgb('#1F1F1F') }] as Paint[],
      } satisfies TextStyleFallback,
    },
    cardTitle: {
      names: ['desktop/h5', 'Desktop/H5'],
      fallback: {
        fontName: interBold,
        fontSize: 16,
        lineHeight: { unit: 'PERCENT', value: 130 },
        fills: [{ type: 'SOLID', color: hexToRgb('#1F1F1F') }] as Paint[],
      } satisfies TextStyleFallback,
    },
    body: {
      names: ['Body/Paragraph (14px)', 'Body/Paragraph', 'body/paragraph'],
      fallback: {
        fontName: interRegular,
        fontSize: 14,
        lineHeight: { unit: 'PERCENT', value: 130 },
        fills: [{ type: 'SOLID', color: hexToRgb('#1F1F1F') }] as Paint[],
      } satisfies TextStyleFallback,
    },
  },
} as const;

/**
 * String variables для font family (библиотека Typography & Colors + короткие алиасы).
 * `fallbackFontFamily` — запасное имя семейства, если переменная недоступна (с кодом обычно совмещают через `FontName.family`).
 */
export const TYPOGRAPHY_VARIABLE_TOKEN_MAP = {
  headingFontFamily: {
    names: [
      'Typography & Colors/Font family/Heading',
      'Font family/Heading',
    ],
    fallbackFontFamily: 'PT Sans',
  },

  paragraphFontFamily: {
    names: [
      'Typography & Colors/Font family/Paragraph',
      'Font family/Paragraph',
    ],
    fallbackFontFamily: 'PT Sans',
  },
} as const;

export type TypographyFontFamilyTokenKey = keyof typeof TYPOGRAPHY_VARIABLE_TOKEN_MAP;
