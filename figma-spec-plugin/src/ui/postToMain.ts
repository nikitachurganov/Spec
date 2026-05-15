import type { UiToMainMessage } from '@shared/messages';

export function postToMain(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, '*');
}
