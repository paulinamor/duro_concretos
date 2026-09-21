import { NextRequest, NextResponse } from "next/server";

const SAMSARA_BASE = "https://api.samsara.com";
const TOKEN = process.env.SAMSARA_API_TOKEN;

export async function GET(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: "SAMSARA_API_TOKEN no configurado" }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Falta el parámetro 'endpoint'" }, { status: 400 });

  // Reenvía parámetros extra (paginación, filtros, etc.)
  const params = new URLSearchParams();
  searchParams.forEach((v, k) => { if (k !== "endpoint") params.set(k, v); });
  const qs = params.toString();

  const url = `${SAMSARA_BASE}${endpoint}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });

  const text = await res.text();
  if (!text) return NextResponse.json({}, { status: res.status });
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
  return NextResponse.json(data);
}
