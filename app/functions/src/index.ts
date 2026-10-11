import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "us-central1", maxInstances: 5 });

const DRAFT_BASE = "https://draft.premierleague.com/api";
const CLASSIC_BASE = "https://fantasy.premierleague.com/api";

const cache = new Map<string, { at: number; body: string }>();
const TTL_MS = 30_000;

export const fplProxy = onRequest({ cors: true }, async (req, res) => {
  const path = req.path.replace(/^\/api\//, "").replace(/^\/+/, "");

  // /classic/... → fantasy.premierleague.com/api/...
  // everything else → draft.premierleague.com/api/...
  const isClassic = path.startsWith("classic/");
  const upstreamPath = isClassic ? path.slice("classic/".length) : path;
  const base = isClassic ? CLASSIC_BASE : DRAFT_BASE;

  // classic endpoints require a trailing slash; draft is lenient
  const url = `${base}/${upstreamPath}${isClassic && !upstreamPath.endsWith("/") ? "/" : ""}`;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < TTL_MS) {
    res.set("x-cache", "hit").type("application/json").send(cached.body);
    return;
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });
    const body = await upstream.text();

    if (upstream.ok) {
      cache.set(url, { at: Date.now(), body });
      res.set("Cache-Control", "public, max-age=30, s-maxage=30");
    } else {
      res.set("Cache-Control", "no-store");
    }
    res.status(upstream.status).type("application/json").send(body);
  } catch {
    res.status(502).json({ error: "upstream_failed" });
  }
});