/// <reference types="@figma/plugin-typings" />
import { createPluginFrame, createPluginRectangle, createPluginText } from '../figma/pluginSceneNodes';

import { loadFontOnce } from '../figma/text';
import {
  applyGapGuideLineFill,
  applyGapMeasureFill,
  applyGapValueSquareFill,
  applyPaddingMeasureFill,
  applyPaddingValueSquareFill,
  applyValueSquareLabelInverse,
} from './overlayStyles';

export type SpacingOverlayKind = 'padding' | 'gap';

export type SpacingOverlaySide = 'top' | 'right' | 'bottom' | 'left';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type SpacingOverlayColors = {
  measureFill: Paint[];
  valueFill: Paint[];
  borderFill: Paint[];
  textFill: Paint[];
};

export type SpacingOverlaySideParams = {
  kind: SpacingOverlayKind;
  side: SpacingOverlaySide;

  name: string;
  value: number;
  valueLabel: string;

  overlayRect: Rect;
  measureRect: Rect;
  valueSquarePosition: Point;

  colors: SpacingOverlayColors;
};

export type SpacingOverlaySideResult = {
  node: FrameNode;
  valueSquare: FrameNode;
  valueAnchor: Point;
};

const FONT_REGULAR: FontName = { family: 'PT Sans', style: 'Regular' };
const VALUE_SQUARE_HEIGHT = 20;

function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function createCanvas(params: {
  kind: SpacingOverlayKind;
  name: string;
  width: number;
  height: number;
}): FrameNode {
  const canvas = createPluginFrame();
  canvas.name =
    params.kind === 'padding'
      ? `${params.name} canvas`
      : params.name.replace(/^Gap overlay \//, 'Gap overlay canvas /');
  canvas.layoutMode = 'NONE';
  canvas.fills = [];
  canvas.strokes = [];
  canvas.clipsContent = false;
  canvas.resize(Math.max(1, params.width), Math.max(1, params.height));
  return canvas;
}

async function createMeasureFill(params: {
  kind: SpacingOverlayKind;
  localRect: Rect;
  colors: SpacingOverlayColors;
}): Promise<FrameNode> {
  const fill = createPluginFrame();
  fill.name = params.kind === 'padding' ? 'Padding measure fill' : 'Gap measure fill';
  fill.layoutMode = 'NONE';
  fill.x = Math.round(params.localRect.x);
  fill.y = Math.round(params.localRect.y);
  fill.resize(
    Math.max(1, Math.round(params.localRect.width)),
    Math.max(1, Math.round(params.localRect.height))
  );
  fill.fills = params.colors.measureFill;
  fill.strokes = [];
  fill.clipsContent = false;

  if (params.kind === 'padding') {
    await applyPaddingMeasureFill(fill);
  } else {
    await applyGapMeasureFill(fill);
  }

  return fill;
}

async function createBorder(params: {
  kind: SpacingOverlayKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colors: SpacingOverlayColors;
}): Promise<RectangleNode> {
  const border = createPluginRectangle();
  border.name = params.name;
  border.x = Math.round(params.x);
  border.y = Math.round(params.y);
  border.resize(Math.max(1, Math.round(params.width)), Math.max(1, Math.round(params.height)));
  border.fills = params.colors.borderFill;
  border.strokes = [];

  try {
    border.layoutPositioning = 'ABSOLUTE';
  } catch {
    /* ignore */
  }

  if (params.kind === 'gap') {
    await applyGapGuideLineFill(border);
  }

  return border;
}

async function createSpacingValueSquare(params: {
  kind: SpacingOverlayKind;
  valueLabel: string;
  colors: SpacingOverlayColors;
}): Promise<FrameNode> {
  const square = createPluginFrame();
  square.name = params.kind === 'padding' ? 'Padding value square' : 'Gap value square';
  square.layoutMode = 'HORIZONTAL';
  square.primaryAxisAlignItems = 'CENTER';
  square.counterAxisAlignItems = 'CENTER';
  square.primaryAxisSizingMode = 'AUTO';
  square.counterAxisSizingMode = 'FIXED';
  square.paddingLeft = 4;
  square.paddingRight = 4;
  square.paddingTop = 0;
  square.paddingBottom = 0;
  square.itemSpacing = 0;
  square.cornerRadius = 4;
  square.clipsContent = false;
  square.fills = params.colors.valueFill;
  square.strokes = [];

  if (params.kind === 'padding') {
    await applyPaddingValueSquareFill(square);
  } else {
    await applyGapValueSquareFill(square);
  }

  await loadFontOnce(FONT_REGULAR);
  const text = createPluginText();
  text.name = params.kind === 'padding' ? 'Padding value text' : 'Gap value text';
  text.fontName = FONT_REGULAR;
  text.fontSize = 12;
  text.lineHeight = { unit: 'PERCENT', value: 130 };
  text.fills = params.colors.textFill;
  text.characters = params.valueLabel || '—';
  text.textAlignHorizontal = 'CENTER';
  text.textAlignVertical = 'CENTER';

  square.appendChild(text);
  await applyValueSquareLabelInverse(text);

  try {
    square.layoutPositioning = 'ABSOLUTE';
  } catch {
    /* ignore */
  }

  square.resize(Math.max(20, Math.round(square.width)), VALUE_SQUARE_HEIGHT);
  square.counterAxisSizingMode = 'FIXED';
  return square;
}

function appendBorders(params: {
  canvas: FrameNode;
  kind: SpacingOverlayKind;
  side: SpacingOverlaySide;
  width: number;
  height: number;
  colors: SpacingOverlayColors;
}): Promise<void> {
  const prefix = params.kind === 'padding' ? 'Padding' : 'Gap';
  const vertical = params.side === 'left' || params.side === 'right';

  return (async () => {
    if (vertical) {
      params.canvas.appendChild(
        await createBorder({
          kind: params.kind,
          name: `${prefix} border / 1`,
          x: 0,
          y: 0,
          width: 1,
          height: params.height,
          colors: params.colors,
        })
      );
      params.canvas.appendChild(
        await createBorder({
          kind: params.kind,
          name: `${prefix} border / 2`,
          x: params.width - 1,
          y: 0,
          width: 1,
          height: params.height,
          colors: params.colors,
        })
      );
      return;
    }

    params.canvas.appendChild(
      await createBorder({
        kind: params.kind,
        name: `${prefix} border / 1`,
        x: 0,
        y: 0,
        width: params.width,
        height: 1,
        colors: params.colors,
      })
    );
    params.canvas.appendChild(
      await createBorder({
        kind: params.kind,
        name: `${prefix} border / 2`,
        x: 0,
        y: params.height - 1,
        width: params.width,
        height: 1,
        colors: params.colors,
      })
    );
  })();
}

export async function createSpacingOverlaySide(
  params: SpacingOverlaySideParams
): Promise<SpacingOverlaySideResult> {
  const overlayRect = roundRect(params.overlayRect);
  const measureRect = roundRect(params.measureRect);
  const width = Math.max(1, overlayRect.width);
  const height = Math.max(1, overlayRect.height);
  const isHorizontalSide = params.side === 'top' || params.side === 'bottom';

  const overlay = createPluginFrame();
  overlay.name = params.name;
  overlay.layoutMode = isHorizontalSide ? 'HORIZONTAL' : 'VERTICAL';
  overlay.primaryAxisSizingMode = 'FIXED';
  overlay.counterAxisSizingMode = 'FIXED';
  overlay.primaryAxisAlignItems = 'MIN';
  overlay.counterAxisAlignItems = 'CENTER';
  overlay.itemSpacing = 0;
  overlay.paddingTop = 0;
  overlay.paddingRight = 0;
  overlay.paddingBottom = 0;
  overlay.paddingLeft = 0;
  overlay.fills = [];
  overlay.strokes = [];
  overlay.clipsContent = false;
  overlay.x = overlayRect.x;
  overlay.y = overlayRect.y;
  overlay.resize(width, height);

  const canvas = createCanvas({
    kind: params.kind,
    name: params.name,
    width,
    height,
  });

  const measureLocalRect = {
    x: measureRect.x - overlayRect.x,
    y: measureRect.y - overlayRect.y,
    width: measureRect.width,
    height: measureRect.height,
  };

  const measureFill = await createMeasureFill({
    kind: params.kind,
    localRect: measureLocalRect,
    colors: params.colors,
  });
  canvas.appendChild(measureFill);

  await appendBorders({
    canvas,
    kind: params.kind,
    side: params.side,
    width,
    height,
    colors: params.colors,
  });

  const valueSquare = await createSpacingValueSquare({
    kind: params.kind,
    valueLabel: params.valueLabel,
    colors: params.colors,
  });

  if (params.kind === 'gap') {
    if (params.side === 'left' || params.side === 'right') {
      valueSquare.x = Math.round(width / 2 - valueSquare.width / 2);
      valueSquare.y = Math.round(-valueSquare.height - 4);
    } else {
      valueSquare.x = Math.round(-valueSquare.width - 4);
      valueSquare.y = Math.round(height / 2 - valueSquare.height / 2);
    }
  } else {
    valueSquare.x = Math.round(params.valueSquarePosition.x - overlayRect.x);
    valueSquare.y = Math.round(params.valueSquarePosition.y - overlayRect.y);
  }
  canvas.appendChild(valueSquare);

  overlay.appendChild(canvas);

  return {
    node: overlay,
    valueSquare,
    valueAnchor: {
      x: Math.round(overlayRect.x + valueSquare.x),
      y: Math.round(overlayRect.y + valueSquare.y),
    },
  };
}
