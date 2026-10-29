# Public version: bring your own Gemini key

The public version is a static website. It has no shared API key and no account database. Each visitor enters their own Google AI Studio key and pays any applicable Google API charges through their own Google project.

## Try it locally

From the project folder:

```sh
npm run build:public
python3 -m http.server 4320 --bind 127.0.0.1 --directory dist-public
```

Open http://127.0.0.1:4320. Use a different port if 4320 is already occupied. This is an isolated public-mode preview; it does not need the private Node server. Stop it with Control+C when finished. A plain local Python preview does not apply the supplied hosting security headers.

## Deploy on Vercel

Use the included `vercel.json` and follow [VERCEL.md](VERCEL.md). Import source with `npm run build:public` and output `dist-public`; no shared API key environment variable is required. The sanitized source archive is `Sketchline-vercel-ready.zip`.

## Other static hosts

1. Build with `npm run build:public` after changing the source.
2. Create an HTTPS static website on your chosen host.
3. Upload the **contents** of `dist-public/`, or upload `Sketchline-public.zip` if the host accepts a ZIP. `index.html` belongs at the published site root.
4. Preserve the `_headers` file on hosts that support that convention. Otherwise configure those same response headers in the host’s settings, including the Content Security Policy. The only external API connection required is `https://generativelanguage.googleapis.com`.
5. Open the public address in a fresh browser profile. Add a Gemini key, generate a small test diagram, accept it, move a card and line, and reload to check browser saving. Confirm the host supplies the intended headers.

Vercel build settings are configured in the project, but no hosting account or domain has been connected. The ZIP is prepared for publishing; creating a public URL is a separate deployment step. The private Node server remains restricted to this Mac and should not be exposed as a shared multi-user backend.

## Visitor workflow

- New note → type or paste notes → choose Flowchart or Mind map.
- Add Gemini key → paste key → Check and connect → choose Gemini model.
- Reopen Gemini connected to change the model. Refresh models reloads Google’s list. The model preference survives refreshes; the key still follows your separate Remember setting.
- Generate visual → choose one of ten layouts → Use this visual.
- Drag cards and connections, double-click labels, or use the property panel.
- Export a Sketchline backup for future editing; PNG is a flat image and SVG is vector artwork.

## Where keys and notes go

- A visitor key is kept in page memory by default. Refreshing clears it.
- The optional Remember checkbox stores it in that tab’s `sessionStorage`, surviving refreshes. Disconnect removes it. Browser session restoration can restore tab storage; use Disconnect on shared computers.
- Keys go in an `x-goog-api-key` request header directly to Google, never in the URL. Notes are also sent to Google for generation. The static host does not receive the key through an app endpoint.
- Keys are not included in saved diagrams, downloaded backups, or the distributed files. There is no app analytics or third-party script in the public build. Use a host you trust to serve the application code.
- Notes and visuals are saved in that browser’s local storage. Browsers or profiles have separate workspaces. People sharing one browser profile share its saved notes. Export before clearing browser data or moving devices.
- The picker shows Gemini text models returned by Google that support generateContent. A listed model may still reject generation because of model access, quota, or retirement.
- Google enforces model access, quotas, and billing. Sketchline does not impose an app subscription or promise unlimited Gemini requests.

## Current limits

The app supports flowcharts and mind maps, up to 40 nodes per visual and 16,000 source characters. The ten layouts rearrange the same data; they do not reproduce Napkin’s full illustration catalogue. There is no sign-in, cloud synchronization, shared editing, or real-time collaboration. The local text parser works without a key but interprets less than Gemini does. HTTP 503 or quota errors can still originate from Google.
