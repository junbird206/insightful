const { withEntitlementsPlist } = require('expo/config-plugins')

/**
 * Removes the aps-environment entitlement that expo-notifications adds by default.
 * This allows local notifications to work without requiring the Push Notifications
 * capability, which is not available on free Personal Team accounts.
 */
module.exports = function stripPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment']
    return config
  })
}
