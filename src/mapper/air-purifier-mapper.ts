import type { Characteristic } from 'homebridge';
import { match } from 'ts-pattern';
import { CapabilityState, SupportedActionsType } from '../domain/alexa';
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
