import type { PluginSettings } from './settings';

export type BuildSpecificationMessage = {
  type: 'BUILD_SPECIFICATION';
  payload: {
    settings: PluginSettings;
  };
};

export type GetSettingsMessage = {
  type: 'GET_SETTINGS';
};

export type SaveSettingsMessage = {
  type: 'SAVE_SETTINGS';
  payload: {
    settings: PluginSettings;
  };
};

export type UiToMainMessage =
  | BuildSpecificationMessage
  | GetSettingsMessage
  | SaveSettingsMessage;

export type SpecificationBuiltMessage = {
  type: 'SPECIFICATION_BUILT';
  payload: {
    name: string;
  };
};

export type ErrorMessage = {
  type: 'ERROR';
  payload: {
    message: string;
  };
};

export type SettingsLoadedMessage = {
  type: 'SETTINGS_LOADED';
  payload: {
    settings: PluginSettings;
  };
};

export type ReadyMessage = {
  type: 'READY';
};

export type MainToUiMessage =
  | SpecificationBuiltMessage
  | ErrorMessage
  | SettingsLoadedMessage
  | ReadyMessage;
