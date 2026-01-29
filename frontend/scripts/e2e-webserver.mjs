import { spawn } from 'node:child_process';

function requireEnv(name) {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

const distDir = requireEnv('E2E_DIST_DIR') ?? 'dist-staging';
const port = Number(requireEnv('E2E_PORT') ?? 4173);

// We intentionally do not validate ORKA_ENV/STAGING_* here:
// - The export will still work for non-staging environments.
// - Callers (CI/local) can pass env vars as needed.

function run(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  return child;
}

// 1) Export web (clean) so the bundle has the right baked-in env.
const exportProc = run('npx', ['expo', 'export', '-p', 'web', '--output-dir', distDir, '--clear']);

exportProc.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);

  // 2) Serve export (Playwright will wait on the URL via webServer.url).
  const serverProc = run('npx', ['http-server', distDir, '-p', String(port), '-c-1']);

  const shutdown = () => {
    // Best-effort shutdown; Playwright will also kill the process group when possible.
    try {
      serverProc.kill('SIGTERM');
    } catch {
      // ignore
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  serverProc.on('exit', (serverCode) => {
    process.exit(serverCode ?? 0);
  });
});
