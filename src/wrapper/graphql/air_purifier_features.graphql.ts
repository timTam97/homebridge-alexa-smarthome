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
      }
      configuration {
        ... on RangeConfiguration {
          friendlyName {
            value {
              text
            }
          }
        }
      }
    }
  }
}`;
