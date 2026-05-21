/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';

/**
 * Builds the DS specification wrapper for the given pre-validated root node.
 *
 * The caller is responsible for selection validation, document loading,
 * staging-page atomic insertion, positioning and UI messaging. This function
 * only constructs the wrapper and returns it.
 */
export declare function buildSpecification(
  settings: PluginSettings,
  root: SceneNode
): Promise<FrameNode>;
