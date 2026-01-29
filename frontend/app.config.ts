import type { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const orkaEnv = process.env.ORKA_ENV ?? 'production';

  const isStaging = orkaEnv === 'staging';

  const API_URL = isStaging ? process.env.STAGING_API_URL : process.env.PROD_API_URL;
  const WS_URL = isStaging ? process.env.STAGING_WS_URL : process.env.PROD_WS_URL;
  const AI_API_URL = isStaging ? process.env.STAGING_AI_API_URL : process.env.PROD_AI_API_URL;

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      API_URL: API_URL ?? (config.extra as any)?.API_URL,
      WS_URL: WS_URL ?? (config.extra as any)?.WS_URL,
      AI_API_URL: AI_API_URL ?? (config.extra as any)?.AI_API_URL,
      ORKA_ENV: orkaEnv,
    },
  };
};
