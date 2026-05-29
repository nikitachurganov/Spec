export const FIT_VIEWPORT_PADDING = 16;

export const MIN_PREVIEW_SCALE = 0.1;
export const MAX_PREVIEW_SCALE = 3;

export function calculateFitTransform(params: {
  viewportWidth: number;
  viewportHeight: number;
  imageWidth: number;
  imageHeight: number;
  padding?: number;
  minScale?: number;
  maxScale?: number;
}): { scale: number; panX: number; panY: number } {
  const safePadding = params.padding ?? FIT_VIEWPORT_PADDING;
  const minScale = params.minScale ?? MIN_PREVIEW_SCALE;
  const maxScale = params.maxScale ?? MAX_PREVIEW_SCALE;

  const availableWidth = Math.max(1, params.viewportWidth - safePadding * 2);
  const availableHeight = Math.max(1, params.viewportHeight - safePadding * 2);

  const rawScale = Math.min(
    availableWidth / Math.max(1, params.imageWidth),
    availableHeight / Math.max(1, params.imageHeight)
  );

  const scale = Math.max(minScale, Math.min(maxScale, rawScale));

  return {
    scale,
    panX: (params.viewportWidth - params.imageWidth * scale) / 2,
    panY: (params.viewportHeight - params.imageHeight * scale) / 2,
  };
}
