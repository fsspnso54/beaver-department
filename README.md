# Prosperity Beaver Snap

A tiny Farcaster Snap meme ritual:

```txt
ACTIVATE
→ your money aura is loading
→ SEAL THE VIBE
→ crowned beaver / LOCKED IN
→ PASS IT ON ♡
```

No mint, no contract, no Highlight. Just a shareable Farcaster Snap.

## Flow

### Screen 1

```txt
the prosperity beaver
has chosen you
```

Button:

```txt
ACTIVATE
```

### Screen 2

Image: `public/assets/beaver-loading.jpg`

```txt
Beaver Signal #{{id}}
wallet vibes improving ✨
```

Button:

```txt
SEAL THE VIBE
```

### Screen 3

Image: `public/assets/beaver-locked.jpg`

```txt
prosperity unlocked
Beaver Signal #{{id}}
```

Button:

```txt
PASS IT ON ♡
```

Footer:

```txt
beaver department by @a1
```

Share text:

```txt
financial advice? no.
beaver advice? yes. 🦫
```

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Local URL:

```txt
http://localhost:3003
```

Test Snap JSON:

```bash
curl -i -H 'Accept: application/vnd.farcaster.snap+json' http://localhost:3003/
```

Test health:

```bash
curl http://localhost:3003/health
```

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Add environment variable:

```txt
SNAP_PUBLIC_BASE_URL=https://your-project.vercel.app
```

No trailing slash.

4. Deploy.
5. Verify:

```bash
curl -i -H 'Accept: application/vnd.farcaster.snap+json' https://your-project.vercel.app/
```

Expected important headers:

```txt
HTTP/1.1 200 OK
Content-Type: application/vnd.farcaster.snap+json
Access-Control-Allow-Origin: *
Vary: Accept
Link: </>; rel="alternate"; type="application/vnd.farcaster.snap+json"
```

## Notes

- `Beaver Signal #{{id}}` is generated from the user's Farcaster FID when available.
- It is not a blockchain token ID and does not require a contract.
- To make it truly sequential, add persistent storage later.
