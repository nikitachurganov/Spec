import type { MainToUiMessage } from '../shared/messages';

export function postToUi(message: MainToUiMessage): void {
  figma.ui.postMessage(message);
}
