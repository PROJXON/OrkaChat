# Web portal deployment (Expo Web) on AWS

This repo’s web portal is an **Expo Web static export** from `frontend/`, and can be hosted on AWS using **Amplify Hosting** (recommended) or **S3 + CloudFront** (more DIY).

## Recommended: Amplify Hosting (default domain + CI/CD)

Amplify Hosting will provision and manage **S3 + CloudFront + HTTPS**, plus **auto-deploy on git pushes**.

### 1) Ensure the build works locally

From `frontend/`:

```bash
npm ci
npm run build:web
```

That should produce a static site in `frontend/dist/`.

### 2) Create an Amplify app (Hosting)

- In the AWS console, open **Amplify** → **Host web app**
- Connect your git provider (GitHub/CodeCommit/etc.)
- Choose the repository + branch
- Set **App root** to `frontend` (monorepo)
- Amplify will pick up the root `amplify.yml` build spec

### 2a) Amplify Gen 2 backend outputs (important)

This app loads `frontend/amplify_outputs.json` at runtime to configure Amplify Auth/Storage.
In CI, the `amplify.yml` runs `npx ampx pipeline-deploy` to deploy/update the Gen 2 backend for the branch and generate the outputs file automatically.

### 3) Add SPA rewrite (important)

Expo Web is typically a **single-page app**. In Amplify Hosting → **Rewrites and redirects**, add:

- Source: `</*>`
- Target: `/index.html`
- Type: `200 (Rewrite)`

This makes deep links work on refresh.

### 4) Domain name

You can use Amplify’s default domain until you have a real one. Later, add your custom domain in Amplify Hosting (Amplify will also manage the TLS cert).

## Alternative: S3 + CloudFront (+ CodePipeline)

Use this if you want maximum control or want to standardize on CodePipeline:

- Build: `npm run build:web` (outputs `frontend/dist/`)
- Upload `dist/` to an S3 bucket (static hosting)
- Put a CloudFront distribution in front
- Add a CloudFront behavior to rewrite `/*` → `/index.html` (SPA deep links)
- Use CodePipeline + CodeBuild to run the build and sync to S3 (then invalidate CloudFront)

Amplify Hosting is essentially this stack, managed for you.

