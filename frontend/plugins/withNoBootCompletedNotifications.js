const { withAndroidManifest } = require('@expo/config-plugins');

const BOOT_ACTIONS = new Set([
  'android.intent.action.BOOT_COMPLETED',
  'android.intent.action.REBOOT',
  'android.intent.action.QUICKBOOT_POWERON',
  'com.htc.intent.action.QUICKBOOT_POWERON',
]);

function removeUsesPermission(manifest, permissionName) {
  const perms = manifest?.manifest?.['uses-permission'];
  if (!Array.isArray(perms)) return;
  manifest.manifest['uses-permission'] = perms.filter(
    (p) => p?.$?.['android:name'] !== permissionName
  );
}

function removeBootActionsFromNotificationsReceiver(manifest) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) return;

  const receivers = app.receiver;
  if (!Array.isArray(receivers)) return;

  const target = receivers.find(
    (r) => r?.$?.['android:name'] === 'expo.modules.notifications.service.NotificationsService'
  );
  if (!target) return;

  const intentFilters = target['intent-filter'];
  if (!Array.isArray(intentFilters)) return;

  for (const f of intentFilters) {
    const actions = f?.action;
    if (!Array.isArray(actions)) continue;
    f.action = actions.filter((a) => !BOOT_ACTIONS.has(a?.$?.['android:name']));
  }
}

/**
 * expo-notifications includes a BOOT_COMPLETED receiver for restoring/rescheduling notifications after reboot.
 * OrkaChat uses push notifications only (no scheduled/local notifications), so we remove boot handling to avoid
 * Android 15+ BOOT_COMPLETED foreground-service restrictions warnings.
 */
module.exports = function withNoBootCompletedNotifications(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    removeUsesPermission(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED');
    removeBootActionsFromNotificationsReceiver(manifest);

    config.modResults = manifest;
    return config;
  });
};

