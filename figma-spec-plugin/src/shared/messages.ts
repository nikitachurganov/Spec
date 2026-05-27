import type { PluginSettings } from './settings';
import type { AnatomyPreviewPayload } from './anatomyPreview';

export type SpecLayerOption = {
  path: string;
  name: string;
  type: string;
  depth: number;
  parentPath?: string;
  isAutoSelected: boolean;
  isSelectable: boolean;
  isComponentBoundary: boolean;
  isRoot?: boolean;
  isText?: boolean;
  kind?: string;
};

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

export type GetSpecLayerOptionsMessage = {
  type: 'GET_SPEC_LAYER_OPTIONS';
};

export type SaveSpecSelectedLayersMessage = {
  type: 'SAVE_SPEC_SELECTED_LAYERS';
  payload: {
    selectedLayerPaths: string[];
  };
};

export type SaveAnatomySelectedLayersMessage = {
  type: 'SAVE_ANATOMY_SELECTED_LAYERS';
  payload: {
    selectedLayerPaths: string[];
  };
};

export type ResizePluginMessage = {
  type: 'RESIZE_PLUGIN';
  payload: {
    width: number;
    height: number;
  };
};

export type UiToMainMessage =
  | BuildSpecificationMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | GetSpecLayerOptionsMessage
  | SaveSpecSelectedLayersMessage
  | SaveAnatomySelectedLayersMessage
  | ResizePluginMessage;

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

export type SpecLayerOptionsLoadedMessage = {
  type: 'SPEC_LAYER_OPTIONS_LOADED';
  payload: {
    rootId: string;
    rootName: string;
    options: SpecLayerOption[];
    specSelectedLayerPaths: string[];
    anatomySelectedLayerPaths: string[];
    autoSelectedLayerPaths: string[];
    anatomyPreviewPayload: AnatomyPreviewPayload | null;
  };
};

export type SpecLayerOptionsErrorMessage = {
  type: 'SPEC_LAYER_OPTIONS_ERROR';
  payload: {
    message: string;
  };
};

export type ReadyMessage = {
  type: 'READY';
};

export type MainToUiMessage =
  | SpecificationBuiltMessage
  | ErrorMessage
  | SettingsLoadedMessage
  | SpecLayerOptionsLoadedMessage
  | SpecLayerOptionsErrorMessage
  | ReadyMessage;
