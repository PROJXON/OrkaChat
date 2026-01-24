const { withAndroidManifest } = require('@expo/config-plugins');

const MLKIT_META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MLKIT_META_BARCODE_UI = 'barcode_ui';
const MLKIT_CODE_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function ensureToolsNamespace(manifest) {
  manifest.manifest.$ = manifest.manifest.$ || {};
  if (!manifest.manifest.$['xmlns:tools']) {
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function addMetaDataRemoveDirective(manifest) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) return;
  app['meta-data'] = app['meta-data'] || [];
  if (!Array.isArray(app['meta-data'])) return;

  // Remove barcode_ui meta-data even if it comes from a library (expo-camera).
  app['meta-data'].push({
    $: {
      'android:name': MLKIT_META_NAME,
      'android:value': MLKIT_META_BARCODE_UI,
      'tools:node': 'remove',
    },
  });
}

function addActivityRemoveDirective(manifest, activityName) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) return;
  app.activity = app.activity || [];
  if (!Array.isArray(app.activity)) return;
  app.activity.push({ $: { 'android:name': activityName, 'tools:node': 'remove' } });
}

/**
 * OrkaChat does not use barcode scanning. `expo-camera` declares the ML Kit barcode UI dependency
 * which pulls in a portrait-locked activity flagged by Play Console for large-screen UX.
 *
 * This plugin removes:
 * - com.google.mlkit.vision.DEPENDENCIES=barcode_ui (declared by expo-camera)
 * - the ML Kit code-scanner delegate activity (portrait-locked)
 *
 * Camera photo/video capture for attachments is unaffected; barcode scanning will be disabled.
 */
module.exports = function withNoMlkitCodeScanner(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    ensureToolsNamespace(manifest);
    addMetaDataRemoveDirective(manifest);
    addActivityRemoveDirective(manifest, MLKIT_CODE_SCANNER_ACTIVITY);

    config.modResults = manifest;
    return config;
  });
};
