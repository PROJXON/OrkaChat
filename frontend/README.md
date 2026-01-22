# OrkaChat frontend (Expo / React Native / Web)

This is the **Expo** app for OrkaChat (React Native + RN Web), written in **TypeScript**.

## Setup

From `frontend/`:

```bash
npm install
npm start
```

Useful scripts:

- **web**: `npm run web`
- **android**: `npm run android`
- **ios** (macOS): `npm run ios`
- **static export**: `npm run build:web` (outputs `dist/`)
- **tests**: `npm test` (or `npm run test:watch`, `npm run test:ci`)

## Runtime configuration (API / WS / AI / CDN)

URLs are sourced from:

- `app.json` → `expo.extra`:
  - `API_URL`
  - `WS_URL`
  - `AI_API_URL` (**optional**: dedicated base URL for AI, e.g. streaming-capable endpoint)
- `amplify_outputs.web.json` / `amplify_outputs.json` (preferred for CDN + signer URLs)
- Code: `src/config/env.ts`

## AI streaming (SSE)

The app supports **streamed AI responses** for:

- **AI summary** (`/ai/summary`)
- **AI helper** (`/ai/helper`)

How it works:

- If the server responds with `Content-Type: text/event-stream`, the UI progressively updates using SSE parsing.
- On **native** (iOS/Android), streaming uses `expo/fetch` (standard `fetch` often doesn’t expose a readable stream on React Native).
- On **web**, standard `fetch` is used.

Backend note:

- Streaming requires wiring the backend handler behind a **streaming-capable integration** (see `backend/README.md` and `backend/aws/src/handlers/README.md`).
- If your main `API_URL` is an API Gateway HTTP API (buffered), set `AI_API_URL` to the streaming base URL.

## Attachments + native file viewer

Attachments can be opened with the OS viewer/share sheet using `src/utils/openExternalFile.ts`.

- **Web**: opens in a new tab (optionally gated by a confirmation modal).
- **Android**: prefers a proper `VIEW` intent (via `expo-intent-launcher`) with a `content://` URI when possible.
- **iOS**: falls back to the share/open sheet (via `expo-sharing`) for good “Open in…” UX.

The app also guesses common MIME types from filename (PDF, Office docs, archives, audio/video/images, etc.) to improve viewer selection.

## Local UI caches (AsyncStorage)

To reduce “flash of unknown” and speed up cold starts, the app caches some UI-hydration state in **AsyncStorage**, including:

- Display name (device hint)
- Avatar settings (per signed-in user)
- Channel name labels for fast header hydration
- “Last opened” DM/channel conversation IDs

## Testing (Jest)

Jest is configured with `jest-expo`:

- Config: `jest.config.js`
- Setup: `jest.setup.ts`

Run:

```bash
npm test
```

## License

MIT (see root `LICENSE`).
