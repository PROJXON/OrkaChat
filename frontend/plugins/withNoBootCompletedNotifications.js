const { withAndroidManifest } = require('@expo/config-plugins');

const BOOT_ACTIONS = new Set([
  'android.intent.action.BOOT_COMPLETED',
  'android.intent.action.REBOOT',
  'android.intent.action.QUICKBOOT_POWERON',
  'com.htc.intent.action.QUICKBOOT_POWERON',
]);

function ensureToolsNamespace(manifest) {
  manifest.manifest.$ = manifest.manifest.$ || {};
  // Ensure tools namespace is present so tools:node attributes are valid.
  if (!manifest.manifest.$['xmlns:tools']) {
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function addUsesPermissionRemoveDirective(manifest, permissionName) {
  manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
  const perms = manifest.manifest['uses-permission'];
  if (!Array.isArray(perms)) return;

  // Add a manifest-merger remove directive so the permission is removed even if
  // a library (expo-notifications) declares it.
  const already = perms.some(
    (p) => p?.$?.['android:name'] === permissionName && p?.$?.['tools:node'] === 'remove',
  );
  if (!already) {
    perms.push({ $: { 'android:name': permissionName, 'tools:node': 'remove' } });
  }
}

function addBootActionRemoveDirectives(manifest) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) return;

  app.receiver = app.receiver || [];
  if (!Array.isArray(app.receiver)) return;

  // We keep the receiver for other actions, but remove boot/reboot triggers via manifest-merger directives.
  // This matches Play Console's warning and avoids Android 15+ BOOT_COMPLETED restrictions.
  const receiverName = 'expo.modules.notifications.service.NotificationsService';
  const receiver = {
    $: { 'android:name': receiverName, 'tools:node': 'merge' },
    'intent-filter': [
      {
        $: { 'android:priority': '-1', 'tools:node': 'merge' },
        action: Array.from(BOOT_ACTIONS).map((a) => ({ $: { 'android:name': a, 'tools:node': 'remove' } })),
      },
    ],
  };
  app.receiver.push(receiver);
}

/**
 * expo-notifications includes a BOOT_COMPLETED receiver for restoring/rescheduling notifications after reboot.
 * OrkaChat uses push notifications only (no scheduled/local notifications), so we remove boot handling to avoid
 * Android 15+ BOOT_COMPLETED foreground-service restrictions warnings.
 */
module.exports = function withNoBootCompletedNotifications(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    ensureToolsNamespace(manifest);
    addUsesPermissionRemoveDirective(manifest, 'android.permission.RECEIVE_BOOT_COMPLETED');
    addBootActionRemoveDirectives(manifest);

    config.modResults = manifest;
    return config;
  });
};
