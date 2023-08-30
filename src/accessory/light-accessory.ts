import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as A from 'fp-ts/Array';
import { constant, flow, identity, pipe } from 'fp-ts/lib/function';
import { CharacteristicValue, Service } from 'homebridge';
import { SupportedNamespaces, SupportedNamespacesType } from '../domain/alexa';
import * as mapper from '../util/mapper';
import BaseAccessory from './base-accessory';

export interface LightbulbState {
  namespace: keyof typeof LightbulbNamespaces &
    keyof typeof SupportedNamespaces;
  value: NonNullable<string | number | boolean>;
}

const LightbulbNamespaces = {
  'Alexa.PowerController': 'Alexa.PowerController',
  'Alexa.BrightnessController': 'Alexa.BrightnessController',
} as const;

export default class LightAccessory extends BaseAccessory {
  service: Service;
  namespaces = LightbulbNamespaces;

  configureServices() {
    this.service =
      this.platformAcc.getService(this.Service.Lightbulb) ||
      this.platformAcc.addService(
        this.Service.Lightbulb,
        this.device.displayName,
      );

    if (
      this.device.supportedOperations.includes('turnOn') &&
      this.device.supportedOperations.includes('turnOff')
    ) {
      this.service
        .getCharacteristic(this.Characteristic.On)
        .onGet(this.handlePowerGet.bind(this))
        .onSet(this.handlePowerSet.bind(this));
    }

    if (this.device.supportedOperations.includes('setBrightness')) {
      this.service
        .getCharacteristic(this.Characteristic.Brightness)
        .onGet(this.handleBrightnessGet.bind(this))
        .onSet(this.handleBrightnessSet.bind(this));
    }
  }

  async handlePowerGet(): Promise<boolean> {
    const alexaNamespace: SupportedNamespacesType = 'Alexa.PowerController';
    const determinePowerState = flow(
      O.filterMap<LightbulbState[], LightbulbState>(
        A.findFirst(({ namespace }) => namespace === alexaNamespace),
      ),
      O.map(({ value }) => value === 'ON'),
      O.tap((s) =>
        O.of(this.logWithContext('debug', `Get power result: ${s}`)),
      ),
    );

    const cacheValue = this.getCacheValue(alexaNamespace);
    this.logWithContext(
      'debug',
      `Triggered get power. Cached value before update: ${O.getOrElse(
        constant('' as CharacteristicValue),
      )(cacheValue)}`,
    );

    return await pipe(
      this.getState(determinePowerState),
      TE.match((e) => {
        this.logWithContext('errorT', 'Get power', e);
        throw this.serviceCommunicationError;
      }, identity),
    )();
  }

  async handlePowerSet(value: CharacteristicValue): Promise<void> {
    this.logWithContext('debug', `Triggered set power: ${value}`);
    if (typeof value !== 'boolean') {
      return;
    }
    const action = mapper.mapHomeKitPowerToAlexaAction(value);
    try {
      await pipe(
        this.platform.alexaApi.setDeviceState(this.device.id, action),
        TE.tapIO(
          this.updateCacheValue.bind(this, {
            value: mapper.mapHomeKitPowerToAlexaValue(value),
            namespace: 'Alexa.PowerController',
          }),
        ),
        TE.tap(() =>
          TE.of(
            this.service
              .getCharacteristic(this.Characteristic.On)
              .updateValue(value),
          ),
        ),
      )();
    } catch (e) {
      this.logWithContext('errorT', 'Set power', e);
    }
  }

  async handleBrightnessGet(): Promise<number> {
    const alexaNamespace: SupportedNamespacesType =
      'Alexa.BrightnessController';
    const determineBrightnessState = flow(
      O.filterMap<LightbulbState[], LightbulbState>(
        A.findFirst(({ namespace }) => namespace === alexaNamespace),
      ),
      O.map(({ value }) => value as number),
      O.tap((s) =>
        O.of(this.logWithContext('debug', `Get brightness result: ${s}`)),
      ),
    );

    const cacheValue = this.getCacheValue(alexaNamespace);
    this.logWithContext(
      'debug',
      `Triggered get brightness. Cached value before update: ${O.getOrElse(
        constant('' as CharacteristicValue),
      )(cacheValue)}`,
    );

    return await pipe(
      this.getState(determineBrightnessState),
      TE.match((e) => {
        this.logWithContext('errorT', 'Get brightness', e);
        throw this.serviceCommunicationError;
      }, identity),
    )();
  }

  async handleBrightnessSet(value: CharacteristicValue): Promise<void> {
    this.logWithContext('debug', `Triggered set brightness: ${value}`);
    if (typeof value !== 'number') {
      return;
    }
    const newBrightness = value.toString(10);
    try {
      await pipe(
        this.platform.alexaApi.setDeviceState(this.device.id, 'setBrightness', {
          brightness: newBrightness,
        }),
        TE.tapIO(
          this.updateCacheValue.bind(this, {
            value: newBrightness,
            namespace: 'Alexa.BrightnessController',
          }),
        ),
        TE.tap(() =>
          TE.of(
            this.service
              .getCharacteristic(this.Characteristic.Brightness)
              .updateValue(newBrightness),
          ),
        ),
      )();
    } catch (e) {
      this.logWithContext('errorT', 'Set brightness', e);
    }
  }
}