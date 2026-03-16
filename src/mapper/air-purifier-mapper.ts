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

export const sortModesByFanSpeed = (
  modes: ModeFeature['supportedModes'],
): ModeFeature['supportedModes'] => {
  const priority = (m: ModeFeature['supportedModes'][number]): number => {
    const name = m.friendlyName.toLowerCase();
    if (name.includes('auto')) return 0;
    if (name.includes('silent') || name.includes('sleep')) return 1;
    if (name.includes('turbo') || name.includes('max')) return 100;
    // Extract number from name for speed levels (e.g., "manual speed 1" → 1)
    const num = name.match(/\d+/);
    if (num) return 10 + parseInt(num[0], 10);
    return 50;
  };
  return [...modes].sort((a, b) => priority(a) - priority(b));
};

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
