import { CapabilityState, SupportedFeatures } from './index';

export interface AirPurifierState {
  featureName: keyof typeof AirPurifierFeatures &
    keyof typeof SupportedFeatures;
  value: CapabilityState['value'];
  instance?: CapabilityState['instance'];
  rangeName?: CapabilityState['rangeName'];
  modeName?: CapabilityState['modeName'];
}

export const AirPurifierFeatures = {
  power: 'power',
  range: 'range',
  mode: 'mode',
} as const;

export const AirPurifierFanSpeedRangeFeatures = ['Fan Speed', 'Fan speed'];

export const AirPurifierFanSpeedModeInstances = ['Purifier.Mode', 'Purifier'];
