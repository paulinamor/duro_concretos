import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address param required" }, { status: 400 });

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Maps API key not configured" }, { status: 503 });

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}&region=mx&language=es`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json() as {
    status: string;
    results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
  };

  if (data.status !== "OK" || !data.results.length) {
    return NextResponse.json({ coords: null });
  }

  const { lat, lng } = data.results[0].geometry.location;
  return NextResponse.json({
    coords: { lat, lng },
    formattedAddress: data.results[0].formatted_address,
  });
}
