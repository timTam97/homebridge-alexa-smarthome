import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import { constant, identity, pipe } from 'fp-ts/lib/function';
import * as S from 'fp-ts/string';
import { Pattern, match } from 'ts-pattern';
import { Endpoint, SmartHomeDevice } from './get-devices';

export interface RangeFeaturesByDevice {
  [entityId: string]: { [rangeName: string]: RangeFeature };
}
export interface RangeFeatures {
  [rangeName: string]: RangeFeature;
}

export const extractRangeFeatures = (
  devices: [Endpoint, SmartHomeDevice][],
): RangeFeaturesByDevice => {
  const whereValidInfo = ([endpoint, device]: [
    Endpoint,
    SmartHomeDevice,
  ]): O.Option<[string, RangeFeature[]]> => {
    const rangeFeatures = pipe(
      endpoint.features,
      RA.filterMap((f) =>
        match(f)
          .with(
            {
              name: 'range',
              instance: Pattern.string,
              properties: Pattern.array({
                rangeValue: {
                  value: Pattern.number,
                },
              }),
              configuration: {
                friendlyName: {
                  value: {
                    text: Pattern.string,
                  },
                },
              },
            },
            (_) =>
              O.of({
                featureName: _.name,
                instance: _.instance,
                rangeName: _.configuration.friendlyName.value.text,
              } as RangeFeature),
          )
          .otherwise(constant(O.none)),
      ),
    );
    if (rangeFeatures.length === 0) {
      return O.none;
    } else {
      return O.of([device.id, rangeFeatures] as [string, RangeFeature[]]);
    }
  };

  const whereDeviceHasRangeControllers = (rcfd: {
    id: string;
    rangeFeatures: RangeFeatures;
  }) => (Object.keys(rcfd.rangeFeatures).length > 0 ? O.of(rcfd) : O.none);

  return pipe(
    O.of(devices),
    O.map(
      RA.reduce<
        [Endpoint, SmartHomeDevice],
        RR.ReadonlyRecord<string, [Endpoint, SmartHomeDevice]>
      >({}, (acc, [e, d]) => ({
        ...acc,
        [d.id]: [e, d],
      })),
    ),
    O.map(
      (endpoints) =>
        pipe(
          endpoints,
          RR.filterMap(whereValidInfo),
          RR.map(([id, rangeFeatures]) => ({
            id,
            rangeFeatures: rangeFeatures.reduce((acc, cur) => {
              acc[cur.rangeName] = cur;
              return acc;
            }, {}),
          })),
          RR.filterMap(whereDeviceHasRangeControllers),
          RR.reduce(S.Ord)({}, (acc, { id, rangeFeatures }) => {
            acc[id] = rangeFeatures;
            return acc;
          }),
        ) as RangeFeaturesByDevice,
    ),
    O.match(constant({}), identity),
  );
};

export interface RangeFeature {
  featureName: string; // required
  instance: string; // required
  rangeName: string; // required
}

export interface ModeFeature {
  featureName: string;
  instance: string;
  modeName: string;
  supportedModes: Array<{ value: string; friendlyName: string }>;
}

export interface ModeFeatures {
  [modeName: string]: ModeFeature;
}

export interface ModeFeaturesByDevice {
  [entityId: string]: ModeFeatures;
}

export const extractModeFeatures = (
  devices: [Endpoint, SmartHomeDevice][],
): ModeFeaturesByDevice => {
  const whereValidInfo = ([endpoint, device]: [
    Endpoint,
    SmartHomeDevice,
  ]): O.Option<[string, ModeFeature[]]> => {
    const modeFeatures = pipe(
      endpoint.features,
      RA.filterMap((f) =>
        match(f)
          .with(
            {
              name: 'mode',
              instance: Pattern.string,
              properties: Pattern.array({
                modeValue: Pattern.string,
              }),
              configuration: {
                friendlyName: {
                  value: {
                    text: Pattern.string,
                  },
                },
                supportedModes: Pattern.array({
                  value: Pattern.string,
                }),
              },
            },
            (_) =>
              O.of({
                featureName: _.name,
                instance: _.instance,
                modeName: _.configuration.friendlyName.value.text,
                supportedModes: _.configuration.supportedModes.map((m) => ({
                  value: m.value,
                  friendlyName:
                    m.friendlyNames?.[0]?.value?.text ?? m.value,
                })),
              } as ModeFeature),
          )
          .otherwise(constant(O.none)),
      ),
    );
    if (modeFeatures.length === 0) {
      return O.none;
    } else {
      return O.of([device.id, modeFeatures] as [string, ModeFeature[]]);
    }
  };

  const whereDeviceHasModeControllers = (mcfd: {
    id: string;
    modeFeatures: ModeFeatures;
  }) => (Object.keys(mcfd.modeFeatures).length > 0 ? O.of(mcfd) : O.none);

  return pipe(
    O.of(devices),
    O.map(
      RA.reduce<
        [Endpoint, SmartHomeDevice],
        RR.ReadonlyRecord<string, [Endpoint, SmartHomeDevice]>
      >({}, (acc, [e, d]) => ({
        ...acc,
        [d.id]: [e, d],
      })),
    ),
    O.map(
      (endpoints) =>
        pipe(
          endpoints,
          RR.filterMap(whereValidInfo),
          RR.map(([id, modeFeatures]) => ({
            id,
            modeFeatures: modeFeatures.reduce(
              (acc, cur) => {
                acc[cur.modeName] = cur;
                return acc;
              },
              {} as ModeFeatures,
            ),
          })),
          RR.filterMap(whereDeviceHasModeControllers),
          RR.reduce(S.Ord)({}, (acc, { id, modeFeatures }) => {
            acc[id] = modeFeatures;
            return acc;
          }),
        ) as ModeFeaturesByDevice,
    ),
    O.match(constant({}), identity),
  );
};
