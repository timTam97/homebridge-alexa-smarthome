# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Homebridge plugin that exposes Alexa-connected smart home devices to Apple HomeKit. It authenticates with Amazon's Alexa API using session cookies (via `alexa-remote2`/`alexa-cookie2`) and maps Alexa device capabilities to HomeKit services. Supported devices: lights, switches, fans, locks, outlets, thermostats, air quality monitors, and generic on/off devices as switches.

## Commands

- **Build**: `npm run build` (cleans `dist/`, compiles with `tsconfig.prod.json`)
- **Lint**: `npm run lint` (ESLint with zero warnings allowed)
- **Format**: `npm run format` (Prettier on `src/**/*.ts`)
- **Unit tests**: `npm run test-ci` (runs only `*.test.ts` files)
- **All tests**: `npm test` (runs `*.test.ts` + `*.it.ts` integration tests)
- **Single test**: `npx jest --verbose --silent=false --runInBand path/to/file.test.ts`
- **Watch mode**: `npm run watch` (build + nodemon)

Integration tests (`*.it.ts`) require a `.env` file (see `.env.example`) and a valid `.homebridge-alexa-smarthome` cookie file in the repo root.

## Architecture

### Entry Point & Plugin Registration

`src/index.ts` registers `AlexaSmartHomePlatform` as a Homebridge `DynamicPlatformPlugin`. On `didFinishLaunching`, the platform authenticates via `alexa-remote2`, discovers devices, creates accessories, and removes stale cached accessories.

### Core Layers

- **`src/platform.ts`** — `AlexaSmartHomePlatform`: orchestrates authentication, device discovery, and accessory lifecycle. Wires together all other layers.
- **`src/wrapper/alexa-api-wrapper.ts`** — `AlexaApiWrapper`: wraps `alexa-remote2` calls. Uses GraphQL queries for device state get/set (via `/nexus/v1/graphql`) and REST for legacy operations. Rate-limited via a semaphore (max 2 concurrent requests, 65s timeout).
- **`src/wrapper/graphql/`** — GraphQL query strings for each feature type (power, light, lock, thermostat, air quality, range, temperature).
- **`src/store/device-store.ts`** — `DeviceStore`: in-memory cache for device capability states with configurable TTL.
- **`src/mapper/index.ts`** — `mapAlexaDeviceToHomeKitAccessoryInfos`: maps Alexa device types and capabilities to HomeKit service UUIDs. Determines which HomeKit accessories a device should create (e.g., an air quality monitor may produce multiple accessories).
- **`src/accessory/`** — Accessory implementations, all extending `BaseAccessory`:
  - `accessory-factory.ts` — Factory pattern using `ts-pattern` match to instantiate the correct accessory class from a HomeKit service UUID.
  - `base-accessory.ts` — Abstract base with shared logic: service info, caching helpers, GraphQL state queries, HAP error helpers.
  - Device-specific: `light-accessory.ts`, `switch-accessory.ts`, `fan-accessory.ts`, `lock-accessory.ts`, `outlet-accessory.ts`, `thermostat-accessory.ts`, `air-quality-accessory.ts`, `co-accessory.ts`, `humidity-accessory.ts`, `temperature-accessory.ts`.
- **`src/domain/alexa/`** — Alexa domain types: supported device types, namespaces, actions, features, capability states, error types, and response parsers.
- **`src/domain/homebridge/`** — Homebridge-side types: `AlexaPlatformConfig`, `HomebridgeAccessoryInfo`.

### Key Patterns

- **Functional style with fp-ts**: The codebase uses `fp-ts` extensively — `Either`, `Option`, `TaskEither`, `IOEither`, `pipe`, `flow`. Side effects are wrapped in `IO`/`TaskEither` monads. Familiarize yourself with `fp-ts` combinators before making changes.
- **ts-pattern**: Used for exhaustive pattern matching on device types, service UUIDs, and config validation.
- **Each accessory has `requiredOperations`**: A static list of Alexa actions required for that device type. The mapper checks these during device discovery.
- **Nullable type**: `Nullable<T> = T | null | undefined` (defined in `src/domain/index.ts`), used throughout config and API response types.

### Test Setup

- Jest with `ts-jest` preset. Config in `jest.config.js`.
- Global test setup in `__tests__/test-setup.ts`: mocks the Homebridge logger, provides `createPlatform()` and `createPlatformConfig()` helpers, and declares globals (`MockLogger`, `TEST_UUID`).
- Test files live alongside source: `*.test.ts` for unit tests, `*.it.ts` for integration tests.
- `tsconfig.json` includes both `src/` and `__tests__/`; `tsconfig.prod.json` excludes test files.

### CI

GitHub Actions (`checks.yml`) runs lint, format, and build across Node 18/20/22/24 on PRs and pushes to main. Tests are currently commented out in CI. Release workflow (`build.yml`) triggers on tags.
