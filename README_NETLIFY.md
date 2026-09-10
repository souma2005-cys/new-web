# Netlify deployment

This project now supports both the local Node server and Netlify Functions.

## Netlify setup

Deploy the project root (the folder containing `index.html`, `admin.html`, `netlify.toml`, and `netlify/`). Netlify will automatically build the Functions from `netlify/functions`.

In Netlify: Project configuration -> Environment variables -> add `ADMIN_PASSWORD` with your desired admin password. Optionally add `ADMIN_SESSION_SECRET` with a long random secret. Environment variables used by Functions must be available to the Functions runtime, and changing them requires a new deploy. See Netlify's Functions environment-variable documentation.

The admin data and certificate images use Netlify Blobs so they persist across deploys. The app exposes the same browser API paths as the local server (`/api/portfolio`, `/api/admin/*`, and `/certs/*`).

Do not use VS Code Live Server for the production site; the Netlify site provides the Functions.
