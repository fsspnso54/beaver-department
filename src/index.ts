import { serve } from "@hono/node-server";
import { registerSnapHandler } from "@farcaster/snap-hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile } from "node:fs/promises";
import path from "node:path";

const app = new Hono();

const SNAP_MEDIA_TYPE = "application/vnd.farcaster.snap+json";
const DEFAULT_BASE_URL = "http://localhost:3003";
const DEFAULT_SIGNAL = 284;
const SNAP_LINK_HEADER = `</>; rel="alternate"; type="${SNAP_MEDIA_TYPE}"`;
const SHARE_TEXT = "financial advice? no.\nbeaver advice? yes. 🦫";

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
    "Access-Control-Max-Age": "86400"
  };
}

function snapHeaders() {
  return {
    ...corsHeaders(),
    "Content-Type": SNAP_MEDIA_TYPE,
    "Cache-Control": "no-store",
    Vary: "Accept",
    Link: SNAP_LINK_HEADER
  };
}

function htmlHeaders() {
  return {
    ...corsHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    Vary: "Accept",
    Link: SNAP_LINK_HEADER
  };
}

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Accept", "Content-Type", "Authorization"],
    maxAge: 86400
  })
);

app.options("*", () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
});

function makeSignalId(ctx: any): number {
  const fid = Number(ctx?.action?.user?.fid ?? 0);

  if (Number.isFinite(fid) && fid > 0) {
    return 100 + ((fid * 97) % 9000);
  }

  return DEFAULT_SIGNAL;
}

function readSignalFromUrl(url: URL): number {
  const raw = Number(url.searchParams.get("signal") || "");

  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  return DEFAULT_SIGNAL;
}

function composeSnapUrl(baseUrl: string, stage: "loading" | "locked", signal: number): string {
  return `${baseUrl}/?stage=${stage}&signal=${signal}`;
}

function introPage(baseUrl: string): any {
  return {
    version: "2.0",
    theme: {
      accent: "red"
    },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {
            gap: "lg",
            justify: "center"
          },
          children: ["title", "subtitle", "activate"]
        },
        title: {
          type: "text",
          props: {
            content: "the prosperity beaver\nhas chosen you",
            weight: "bold",
            align: "center"
          }
        },
        subtitle: {
          type: "text",
          props: {
            content: "press carefully. the beaver is watching.",
            size: "sm",
            align: "center"
          }
        },
        activate: {
          type: "button",
          props: {
            label: "ACTIVATE",
            variant: "primary",
            icon: "zap"
          },
          on: {
            press: {
              action: "submit",
              params: {
                target: `${baseUrl}/?action=activate`
              }
            }
          }
        }
      }
    }
  };
}

function loadingPage(baseUrl: string, signal: number): any {
  return {
    version: "2.0",
    theme: {
      accent: "red"
    },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {
            gap: "sm"
          },
          children: ["image", "signal", "caption", "seal"]
        },
        image: {
          type: "image",
          props: {
            url: `${baseUrl}/assets/beaver-loading.jpg`,
            aspect: "1:1",
            alt: "Cute beaver with the text your money aura is loading"
          }
        },
        signal: {
          type: "badge",
          props: {
            label: `Beaver Signal #${signal}`,
            color: "amber",
            icon: "zap"
          }
        },
        caption: {
          type: "text",
          props: {
            content: "wallet vibes improving ✨",
            size: "sm",
            align: "center"
          }
        },
        seal: {
          type: "button",
          props: {
            label: "SEAL THE VIBE",
            variant: "primary",
            icon: "check"
          },
          on: {
            press: {
              action: "submit",
              params: {
                target: `${baseUrl}/?action=seal&signal=${signal}`
              }
            }
          }
        }
      }
    }
  };
}

function lockedPage(baseUrl: string, signal: number): any {
  const snapUrl = composeSnapUrl(baseUrl, "locked", signal);

  return {
    version: "2.0",
    theme: {
      accent: "green"
    },
    effects: ["confetti"],
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {
            gap: "sm"
          },
          children: ["image", "title", "signal", "share", "footer"]
        },
        image: {
          type: "image",
          props: {
            url: `${baseUrl}/assets/beaver-locked.jpg`,
            aspect: "1:1",
            alt: "Crowned beaver with a locked in stamp"
          }
        },
        title: {
          type: "text",
          props: {
            content: "prosperity unlocked",
            weight: "bold",
            align: "center"
          }
        },
        signal: {
          type: "badge",
          props: {
            label: `Beaver Signal #${signal}`,
            color: "green",
            icon: "trophy"
          }
        },
        share: {
          type: "button",
          props: {
            label: "PASS IT ON ♡",
            variant: "primary",
            icon: "share"
          },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: SHARE_TEXT,
                embeds: [snapUrl]
              }
            }
          }
        },
        footer: {
          type: "text",
          props: {
            content: "beaver department by @a1",
            size: "sm",
            align: "center"
          }
        }
      }
    }
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

      a { color: #dc2626; }
      code { background: #fafafa; padding: 2px 6px; border-radius: 6px; }
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
  const signal = readSignalFromUrl(url);

  if (stage === "loading") {
    return loadingPage(baseUrl, signal);
  }

  if (stage === "locked") {
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
      headers: snapHeaders()
    });
  }

  return new Response(htmlPage(), {
    status: 200,
    headers: htmlHeaders()
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
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
});

app.get("/health", (c) => {
  return c.json(
    {
      ok: true,
      name: "prosperity-beaver-snap"
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
    const signal = makeSignalId(ctx);
    return loadingPage(baseUrl, signal);
  }

  if (action === "seal") {
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
      headers: snapHeaders()
    });
  }

  return new Response(htmlPage(), {
    status: 200,
    headers: htmlHeaders()
  });
});

if (process.env.VERCEL !== "1") {
  const port = Number(process.env.PORT || 3003);

  serve({
    fetch: app.fetch,
    port
  });

  console.log(`Prosperity Beaver Snap running at http://localhost:${port}`);
}

export default app;
