<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# MOUZIKETNA ⚡

A high-performance music streaming and offline player with synchronized lyrics, YouTube playlist import, and iOS-inspired design.

## 🚀 How to Publish to GitHub Pages (No Blank Screen)

This repository is pre-configured so that publishing to GitHub Pages works out-of-the-box without blank screen issues.

### Method 1: Automatic GitHub Actions (Recommended)
1. Push your repository to GitHub.
2. In your repository, go to **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish your site!

### Method 2: Deploy from Branch (`/docs` or `/root`)
1. Run `npm run build` locally before pushing to update the pre-built bundles in `/docs`, `/dist`, and `/assets`.
2. Push your changes to GitHub.
3. In your repository, go to **Settings** → **Pages**.
4. Under **Build and deployment** → **Source**, select **Deploy from a branch**.
5. Choose branch `main` (or `master`) and select either:
   - **`/docs`** (Recommended for branch deployment)
   - **`/(root)`** (Supported with automated bundle fallback)
6. Click **Save**. Your site will be live within seconds!

---

## 💻 Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
