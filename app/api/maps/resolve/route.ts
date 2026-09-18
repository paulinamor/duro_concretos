import { NextResponse } from "next/server";

function extractCoords(url: string): { lat: number; lng: number } | null {
  // @lat,lng (Google Maps standard format)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // ?q=lat,lng or ?q=lat+lng (space-separated)
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+)[,+]\+?(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // ?ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

  // /maps/search/lat,lng
  const searchMatch = url.match(/\/maps\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (searchMatch) return { lat: parseFloat(searchMatch[1]), lng: parseFloat(searchMatch[2]) };

  // center=lat,lng (Maps Embed API style)
  const centerMatch = url.match(/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (centerMatch) return { lat: parseFloat(centerMatch[1]), lng: parseFloat(centerMatch[2]) };

  return null;
}

function extractPlaceName(url: string): string | null {
  const m = url.match(/\/maps\/place\/([^/@?&]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return null;
  }
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept:          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9",
  "Cache-Control": "no-cache",
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 });

  // ── 1. Direct extraction from original URL ───────────────────────────────────
  const direct = extractCoords(url);
  if (direct) return NextResponse.json({ finalUrl: url, coords: direct, placeName: extractPlaceName(url) });

  // ── 2–3. Manual redirect hops — read Location header without following ───────
  let currentUrl = url;
  for (let hop = 0; hop < 4; hop++) {
    try {
      const r = await fetch(currentUrl, {
        method:   "GET",
        redirect: "manual",
        signal:   AbortSignal.timeout(5000),
        headers:  HEADERS,
        cache:    "no-store",
      } as RequestInit);

      const location = r.headers.get("location") ?? r.headers.get("Location");
      if (!location) break;

      const coords = extractCoords(location);
      if (coords) {
        return NextResponse.json({ finalUrl: location, coords, placeName: extractPlaceName(location) });
      }
      currentUrl = location;
    } catch {
      break;
    }
  }

  // ── 4. Follow all redirects — read final URL and HTML body ──────────────────
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal:   AbortSignal.timeout(10000),
      headers:  HEADERS,
      cache:    "no-store",
    } as RequestInit);

    const finalUrl = res.url;
    const urlCoords = extractCoords(finalUrl);
    if (urlCoords) {
      return NextResponse.json({ finalUrl, coords: urlCoords, placeName: extractPlaceName(finalUrl) });
    }

    const html = await res.text();

    // Google embeds coordinates in several patterns in the HTML:
    // Pattern 1: [null,lat,lng] JSON arrays
    const jsonMatch = html.match(/\[null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/);
    if (jsonMatch) {
      return NextResponse.json({
        finalUrl,
        coords: { lat: parseFloat(jsonMatch[1]), lng: parseFloat(jsonMatch[2]) },
        placeName: extractPlaceName(finalUrl),
      });
    }

    // Pattern 2: "APP_INITIALIZATION_STATE" data arrays with coordinates
    const initMatch = html.match(/APP_INITIALIZATION_STATE[^[]*\[\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
    if (initMatch) {
      return NextResponse.json({
        finalUrl,
        coords: { lat: parseFloat(initMatch[1]), lng: parseFloat(initMatch[2]) },
        placeName: extractPlaceName(finalUrl),
      });
    }

    // Pattern 3: canonical URL with coordinates
    const canonMatch = html.match(/rel="canonical"[^>]*href="([^"]+)"/);
    if (canonMatch) {
      const c = extractCoords(canonMatch[1]);
      if (c) return NextResponse.json({ finalUrl, coords: c, placeName: extractPlaceName(canonMatch[1]) });
    }

    // Pattern 4: meta og:url
    const ogMatch = html.match(/property="og:url"[^>]*content="([^"]+)"/);
    if (ogMatch) {
      const c = extractCoords(ogMatch[1]);
      if (c) return NextResponse.json({ finalUrl, coords: c, placeName: extractPlaceName(ogMatch[1]) });
    }

    return NextResponse.json({ finalUrl, coords: null, placeName: extractPlaceName(finalUrl) });
  } catch {
    return NextResponse.json({ finalUrl: url, coords: null, placeName: null });
  }
}
