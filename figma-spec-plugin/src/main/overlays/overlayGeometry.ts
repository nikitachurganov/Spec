/// <reference types="@figma/plugin-typings" />

/** Axis-aligned rectangle in preview-container coordinates. */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ValueSquareAnchor = {
  x: number;
  y: number;
};

export type PaddingValueAnchors = {
  top?: ValueSquareAnchor;
  right?: ValueSquareAnchor;
  bottom?: ValueSquareAnchor;
  left?: ValueSquareAnchor;
};

export type ValueSquareSize = {
  width: number;
  height: number;
};

/** Strip shape: vertical = between horizontal children; horizontal = between vertical children. */
export type GapOrientation = 'horizontal' | 'vertical';

export type ScaledPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type OverlayGeometryContext = {
  rootClone: SceneNode;
  targetClone: SceneNode;
  targetBounds: Rect;
  previewScale: number;
  padding: ScaledPadding;
  paddingValueAnchors: PaddingValueAnchors;
  containerLayoutDirection: 'vertical' | 'horizontal';
};

export const VALUE_SQUARE_HEIGHT = 20;
export const VALUE_SQUARE_DEFAULT_WIDTH = 28;

export function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function getInnerBounds(targetBounds: Rect, padding: ScaledPadding): Rect {
  return roundRect({
    x: targetBounds.x + padding.left,
    y: targetBounds.y + padding.top,
    width: Math.max(0, targetBounds.width - padding.left - padding.right),
    height: Math.max(0, targetBounds.height - padding.top - padding.bottom),
  });
}

/**
 * Global anchor positions for padding value squares (overlay-container coords).
 */
export function computePaddingValueSquareAnchors(params: {
  targetX: number;
  targetY: number;
  targetWidth: number;
  targetHeight: number;
  topSize: number;
  rightSize: number;
  bottomSize: number;
  leftSize: number;
  extra: number;
  valueSquareGap?: number;
  valueSquareWidth?: number;
  valueSquareHeight?: number;
}): PaddingValueAnchors {
  const gap = params.valueSquareGap ?? 4;
  const sqW = params.valueSquareWidth ?? VALUE_SQUARE_DEFAULT_WIDTH;
  const sqH = params.valueSquareHeight ?? VALUE_SQUARE_HEIGHT;
  const extra = params.extra;
  const {
    targetX,
    targetY,
    targetWidth,
    targetHeight,
    topSize,
    rightSize,
    bottomSize,
    leftSize,
  } = params;

  return {
    top: {
      x: targetX - extra - sqW - gap,
      y: targetY + topSize / 2 - sqH / 2,
    },
    right: {
      x: targetX + targetWidth - rightSize / 2 - sqW / 2,
      y: targetY - extra - sqH - gap,
    },
    bottom: {
      x: targetX - extra - sqW - gap,
      y: targetY + targetHeight - bottomSize / 2 - sqH / 2,
    },
    left: {
      x: targetX + leftSize / 2 - sqW / 2,
      y: targetY - extra - sqH - gap,
    },
  };
}

/** Vertical gap overlay spans full target height at gap column (analog Padding / Left). */
export function getVerticalGapOverlayRect(measureRect: Rect, targetBounds: Rect): Rect {
  return roundRect({
    x: measureRect.x,
    y: targetBounds.y,
    width: measureRect.width,
    height: targetBounds.height,
  });
}

/** Horizontal gap overlay spans full target width at gap row (analog Padding / Top). */
export function getHorizontalGapOverlayRect(measureRect: Rect, targetBounds: Rect): Rect {
  return roundRect({
    x: targetBounds.x,
    y: measureRect.y,
    width: targetBounds.width,
    height: measureRect.height,
  });
}

export function getGapValueSquarePosition(params: {
  gapOrientation: GapOrientation;
  gapRect: Rect;
  valueSquareSize: ValueSquareSize;
  paddingValueAnchors: PaddingValueAnchors;
}): ValueSquareAnchor {
  const { gapOrientation, gapRect, valueSquareSize, paddingValueAnchors } = params;

  if (gapOrientation === 'vertical') {
    const leftAnchor = paddingValueAnchors.left;
    const rightAnchor = paddingValueAnchors.right;

    const anchorY =
      leftAnchor?.y ??
      rightAnchor?.y ??
      Math.round(gapRect.y - valueSquareSize.height - 8);

    return {
      x: Math.round(gapRect.x + gapRect.width / 2 - valueSquareSize.width / 2),
      y: Math.round(anchorY),
    };
  }

  const topAnchor = paddingValueAnchors.top;
  const bottomAnchor = paddingValueAnchors.bottom;

  const anchorX =
    topAnchor?.x ??
    bottomAnchor?.x ??
    Math.round(gapRect.x - valueSquareSize.width - 8);

  return {
    x: Math.round(anchorX),
    y: Math.round(gapRect.y + gapRect.height / 2 - valueSquareSize.height / 2),
  };
}

