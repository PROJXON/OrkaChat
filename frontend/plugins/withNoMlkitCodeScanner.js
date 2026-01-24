const { withAndroidManifest } = require('@expo/config-plugins');

const MLKIT_META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MLKIT_META_BARCODE_UI = 'barcode_ui';
const MLKIT_CODE_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function removeApplicationMetaData(manifest, predicate) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) return;
  const md = app['meta-data'];
  if (!Array.isArray(md)) return;
  app['meta-data'] = md.filter((m) => !predicate(m));
}

function removeActivity(manifest, activityName) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) return;
  const acts = app.activity;
  if (!Array.isArray(acts)) return;
  app.activity = acts.filter((a) => a?.$?.['android:name'] !== activityName);
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

    removeApplicationMetaData(manifest, (m) => {
      const name = m?.$?.['android:name'];
      const value = m?.$?.['android:value'];
      return name === MLKIT_META_NAME && String(value || '').trim() === MLKIT_META_BARCODE_UI;
    });

    removeActivity(manifest, MLKIT_CODE_SCANNER_ACTIVITY);

    config.modResults = manifest;
    return config;
  });
};
