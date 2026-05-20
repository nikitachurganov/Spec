/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import type { StyleResolver } from '../tokens/styleResolver';
import type { SpacingTokenResolver } from '../tokens/spacingTokenResolver';

export type BuildContext = {
  root: SceneNode;
  settings: PluginSettings;
  resolver: StyleResolver;
  spacingTokenResolver?: SpacingTokenResolver;
};
