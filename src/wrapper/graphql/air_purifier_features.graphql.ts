export const AirPurifierQuery = `query getPowerRangeStates(
  $endpointId: String!
) {
  endpoint(id: $endpointId) {
    features {
      name
      instance
      properties {
        name
        ... on Power {
          powerStateValue
        }
        ... on RangeValue {
          rangeValue {
            value
          }
        }
        ... on ModeValue {
          modeValue
        }
      }
      configuration {
        ... on RangeConfiguration {
          friendlyName {
            value {
              text
            }
          }
        }
        ... on ModeConfiguration {
          friendlyName {
            value {
              text
            }
          }
          supportedModes {
            value
            friendlyNames {
              value {
                text
              }
            }
          }
        }
      }
    }
  }
}`;
