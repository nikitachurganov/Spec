/// <reference types="@figma/plugin-typings" />

/**
 * Prepares the document for traversal APIs (`findAll`, `getNodeById`, etc.)
 * when `manifest.json` uses `documentAccess: "dynamic-page"`.
 */
export async function ensureDocumentReadyForTraversal(): Promise<void> {
  if (typeof figma.loadAllPagesAsync === 'function') {
    await figma.loadAllPagesAsync();
    return;
  }

  const page = figma.currentPage;
  if (page && typeof page.loadAsync === 'function') {
    await page.loadAsync();
  }
}

/** Resolves a node by id using the async API when required by dynamic-page access. */
export async function getNodeByIdSafeAsync(
  id: string | null | undefined
): Promise<BaseNode | null> {
  if (!id) return null;

  try {
    if (typeof figma.getNodeByIdAsync === 'function') {
      const node = await figma.getNodeByIdAsync(id);
      return node ?? null;
    }
    return figma.getNodeById(id);
  } catch (error) {
    console.warn('Cannot get node by id', id, error);
    return null;
  }
}
