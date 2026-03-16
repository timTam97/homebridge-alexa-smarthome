import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import * as TE from 'fp-ts/TaskEither';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import { CharacteristicValue, Service } from 'homebridge';
import { SupportedActionsType } from '../domain/alexa';
import {
  AirPurifierFanSpeedModeInstances,
  AirPurifierFanSpeedRangeFeatures,
  AirPurifierState,
} from '../domain/alexa/air-purifier';
import {
  ModeFeature,
  RangeFeature,
} from '../domain/alexa/save-device-capabilities';
import * as mapper from '../mapper/air-purifier-mapper';
import BaseAccessory from './base-accessory';

export default class AirPurifierAccessory extends BaseAccessory {
  static requiredOperations: SupportedActionsType[] = ['turnOn', 'turnOff'];
  service: Service;
  isExternalAccessory = false;

  configureServices() {
    this.service =
      this.platformAcc.getService(this.Service.AirPurifier) ||
      this.platformAcc.addService(
        this.Service.AirPurifier,
        this.device.displayName,
      );

    this.service
      .getCharacteristic(this.Characteristic.Active)
      .onGet(this.handleActiveGet.bind(this))
      .onSet(this.handleActiveSet.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.CurrentAirPurifierState)
      .onGet(this.handleCurrentStateGet.bind(this));

    this.service
      .getCharacteristic(this.Characteristic.TargetAirPurifierState)
      .onGet(() => this.Characteristic.TargetAirPurifierState.MANUAL)
      .onSet(() => undefined);

    this.configureFanSpeed();
  }

  private configureFanSpeed() {
    const modeAsset = pipe(
      Object.values(this.modeFeatures),
      A.findFirst((mf) =>
        AirPurifierFanSpeedModeInstances.includes(mf.instance),
      ),
    );
    if (O.isSome(modeAsset)) {
      this.logWithContext(
        'debug',
        `Using mode controller for fan speed: ${modeAsset.value.modeName}`,
      );
      this.service
        .getCharacteristic(this.Characteristic.RotationSpeed)
        .onGet(this.handleModeRotationSpeedGet.bind(this, modeAsset.value))
        .onSet(this.handleModeRotationSpeedSet.bind(this, modeAsset.value));
      return;
    }

    pipe(
      AirPurifierFanSpeedRangeFeatures,
      RA.findFirstMap((name) => RR.lookup(name)(this.rangeFeatures)),
      O.match(
        () =>
          this.logWithContext(
            'debug',
            'No fan speed feature found, skipping RotationSpeed',
          ),
        (asset) => {
          this.service
            .getCharacteristic(this.Characteristic.RotationSpeed)
            .onGet(this.handleRotationSpeedGet.bind(this, asset))
            .onSet(this.handleRotationSpeedSet.bind(this, asset));
        },
      ),
    );
  }

  async handleActiveGet(): Promise<number> {
    const determinePowerState = flow(
      A.findFirst<AirPurifierState>(
        ({ featureName }) => featureName === 'power',
      ),
      O.tap(({ value }) =>
        O.of(this.logWithContext('debug', `Get power result: ${value}`)),
      ),
      O.map(({ value }) =>
        value === 'ON'
          ? this.Characteristic.Active.ACTIVE
          : this.Characteristic.Active.INACTIVE,
      ),
    );

    return pipe(
      this.getStateGraphQl(determinePowerState),
      TE.match((e) => {
        this.logWithContext('errorT', 'Get power', e);
        throw this.serviceCommunicationError;
      }, identity),
    )();
  }

  async handleActiveSet(value: CharacteristicValue): Promise<void> {
    this.logWithContext('debug', `Triggered set power: ${value}`);
    if (typeof value !== 'number') {
      throw this.invalidValueError;
    }
    const action = mapper.mapHomeKitActiveToAlexaAction(
      value,
      this.Characteristic,
    );
    return pipe(
      this.platform.alexaApi.setDeviceStateGraphQl(
        this.device.endpointId,
        'power',
        action,
      ),
      TE.match(
        (e) => {
          this.logWithContext('errorT', 'Set power', e);
          throw this.serviceCommunicationError;
        },
        () => {
          this.updateCacheValue({
            value: mapper.mapHomeKitActiveToAlexaValue(
              value,
              this.Characteristic,
            ),
            featureName: 'power',
          });
        },
      ),
    )();
  }

  async handleCurrentStateGet(): Promise<number> {
    const determineCurrentState = flow(
      A.findFirst<AirPurifierState>(
        ({ featureName }) => featureName === 'power',
      ),
      O.map(({ value }) =>
        mapper.mapAlexaPowerToCurrentState(value, this.Characteristic),
      ),
    );

    return pipe(
      this.getStateGraphQl(determineCurrentState),
      TE.match((e) => {
        this.logWithContext('errorT', 'Get current state', e);
        throw this.serviceCommunicationError;
      }, identity),
    )();
  }

  async handleRotationSpeedGet(asset: RangeFeature): Promise<number> {
    const determineSpeed = flow(
      A.findFirst<AirPurifierState>(
        ({ featureName, instance }) =>
          featureName === 'range' && asset.instance === instance,
      ),
      O.tap(({ value }) =>
        O.of(this.logWithContext('debug', `Get fan speed result: ${value}`)),
      ),
      O.flatMap(({ value }) =>
        typeof value === 'number' ? O.of(value) : O.none,
      ),
    );

    return pipe(
      this.getStateGraphQl(determineSpeed),
      TE.match((e) => {
        this.logWithContext('errorT', 'Get fan speed', e);
        throw this.serviceCommunicationError;
      }, identity),
    )();
  }

  async handleRotationSpeedSet(
    asset: RangeFeature,
    value: CharacteristicValue,
  ): Promise<void> {
    this.logWithContext('debug', `Triggered set fan speed: ${value}`);
    if (typeof value !== 'number') {
      throw this.invalidValueError;
    }
    return pipe(
      this.platform.alexaApi.setDeviceStateGraphQl(
        this.device.endpointId,
        'range',
        'setRangeValue',
        { rangeValue: value },
        asset.instance,
      ),
      TE.match(
        (e) => {
          this.logWithContext('errorT', 'Set fan speed', e);
          throw this.serviceCommunicationError;
        },
        () => {
          this.updateCacheValue({
            value,
            featureName: 'range',
            instance: asset.instance,
          });
        },
      ),
    )();
  }

  async handleModeRotationSpeedGet(asset: ModeFeature): Promise<number> {
    const determineSpeed = flow(
      A.findFirst<AirPurifierState>(
        ({ featureName, instance }) =>
          featureName === 'mode' && asset.instance === instance,
      ),
      O.tap(({ value }) =>
        O.of(
          this.logWithContext('debug', `Get mode fan speed result: ${value}`),
        ),
      ),
      O.flatMap(({ value }) =>
        typeof value === 'string'
          ? O.of(
              mapper.mapAlexaModeToRotationSpeed(value, asset.supportedModes),
            )
          : O.none,
      ),
    );

    return pipe(
      this.getStateGraphQl(determineSpeed),
      TE.match((e) => {
        this.logWithContext('errorT', 'Get mode fan speed', e);
        throw this.serviceCommunicationError;
      }, identity),
    )();
  }

  async handleModeRotationSpeedSet(
    asset: ModeFeature,
    value: CharacteristicValue,
  ): Promise<void> {
    this.logWithContext('debug', `Triggered set mode fan speed: ${value}`);
    if (typeof value !== 'number') {
      throw this.invalidValueError;
    }
    const modeValue = mapper.mapRotationSpeedToAlexaMode(
      value,
      asset.supportedModes,
    );
    this.logWithContext('debug', `Mapped ${value}% to mode: ${modeValue}`);
    return pipe(
      this.platform.alexaApi.setDeviceStateGraphQl(
        this.device.endpointId,
        'mode',
        'setModeValue',
        { modeValue },
        asset.instance,
      ),
      TE.match(
        (e) => {
          this.logWithContext('errorT', 'Set mode fan speed', e);
          throw this.serviceCommunicationError;
        },
        () => {
          this.updateCacheValue({
            value: modeValue,
            featureName: 'mode',
            instance: asset.instance,
          });
        },
      ),
    )();
  }
}
