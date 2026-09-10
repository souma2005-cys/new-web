# Souma Deep Pal Portfolio

A responsive cybersecurity portfolio with a lightweight Node.js server and a protected admin panel.

## Run locally

Requirements: Node.js 18+.

### Linux / macOS

```bash
export ADMIN_PASSWORD='choose-a-strong-password'
node server.js
```

### Windows PowerShell

```powershell
$env:ADMIN_PASSWORD = 'choose-a-strong-password'
node server.js
```

Open:

- Portfolio: http://127.0.0.1:3000/
- Admin: http://127.0.0.1:3000/admin

## What is fixed

- Admin data is server-side in `data.json`; it is no longer stored in browser `localStorage`.
- The old hard-coded `admin123` fallback has been removed.
- Login uses an expiring HttpOnly, SameSite session cookie.
- Login attempts are rate-limited in memory.
- Certificate images are stored on disk instead of as giant base64 values in `localStorage`.
- Uploaded certificate images are limited to PNG/JPEG/WebP and 5 MB.
- Dynamic public/admin content is created with DOM APIs rather than injecting user-controlled HTML.
- Missing certificate files use an accessible placeholder instead of broken-image icons.
- Static-file path traversal is rejected and security headers are added.
- Mobile navigation, keyboard access, reduced-motion preferences, and modal focus behavior are improved.
- There is now one admin implementation rather than the previous duplicated admin logic.

## Notes

The supplied ZIP contained an empty `certs/` directory, so the portfolio cannot display the original certificate scans until those images are uploaded through the admin panel. The included placeholder prevents broken images in the meantime.

For production deployment, put the app behind HTTPS and a reverse proxy, set a strong `ADMIN_PASSWORD`, and restrict the admin route if desired.

### VS Code note
If you have the VS Code Live Server extension running, stop it before opening this app. This project uses its own Node server and defaults to port 3000, so Live Server is not required.
