import { serve } from "@hono/node-server";
import { registerSnapHandler } from "@farcaster/snap-hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile } from "node:fs/promises";
import path from "node:path";

const app = new Hono();

const SNAP_MEDIA_TYPE = "application/vnd.farcaster.snap+json";
const DEFAULT_BASE_URL = "http://localhost:3003";
const SNAP_LINK_HEADER = `</>; rel="alternate"; type="${SNAP_MEDIA_TYPE}"`;

const SHARE_TEXT = "financial advice? no.\nbeaver advice? yes. ";

const MINT_MINI_APP_URL =
  "https://farcaster.xyz/miniapps/pBigSB_B8nx8/beaver-department";

const ACTIVATION_COUNTER_KEY = "prosperity-beaver:activations";
const SEAL_COUNTER_KEY = "prosperity-beaver:seals";

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(
  /\/$/,
  ""
);

const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let localActivationCounter = 0;
let localSealCounter = 0;

function hasUpstash(): boolean {
  return Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand<T>(
  command: Array<string | number>
): Promise<T | null> {
  if (!hasUpstash()) {
    return null;
  }

  const commandPath = command
    .map((part) => encodeURIComponent(String(part)))
    .join("/");

  const response = await fetch(`${UPSTASH_REDIS_REST_URL}/${commandPath}`, {
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Upstash request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    result?: T;
    error?: string;
  };

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result ?? null;
}

async function incrementActivationCounter(): Promise<number> {
  if (hasUpstash()) {
    try {
      const result = await upstashCommand<number | string>([
        "INCR",
        ACTIVATION_COUNTER_KEY,
      ]);

      if (typeof result === "number") {
        return result;
      }

      if (typeof result === "string") {
        return Number(result);
      }
    } catch (error) {
      console.error("Failed to increment Upstash activation counter:", error);
    }
  }

  localActivationCounter += 1;
  return localActivationCounter;
}

async function incrementSealCounter(): Promise<number> {
  if (hasUpstash()) {
    try {
      const result = await upstashCommand<number | string>([
        "INCR",
        SEAL_COUNTER_KEY,
      ]);

      if (typeof result === "number") {
        return result;
      }

      if (typeof result === "string") {
        return Number(result);
      }
    } catch (error) {
      console.error("Failed to increment Upstash seal counter:", error);
    }
  }

  localSealCounter += 1;
  return localSealCounter;
}

async function readCounter(key: string, localValue: number): Promise<number> {
  if (hasUpstash()) {
    try {
      const result = await upstashCommand<string | number | null>(["GET", key]);

      if (typeof result === "number") {
        return result;
      }

      if (typeof result === "string") {
        return Number(result || 0);
      }
    } catch (error) {
      console.error(`Failed to read Upstash counter ${key}:`, error);
    }
  }

  return localValue;
}

function getBaseUrl(requestUrl?: string): string {
  const envBase = process.env.SNAP_PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (envBase) {
    return envBase;
  }

  if (requestUrl) {
    const url = new URL(requestUrl);
    return url.origin;
  }

  return DEFAULT_BASE_URL;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Accept,Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function snapHeaders() {
  return {
    ...corsHeaders(),
    "Content-Type": SNAP_MEDIA_TYPE,
    "Cache-Control": "no-store",
    Vary: "Accept",
    Link: SNAP_LINK_HEADER,
  };
}

function htmlHeaders() {
  return {
    ...corsHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    Vary: "Accept",
    Link: SNAP_LINK_HEADER,
  };
}

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Accept", "Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.options("*", () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
});

function readSignalFromUrl(url: URL): number {
  const raw = Number(url.searchParams.get("signal") || "");

  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  return 0;
}

function signalLabel(signal: number): string {
  if (signal > 0) {
    return `Beaver Signal #${signal}`;
  }

  return "Beaver Signal";
}

function introPage(baseUrl: string): any {
  return {
    version: "2.0",
    theme: {
      accent: "red",
    },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {
            gap: "lg",
            justify: "center",
          },
          children: ["title", "activate"],
        },
        title: {
          type: "text",
          props: {
            content: "the prosperity beaver\nhas chosen you",
            weight: "bold",
            align: "center",
          },
        },
        activate: {
          type: "button",
          props: {
            label: "ACTIVATE",
            variant: "primary",
            icon: "zap",
          },
          on: {
            press: {
              action: "submit",
              params: {
                target: `${baseUrl}/?action=activate`,
              },
            },
          },
        },
      },
    },
  };
}

function loadingPage(baseUrl: string, signal: number): any {
  return {
    version: "2.0",
    theme: {
      accent: "red",
    },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {
            gap: "sm",
            justify: "center",
          },
          children: ["image", "meta", "seal"],
        },
        image: {
          type: "image",
          props: {
            url: `${baseUrl}/assets/beaver-loading.jpg`,
            aspect: "1:1",
            alt: "Cute beaver with the text your money aura is loading",
          },
        },
        meta: {
          type: "stack",
          props: {
            gap: "none",
            justify: "center",
          },
          children: ["signal", "caption"],
        },
        signal: {
          type: "badge",
          props: {
            label: signalLabel(signal),
            color: "amber",
            icon: "zap",
          },
        },
        caption: {
          type: "text",
          props: {
            content: "wallet vibes improving ✨",
            size: "sm",
            align: "center",
          },
        },
        seal: {
          type: "button",
          props: {
            label: "SEAL THE VIBE",
            variant: "primary",
            icon: "check",
          },
          on: {
            press: {
              action: "submit",
              params: {
                target: `${baseUrl}/?action=seal&signal=${signal}`,
              },
            },
          },
        },
      },
    },
  };
}

function lockedPage(baseUrl: string, signal: number): any {
  return {
    version: "2.0",
    theme: {
      accent: "green",
    },
    effects: ["confetti"],
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {
            gap: "xs",
            justify: "center",
          },
          children: ["image", "share", "mint"],
        },
        image: {
          type: "image",
          props: {
            url: `${baseUrl}/assets/beaver-locked.jpg`,
            aspect: "1:1",
            alt: "Crowned beaver with a locked in stamp",
          },
        },
        share: {
          type: "button",
          props: {
            label: "PASS IT ON ♡",
            variant: "primary",
            icon: "share",
          },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: SHARE_TEXT,
                embeds: [baseUrl],
              },
            },
          },
        },
        mint: {
          type: "button",
          props: {
            label: "UNLOCK YOUR BEAVER",
            variant: "secondary",
            icon: "arrow-right",
          },
          on: {
            press: {
              action: "open_mini_app",
              params: {
                target: MINT_MINI_APP_URL,
              },
            },
          },
        },
      },
    },
  };
}

function htmlPage(): string {
  return `<!doctype html>

<html>
  <head>
    <meta charset="utf-8" />

    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <title>Prosperity Beaver Snap</title>

    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #fffdf8;
        color: #171717;
        font-family: Inter, Arial, sans-serif;
      }

      main {
        width: min(680px, calc(100vw - 40px));
        border: 1px solid #e7e5e4;
        border-radius: 24px;
        padding: 32px;
        background: white;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.06);
      }

      a {
        color: #dc2626;
      }

      code {
        background: #fafafa;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>

  <body>
    <main>
      <h1>Prosperity Beaver Snap</h1>

      <p>This URL serves a Farcaster Snap when requested with <code>Accept: application/vnd.farcaster.snap+json</code>.</p>

      <p>Try it in the Farcaster Snap Emulator.</p>
    </main>
  </body>
</html>`;
}

function pageForRequest(baseUrl: string, url: URL): any {
  const stage = url.searchParams.get("stage");

  if (stage === "locked") {
    const signal = readSignalFromUrl(url);
    return lockedPage(baseUrl, signal);
  }

  return introPage(baseUrl);
}

app.get("/", (c) => {
  const accept = c.req.header("Accept") || "";
  const baseUrl = getBaseUrl(c.req.url);
  const url = new URL(c.req.url);

  if (accept.includes(SNAP_MEDIA_TYPE)) {
    return new Response(JSON.stringify(pageForRequest(baseUrl, url)), {
      status: 200,
      headers: snapHeaders(),
    });
  }

  return new Response(htmlPage(), {
    status: 200,
    headers: htmlHeaders(),
  });
});

app.get("/assets/:filename", async (c) => {
  const filename = c.req.param("filename");
  const allowedFiles = new Set(["beaver-loading.jpg", "beaver-locked.jpg"]);

  if (!allowedFiles.has(filename)) {
    return c.text("Not found", 404, corsHeaders());
  }

  const filePath = path.join(process.cwd(), "public", "assets", filename);
  const image = await readFile(filePath);

  return new Response(new Uint8Array(image), {
    headers: {
      ...corsHeaders(),
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.get("/health", (c) => {
  return c.json(
    {
      ok: true,
      name: "prosperity-beaver-snap",
    },
    200,
    corsHeaders()
  );
});

app.get("/stats", async (c) => {
  const statsSecret = process.env.STATS_SECRET;

  if (statsSecret && c.req.query("secret") !== statsSecret) {
    return c.json(
      {
        error: "unauthorized",
      },
      401,
      corsHeaders()
    );
  }

  const activations = await readCounter(
    ACTIVATION_COUNTER_KEY,
    localActivationCounter
  );

  const seals = await readCounter(SEAL_COUNTER_KEY, localSealCounter);

  return c.json(
    {
      activations,
      seals,
      storage: hasUpstash() ? "upstash" : "memory",
      note: hasUpstash()
        ? "persistent counter is active"
        : "memory counter only; add Upstash env vars for persistence",
    },
    200,
    corsHeaders()
  );
});

registerSnapHandler(app, async (ctx: any): Promise<any> => {
  const baseUrl = getBaseUrl(ctx.request.url);
  const url = new URL(ctx.request.url);
  const action = url.searchParams.get("action");

  if (ctx.action.type === "get") {
    return pageForRequest(baseUrl, url);
  }

  if (action === "activate") {
    const signal = await incrementActivationCounter();
    return loadingPage(baseUrl, signal);
  }

  if (action === "seal") {
    await incrementSealCounter();
    const signal = readSignalFromUrl(url);
    return lockedPage(baseUrl, signal);
  }

  return introPage(baseUrl);
});

app.get("*", (c) => {
  const accept = c.req.header("Accept") || "";

  if (accept.includes(SNAP_MEDIA_TYPE)) {
    return new Response(JSON.stringify(introPage(getBaseUrl(c.req.url))), {
      status: 200,
      headers: snapHeaders(),
    });
  }

  return new Response(htmlPage(), {
    status: 200,
    headers: htmlHeaders(),
  });
});

if (process.env.VERCEL !== "1") {
  const port = Number(process.env.PORT || 3003);

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`Prosperity Beaver Snap running at http://localhost:${port}`);
}

export default app;
