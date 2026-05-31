/// <reference types="@figma/plugin-typings" />

import {
  formatHeaderDate,
  normalizeHeaderSettings,
  type HeaderSettings,
} from '../../shared/headerSettings';
import { findNestedStatusInstance, setPropertyByVisibleName } from './headerComponentProperties';

export type ApplyHeaderSettingsContext = {
  defaultComponentName?: string;
};

export async function applyHeaderSettingsToInstance(
  headerInstance: InstanceNode,
  rawSettings: HeaderSettings | undefined,
  context?: ApplyHeaderSettingsContext
): Promise<void> {
  const settings = normalizeHeaderSettings(rawSettings);
  const resolvedName = settings.name.trim() || context?.defaultComponentName?.trim() || '';
  const resolvedDate = settings.date.trim() || formatHeaderDate(new Date());

  headerInstance.name = 'Documentation header';

  setPropertyByVisibleName(headerInstance, 'Show Status', settings.showStatus);
  setPropertyByVisibleName(headerInstance, 'Show Description', settings.showDescription);
  setPropertyByVisibleName(headerInstance, 'Name', resolvedName);
  setPropertyByVisibleName(headerInstance, 'Description', settings.description);
  setPropertyByVisibleName(headerInstance, 'Date', resolvedDate);
  setPropertyByVisibleName(headerInstance, 'Project', settings.project);

  const nestedStatus = await findNestedStatusInstance(headerInstance);
  if (nestedStatus) {
    setPropertyByVisibleName(nestedStatus, 'Status', settings.status);
    setPropertyByVisibleName(nestedStatus, 'Size', settings.statusSize);
    return;
  }

  if (settings.showStatus) {
    console.warn('[Header] Nested .DS-Status instance not found');
  }
}
