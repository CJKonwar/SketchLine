# Deploy Sketchline on Vercel

Sketchline is configured to run on Vercel as a static Vite application. Every visitor brings their own Gemini key. No private Node server, application database, or shared Gemini key is required.

## What is included

- `vercel.json` selects the Vite preset, `npm ci`, `npm run build:public`, and the `dist-public` output folder. It also sets the browser security headers; Vercel does not rely on the separate `_headers` file.
- `.vercelignore` limits CLI uploads to the public build inputs and excludes credentials/private files. `.gitignore` excludes credentials, local data, generated files, and Vercel account-link metadata from Git.
- Node.js is pinned to **22.x** in the package and lockfile.
- Public builds do not load local `.env` files. A build check rejects missing assets, private output files, symbolic links, and recognizable credential patterns.
- The existing private Mac version is still available with `npm run dev`.

## Option 1: import from GitHub

1. Put the project source in a GitHub repository. You can use the project folder or extract **Sketchline-vercel-ready.zip** into a fresh folder. The ZIP contains sanitized source and deployment settings, with no private key, saved workspace, or installed dependencies.
2. In Vercel, create a new project and import that repository.
3. Set Root Directory to the folder containing **package.json** and **vercel.json**. If those files are at the repository root, leave Root Directory at its default.
4. Check these settings. The configuration file supplies the build settings automatically:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build:public` |
| Output Directory | `dist-public` |
| Node.js | 22.x |
| Environment Variables | None required |

5. Click Deploy. Open the HTTPS address Vercel returns. Visitors use **Add Gemini key** inside the app, then choose a model.

Use the source ZIP for this workflow. **Sketchline-public.zip** is the already compiled static website and is intended for hosts accepting built files; it is not the source repository for Vercel’s Vite build.

## Option 2: deploy this folder from Terminal

```sh
cd path/to/sketchline
npx vercel --prod
```

Sign in to your own Vercel account when prompted, choose the account/project, and use this folder as the project root. The checked-in configuration selects the public build. If deploying an extracted copy elsewhere, use that folder’s path instead.

The command creates a production deployment; it has not been run on your behalf. `vercel.json` is prepared, but no Vercel project or public URL has been created by this change.

## API keys

Do not add `GEMINI_API_KEY`, `OPENAI_API_KEY`, or any `VITE_...` API key variable to Vercel for this visitor-key version. No shared owner credential is needed. A visitor pastes their own key into the app’s key dialog. Model discovery and generation go directly from their browser to Google.

If a visitor’s Google key has website/referrer restrictions, its allowed websites must include the actual deployed domain. A Vercel preview URL and a custom production domain are different websites for that purpose. Model access and quota can still cause Google errors independently of whether the site deployed correctly.

## Where notes are saved

The hosted version stores notes in that browser/profile’s local storage. Visitors do not share a server workspace. There is no login or cloud synchronization. The local Mac’s `data/workspace.json` is not uploaded or copied into the public app. Export a Sketchline backup before clearing browser data or moving between devices/domains.

## Try the public version before deploying

```sh
npm ci
npm test
npm run build:public
npm run dev:public
```

Open the local address printed by Vite. This runs the public, browser-storage version even on localhost. The ordinary `npm run dev` runs the private Mac version instead. Do not run multiple copies on the same port.

## Check the deployed address

Open the production URL in a fresh browser/profile. Create a note, generate a local diagram, accept it, move a card/line, and reload to check saving. Then connect your own Gemini key, choose a model, and generate a short diagram. Confirm that Export works. If Google rejects a key restricted to another domain, update that key’s website restrictions in Google’s settings.

The published site serves compiled files and does not use the development WebSocket port 24678. If that port appears in a production browser error, check that Vercel’s output is `dist-public` and that the browser is opening the deployed HTTPS URL.

## Verification limits

The clean source build, tests, compiled assets, configuration schema, and public-output checks can be verified locally without an account. Vercel account linking, a hosted build, actual domain headers, and Google key restrictions for that domain must be verified after deployment. A successful local build is not a claim that an online deployment has already happened.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json), [upload exclusions](https://vercel.com/docs/deployments/vercel-ignore), and [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
