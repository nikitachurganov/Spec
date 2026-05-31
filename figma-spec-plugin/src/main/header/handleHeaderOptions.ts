/// <reference types="@figma/plugin-typings" />

import type { PluginSettings } from '../../shared/settings';
import { normalizeHeaderSettings } from '../../shared/headerSettings';
import {
  collectHeaderTemplateOptions,
  sanitizeHeaderSettingsAgainstOptions,
} from './collectHeaderTemplateOptions';

export type HandleHeaderOptionsResult = {
  headerFound: boolean;
  statusOptions: string[];
  statusSizeOptions: string[];
  headerSettings: ReturnType<typeof normalizeHeaderSettings>;
};

export async function handleGetHeaderOptions(
  settings: PluginSettings
): Promise<HandleHeaderOptionsResult> {
  const templateOptions = await collectHeaderTemplateOptions();
  const headerSettings = sanitizeHeaderSettingsAgainstOptions(
    normalizeHeaderSettings(settings.headerSettings),
    templateOptions
  );

  return {
    headerFound: templateOptions.headerFound,
    statusOptions: templateOptions.statusOptions,
    statusSizeOptions: templateOptions.statusSizeOptions,
    headerSettings,
  };
}
