# IPH Careers — Public Site

A self-contained public careers page — `index.html` + `styles.css` + `app.js`. No build step,
no dependencies, no CDN (so it works under the backend's security policy and on any static host).
It talks to the HR backend's **public API** (`/api/public`) to list open roles and accept applications.

## Configure

Edit the `CONFIG` block at the top of `app.js`:

| Key | What it is |
|-----|-----------|
| `API_BASE` | URL of the backend public API. Local (served from the backend): `/api/public` works as-is. For a separate careers subdomain: `https://<your-api-domain>/api/public` |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile **site** key. Leave `''` to disable the captcha. Must be paired with `TURNSTILE_SECRET` on the server. |
| `COMPANY` | Company name shown in the header/footer. |

## Run locally

The backend already serves this folder for convenience:

```
http://localhost:5001/careers/
```

(You can also just open `index.html` directly in a browser.)

To see roles appear, a **HIRE requisition must be fully approved** in the HR system — that
auto-publishes it here. When a position is marked filled, it disappears automatically.

## Deploy (production)

1. Host these files on the careers subdomain (e.g. `careers.iph-ly.com`) — any static host works
   (Netlify, Cloudflare Pages, S3 + CloudFront, or the same server).
2. Set `API_BASE` to your public backend URL.
3. On the **server**, set `CAREERS_ORIGIN=https://careers.iph-ly.com` so CORS allows only this site,
   and (recommended) set `TURNSTILE_SECRET` + `TURNSTILE_SITE_KEY` here to enable the captcha.
