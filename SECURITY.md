# Security

## Deployment model

The Vercel version is a static application. Each visitor supplies their own Gemini key. Public builds do not load local `.env` files or call the private Mac server. Only compiled `dist-public` files are deployed.

Visitor keys stay in memory unless the visitor explicitly chooses tab session storage. Keys are not part of notes, exports, URLs, or diagnostic logs. A key is sent directly to Google in a request header, along with notes when generating a diagram. Browser extensions, a compromised device, or code served by a compromised site can read browser-held credentials; visitors must trust the site and their browser. Disconnect after using a shared device.

Hosted notes are browser-local. There is no authentication, cloud database, tenant account boundary, or shared server workspace. A shared browser profile shares its notes. This is not an encrypted cloud document service.

The optional private Node server binds to loopback, validates request origins/hosts, limits request sizes, and stores data locally. It is not intended to be exposed as an internet multi-user backend.

## Checks before the initial upload

- npm’s advisory database reported zero known vulnerabilities for both the complete dependency tree and runtime dependencies on 29 October 2026.
- The configured local credential was compared in memory against publication files and generated assets. No match was found outside its private `.env` file.
- The initial commit is scanned for credential patterns before push. Only explicitly reviewed source, documentation, configuration, tests, and the sample preview are included.
- Automated tests cover schema validation, escaped SVG text, pinned Google requests, header-only credentials, sanitized errors/diagnostics, optional key storage, origin restrictions, public build files, and diagram interactions.

These are point-in-time checks, not a penetration test or a guarantee against all vulnerabilities. Dependency advisories and provider behavior can change.

## Reporting a problem

Do not put API keys, passwords, private notes, or private diagnostic output in public issues. Use GitHub’s private vulnerability reporting feature if it is enabled for this repository. If it is unavailable, contact the repository owner through an existing private channel with a minimal reproduction and no live credentials. Never submit a real key to demonstrate exposure.

If a real key is accidentally committed, revoke it with its provider and remove it from history before publishing again. Removing the file from the latest commit alone does not remove earlier exposure.
