/* eslint-disable no-console */
/**
 * EAS Build helper:
 * - Keep `frontend/google-services.json` out of git
 * - Provide it to EAS via an environment variable:
 *   - Preferred: GOOGLE_SERVICES_JSON_FILE (path to a file on disk)
 *   - Alternative: GOOGLE_SERVICES_JSON_BASE64 (base64-encoded contents)
 *
 * This script writes `frontend/google-services.json` before Expo prebuild runs.
 */

const fs = require('fs');
const path = require('path');

function safeStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function decodeBase64ToUtf8(b64) {
  return Buffer.from(String(b64 || ''), 'base64').toString('utf8');
}

function main() {
  const outPath = path.join(__dirname, '..', '..', 'google-services.json');
  const fileVar = safeStr(process.env.GOOGLE_SERVICES_JSON_FILE || process.env.GOOGLE_SERVICES_JSON);
  const b64Var = safeStr(process.env.GOOGLE_SERVICES_JSON_BASE64);

  if (fileVar) {
    const src = path.isAbsolute(fileVar) ? fileVar : path.resolve(process.cwd(), fileVar);
    if (!fs.existsSync(src)) {
      console.log(`[eas] google-services source file missing at: ${src}`);
      process.exit(1);
    }
    fs.copyFileSync(src, outPath);
    console.log(`[eas] wrote ${outPath} from ${src}`);
    return;
  }

  if (b64Var) {
    const jsonText = decodeBase64ToUtf8(b64Var);
    try {
      JSON.parse(jsonText);
    } catch (e) {
      console.log('[eas] GOOGLE_SERVICES_JSON_BASE64 did not decode to valid JSON');
      process.exit(1);
    }
    fs.writeFileSync(outPath, jsonText, 'utf8');
    console.log(`[eas] wrote ${outPath} from GOOGLE_SERVICES_JSON_BASE64`);
    return;
  }

  console.log(
    '[eas] google-services.json not provided. Set GOOGLE_SERVICES_JSON_FILE (preferred) or GOOGLE_SERVICES_JSON_BASE64.'
  );
  // Do not hard-fail local dev; EAS will fail later if Android push is required.
}

main();

