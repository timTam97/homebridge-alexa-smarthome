import type { Characteristic } from 'homebridge';
import { match } from 'ts-pattern';
import { CapabilityState, SupportedActionsType } from '../domain/alexa';
import { ModeFeature } from '../domain/alexa/save-device-capabilities';
import { constant } from 'fp-ts/lib/function';

export const mapHomeKitActiveToAlexaAction = (
  value: CapabilityState['value'],
  characteristic: typeof Characteristic,
) =>
  match<CapabilityState['value'], SupportedActionsType>(value)
    .with(characteristic.Active.ACTIVE, constant('turnOn'))
    .otherwise(constant('turnOff'));

export const mapHomeKitActiveToAlexaValue = (
  value: CapabilityState['value'],
  characteristic: typeof Characteristic,
) =>
  match(value)
    .with(characteristic.Active.ACTIVE, constant('ON'))
    .otherwise(constant('OFF'));

export const mapAlexaPowerToCurrentState = (
  powerValue: CapabilityState['value'],
  characteristic: typeof Characteristic,
) =>
  match(powerValue)
    .with('ON', constant(characteristic.CurrentAirPurifierState.PURIFYING_AIR))
    .otherwise(constant(characteristic.CurrentAirPurifierState.INACTIVE));

export const mapAlexaModeToRotationSpeed = (
  currentMode: string,
  supportedModes: ModeFeature['supportedModes'],
): number => {
  const index = supportedModes.findIndex((m) => m.value === currentMode);
  if (index < 0 || supportedModes.length <= 1) {
    return 0;
  }
  return Math.round((index / (supportedModes.length - 1)) * 100);
};

export const mapRotationSpeedToAlexaMode = (
  percentage: number,
  supportedModes: ModeFeature['supportedModes'],
): string => {
  if (supportedModes.length === 0) {
    return '';
  }
  if (supportedModes.length === 1) {
    return supportedModes[0].value;
  }
  const index = Math.round((percentage / 100) * (supportedModes.length - 1));
  const clamped = Math.max(0, Math.min(index, supportedModes.length - 1));
  return supportedModes[clamped].value;
};
