import { CapabilityState, SupportedFeatures } from './index';

export interface AirPurifierState {
  featureName: keyof typeof AirPurifierFeatures &
    keyof typeof SupportedFeatures;
  value: CapabilityState['value'];
  instance?: CapabilityState['instance'];
  rangeName?: CapabilityState['rangeName'];
}

export const AirPurifierFeatures = {
  power: 'power',
  range: 'range',
} as const;

export const AirPurifierFanSpeedRangeFeatures = ['Fan Speed', 'Fan speed'];
