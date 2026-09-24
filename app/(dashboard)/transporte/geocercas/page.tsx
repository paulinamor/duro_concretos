"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Circle, Download, ExternalLink, Hexagon,
  Link2, Link2Off, MapPin, RefreshCw, Search, X,
} from "lucide-react";
import { upsertDocument, getCollectionDocs, COLLECTIONS } from "@/lib/db";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SamsaraAddress {
  id: string;
  name: string;
  formattedAddress?: string;
  createdAtTime?: string;
  latitude?: number;
  longitude?: number;
  tags?: { id: string; name: string }[];
  geofence?: {
    circle?:  { latitude: number; longitude: number; radiusMeters: number };
    polygon?: { vertices: { latitude: number; longitude: number }[] };
  };
}

interface Obra {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string;
  samsaraAddressId?: string;
  samsaraLat?: number;
  samsaraLng?: number;
  samsaraRadiusM?: number;
}

// ─── Google Maps ──────────────────────────────────────────────────────────────

let mapsApiInit = false;
type GMap    = google.maps.Map;
type GShape  = google.maps.Circle | google.maps.Polygon;
type GMarker = google.maps.Marker;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centroid(verts: { latitude: number; longitude: number }[]) {
  return {
    lat: verts.reduce((s, v) => s + v.latitude,  0) / verts.length,
    lng: verts.reduce((s, v) => s + v.longitude, 0) / verts.length,
  };
}
function geocercaCenter(g: SamsaraAddress) {
  if (g.geofence?.circle)  return { lat: g.geofence.circle.latitude,  lng: g.geofence.circle.longitude };
  if (g.geofence?.polygon) return centroid(g.geofence.polygon.vertices);
  if (g.latitude && g.longitude) return { lat: g.latitude, lng: g.longitude };
  return null;
}
function fmtRadius(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function exportCSV(geofences: SamsaraAddress[], obrasMap: Map<string, Obra>) {
  const rows = [
    ["ID Samsara","Nombre","Dirección","Tipo","Lat","Lng","Radio (m)","Tags","Obra Vinculada","Cliente"],
    ...geofences.map((g) => {
      const center = geocercaCenter(g);
      const obra   = obrasMap.get(g.id);
      return [g.id, g.name, g.formattedAddress ?? "",
        g.geofence?.circle ? "Círculo" : "Polígono",
        center?.lat ?? "", center?.lng ?? "",
        g.geofence?.circle?.radiusMeters ?? "",
        (g.tags ?? []).map((t) => t.name).join("; "),
        obra?.nombre ?? "", obra?.cliente ?? ""];
    }),
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")], { type: "text/csv" }));
  a.download = `geocercas_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// Estilos de shape
const S_DEFAULT  = { fillColor: "#6366f1", strokeColor: "#6366f1", fillOpacity: 0.08, strokeOpacity: 0.5,  strokeWeight: 1.5 };
const S_LINKED   = { fillColor: "#16a34a", strokeColor: "#16a34a", fillOpacity: 0.10, strokeOpacity: 0.7,  strokeWeight: 1.5 };
const S_SELECTED = { fillColor: "#CC2229", strokeColor: "#CC2229", fillOpacity: 0.15, strokeOpacity: 1,    strokeWeight: 2.5 };

// SVGs
function dotSvg(color: string) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`
  );
}
function labelSvg(color: string, label: string) {
  const w = Math.max(label.length * 6.2 + 24, 40);
  const h = 22;
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + 8}">
    <rect x="0" y="0" width="${w}" height="${h}" rx="${h/2}" fill="${color}" opacity="0.95"/>
    <text x="${w/2}" y="${h*0.70}" text-anchor="middle" fill="white" font-size="10" font-weight="700"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${esc(label)}</text>
    <path d="M${w/2-5} ${h} L${w/2} ${h+7} L${w/2+5} ${h} Z" fill="${color}" opacity="0.95"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function GeocercasPage() {
  const [geofences, setGeofences] = useState<SamsaraAddress[]>([]);
  const [obras,     setObras]     = useState<Obra[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<SamsaraAddress | null>(null);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"todos"|"circulo"|"poligono"|"vinculadas"|"sin-vincular">("todos");

  // Modal vincular
  const [showLink,    setShowLink]    = useState(false);
  const [linkSearch,  setLinkSearch]  = useState("");
  const [linkSaving,  setLinkSaving]  = useState(false);
  const [pendingObra, setPendingObra] = useState("");

  // Map
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<GMap | null>(null);
  const shapesRef  = useRef<Map<string, GShape>>(new Map());
  const markersRef = useRef<Map<string, GMarker>>(new Map());

  // reverse map: samsaraAddressId → Obra
  const obrasById = useMemo(() => {
    const m = new Map<string, Obra>();
    for (const o of obras) if (o.samsaraAddressId) m.set(o.samsaraAddressId, o);
    return m;
  }, [obras]);

  // ── Carga ────────────────────────────────────────────────────────────────────
  const loadGeofences = async () => {
    setLoading(true); setError(null);
    try {
      const all: SamsaraAddress[] = [];
      let cursor: string | null = null;
      do {
        const qs = cursor
          ? `/api/samsara?endpoint=%2Faddresses&after=${cursor}&limit=512`
          : `/api/samsara?endpoint=%2Faddresses&limit=512`;
        const res  = await fetch(qs);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data?: SamsaraAddress[]; pagination?: { endCursor?: string; hasNextPage?: boolean } };
        all.push(...(json.data ?? []));
        cursor = json.pagination?.hasNextPage ? (json.pagination.endCursor ?? null) : null;
      } while (cursor);
      setGeofences(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const loadObras = async () => {
    const docs = await getCollectionDocs<Obra>(COLLECTIONS.obras);
    setObras(docs);
  };

  useEffect(() => { void loadGeofences(); void loadObras(); }, []);

  // ── Init mapa ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !mapDivRef.current || mapRef.current) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    import("@googlemaps/js-api-loader").then(({ setOptions, importLibrary }) => {
      if (!mapsApiInit) { setOptions({ key }); mapsApiInit = true; }
      importLibrary("maps").then(() => {
        if (!mapDivRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: { lat: 25.55, lng: -100.05 },
          zoom: 10,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          mapTypeControl: true,
          mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
          fullscreenControl: false,
          styles: [
            { featureType: "poi",          elementType: "labels",   stylers: [{ visibility: "off" }] },
            { featureType: "poi.business", elementType: "all",      stylers: [{ visibility: "off" }] },
            { featureType: "transit",      elementType: "labels",   stylers: [{ visibility: "off" }] },
            { featureType: "road",         elementType: "geometry", stylers: [{ color: "#f3f4f6" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e5e7eb" }] },
            { featureType: "water",        elementType: "geometry", stylers: [{ color: "#bfdbfe" }] },
            { featureType: "landscape",    elementType: "geometry", stylers: [{ color: "#f9fafb" }] },
          ],
        });
      });
    });
  }, []);

  // ── Dibujar shapes al cargar ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || geofences.length === 0) return;
    shapesRef.current.forEach((s) => s.setMap(null));
    markersRef.current.forEach((m) => m.setMap(null));
    shapesRef.current.clear();
    markersRef.current.clear();
    const map = mapRef.current;

    for (const g of geofences) {
      const isLinked = obrasById.has(g.id);
      const style = isLinked ? S_LINKED : S_DEFAULT;
      if (g.geofence?.circle) {
        const c = g.geofence.circle;
        const shape = new google.maps.Circle({ map, center: { lat: c.latitude, lng: c.longitude }, radius: c.radiusMeters, ...style, clickable: true });
        shape.addListener("click", () => selectG(g));
        shapesRef.current.set(g.id, shape);
      } else if (g.geofence?.polygon) {
        const shape = new google.maps.Polygon({ map, paths: g.geofence.polygon.vertices.map((v) => ({ lat: v.latitude, lng: v.longitude })), ...style, clickable: true });
        shape.addListener("click", () => selectG(g));
        shapesRef.current.set(g.id, shape);
      }
      const center = geocercaCenter(g);
      if (center) {
        const color = isLinked ? "#16a34a" : "#6366f1";
        const marker = new google.maps.Marker({ map, position: center, title: g.name, icon: { url: dotSvg(color), anchor: new google.maps.Point(6, 6) } });
        marker.addListener("click", () => selectG(g));
        markersRef.current.set(g.id, marker);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geofences, obrasById]);

  // ── Actualizar estilos al cambiar selección ───────────────────────────────────
  useEffect(() => {
    shapesRef.current.forEach((shape, id) => {
      const isSelected = selected?.id === id;
      const isLinked   = obrasById.has(id);
      shape.setOptions(isSelected ? S_SELECTED : isLinked ? S_LINKED : S_DEFAULT);
    });
    markersRef.current.forEach((marker, id) => {
      const isSelected = selected?.id === id;
      const isLinked   = obrasById.has(id);
      const color = isSelected ? "#CC2229" : isLinked ? "#16a34a" : "#6366f1";
      if (isSelected) {
        const g = geofences.find((x) => x.id === id);
        const lbl = g ? (g.name.length > 22 ? g.name.slice(0, 20) + "…" : g.name) : "";
        marker.setIcon({ url: labelSvg(color, lbl), anchor: new google.maps.Point(Math.max(lbl.length * 6.2 + 24, 40) / 2, 30) });
        marker.setZIndex(100);
      } else {
        marker.setIcon({ url: dotSvg(color), anchor: new google.maps.Point(6, 6) });
        marker.setZIndex(1);
      }
    });
    if (selected && mapRef.current) {
      const pad = 100;
      if (selected.geofence?.circle) {
        const c = selected.geofence.circle;
        const tmp = new google.maps.Circle({ center: { lat: c.latitude, lng: c.longitude }, radius: Math.max(c.radiusMeters * 2.5, 300) });
        const b = tmp.getBounds();
        if (b) mapRef.current.fitBounds(b, pad);
      } else if (selected.geofence?.polygon) {
        const b = new google.maps.LatLngBounds();
        selected.geofence.polygon.vertices.forEach((v) => b.extend({ lat: v.latitude, lng: v.longitude }));
        mapRef.current.fitBounds(b, pad);
      } else {
        const c = geocercaCenter(selected);
        if (c) { mapRef.current.setCenter(c); mapRef.current.setZoom(16); }
      }
    }
  }, [selected, geofences, obrasById]);

  // ── Filtrado ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => geofences.filter((g) => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.formattedAddress?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "circulo"      && !g.geofence?.circle)  return false;
    if (filter === "poligono"     && !g.geofence?.polygon) return false;
    if (filter === "vinculadas"   && !obrasById.has(g.id)) return false;
    if (filter === "sin-vincular" &&  obrasById.has(g.id)) return false;
    return true;
  }), [geofences, search, filter, obrasById]);

  // ── Acciones ──────────────────────────────────────────────────────────────────
  const selectG = (g: SamsaraAddress) => setSelected((p) => (p?.id === g.id ? null : g));

  const openLinkModal = () => {
    const current = selected ? obrasById.get(selected.id) : undefined;
    setPendingObra(current?.id ?? "");
    setLinkSearch("");
    setShowLink(true);
  };

  const saveLink = async () => {
    if (!selected) return;
    setLinkSaving(true);
    try {
      const center = geocercaCenter(selected);
      if (pendingObra) {
        const obra = obras.find((o) => o.id === pendingObra);
        if (obra) await upsertDocument(COLLECTIONS.obras, pendingObra, { ...obra, samsaraAddressId: selected.id, samsaraLat: center?.lat, samsaraLng: center?.lng, samsaraRadiusM: selected.geofence?.circle?.radiusMeters });
        const prev = obrasById.get(selected.id);
        if (prev && prev.id !== pendingObra) await upsertDocument(COLLECTIONS.obras, prev.id, { ...prev, samsaraAddressId: undefined, samsaraLat: undefined, samsaraLng: undefined, samsaraRadiusM: undefined });
      } else {
        const prev = obrasById.get(selected.id);
        if (prev) await upsertDocument(COLLECTIONS.obras, prev.id, { ...prev, samsaraAddressId: undefined, samsaraLat: undefined, samsaraLng: undefined, samsaraRadiusM: undefined });
      }
      await loadObras();
      setShowLink(false);
    } finally { setLinkSaving(false); }
  };

  const desvincular = async (obra: Obra) => {
    await upsertDocument(COLLECTIONS.obras, obra.id, { ...obra, samsaraAddressId: undefined, samsaraLat: undefined, samsaraLng: undefined, samsaraRadiusM: undefined });
    await loadObras();
  };

  const circles    = geofences.filter((g) => !!g.geofence?.circle).length;
  const polygons   = geofences.filter((g) => !!g.geofence?.polygon).length;
  const vinculadas = geofences.filter((g) => obrasById.has(g.id)).length;
  const selectedObra = selected ? obrasById.get(selected.id) : undefined;

  const obrasFiltered = useMemo(() => {
    const q = linkSearch.toLowerCase();
    return obras
      .filter((o) => !q || o.nombre.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q))
      .sort((a, b) => a.cliente.localeCompare(b.cliente, "es") || a.nombre.localeCompare(b.nombre, "es"));
  }, [obras, linkSearch]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Contenedor principal idéntico a flota-en-vivo ── */}
      <div
        className="relative flex rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm mx-4 mb-4"
        style={{ height: "calc(100vh - 96px)" }}
      >
        {/* ── Sidebar izquierdo ─────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 overflow-hidden bg-white">

          {/* Header sidebar */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-sm font-bold text-slate-900">Geocercas</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">Lugares Samsara</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => exportCSV(geofences, obrasById)} disabled={geofences.length === 0} title="Exportar CSV"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-40 transition-colors">
                  <Download size={12} />
                </button>
                <button onClick={() => { void loadGeofences(); void loadObras(); }} disabled={loading} title="Actualizar"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-40 transition-colors">
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* KPIs compactos */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: "Total",      value: geofences.length,  color: "text-slate-900" },
                { label: "Círculos",   value: circles,           color: "text-blue-600"  },
                { label: "Polígonos",  value: polygons,          color: "text-violet-600"},
                { label: "Vinculadas", value: vinculadas,        color: "text-emerald-600"},
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                  <p className={`text-base font-bold leading-none ${color}`}>{loading ? "—" : value}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Búsqueda */}
            <div className="relative mt-3">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar geocerca…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#CC2229]/30" />
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-1 mt-2">
              {([["todos","Todos"],["circulo","Círculo"],["poligono","Polígono"],["vinculadas","Vinculadas"],["sin-vincular","Sin vincular"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer border ${filter === val ? "bg-[#CC2229] border-[#CC2229] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">{filtered.length} de {geofences.length} geocercas</p>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-slate-50">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 space-y-1.5">
                    <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2.5 w-full bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="m-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 text-center">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">Sin resultados</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map((g) => {
                  const isCircle   = !!g.geofence?.circle;
                  const isSelected = selected?.id === g.id;
                  const obra       = obrasById.get(g.id);
                  return (
                    <button key={g.id} onClick={() => selectG(g)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer ${isSelected ? "bg-[#CC2229]/5 border-l-2 border-l-[#CC2229]" : "hover:bg-slate-50 border-l-2 border-l-transparent"}`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isCircle ? "bg-blue-50" : "bg-violet-50"}`}>
                          {isCircle ? <Circle size={12} className="text-blue-500" /> : <Hexagon size={12} className="text-violet-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-[#CC2229]" : "text-slate-900"}`}>{g.name}</p>
                          {g.formattedAddress && <p className="text-[10px] text-slate-500 truncate mt-0.5">{g.formattedAddress}</p>}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {isCircle ? (
                              <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5">
                                ⊙ {fmtRadius(g.geofence!.circle!.radiusMeters)}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-violet-50 text-violet-600 border border-violet-100 rounded px-1.5 py-0.5">
                                ⬡ {g.geofence?.polygon?.vertices.length}v
                              </span>
                            )}
                            {obra ? (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 flex items-center gap-0.5 truncate max-w-[120px]">
                                <Link2 size={8} />{obra.nombre}
                              </span>
                            ) : <span className="text-[9px] text-slate-300">Sin vincular</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Leyenda footer */}
          <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 bg-slate-50">
            <div className="flex items-center justify-around">
              {[["#6366f1","Sin vincular"],["#16a34a","Vinculada"],["#CC2229","Seleccionada"]].map(([color, lbl]) => (
                <div key={lbl} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[9px] text-slate-500">{lbl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Área del mapa (flex-1 igual que flota-en-vivo) ─────── */}
        <div className="flex-1 min-w-0 relative">
          <div ref={mapDivRef} className="absolute inset-0" />

          {/* Panel de detalle flotante — bottom right */}
          {selected && (
            <div className="absolute bottom-4 right-4 z-[500] w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${selected.geofence?.circle ? "bg-blue-50" : "bg-violet-50"}`}>
                    {selected.geofence?.circle ? <Circle size={15} className="text-blue-500" /> : <Hexagon size={15} className="text-violet-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{selected.name}</p>
                    {selected.formattedAddress && <p className="text-[10px] text-slate-500 truncate mt-0.5">{selected.formattedAddress}</p>}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 mt-0.5"><X size={14} /></button>
              </div>

              {/* Stats */}
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Tipo</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{selected.geofence?.circle ? "Círculo" : "Polígono"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{selected.geofence?.circle ? "Radio" : "Vértices"}</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {selected.geofence?.circle ? fmtRadius(selected.geofence.circle.radiusMeters) : `${selected.geofence?.polygon?.vertices.length ?? 0}p`}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Creado</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{formatDate(selected.createdAtTime)}</p>
                </div>
              </div>

              {/* Coordenadas */}
              {geocercaCenter(selected) && (
                <div className="px-4 pb-2">
                  <a href={`https://www.google.com/maps?q=${geocercaCenter(selected)!.lat},${geocercaCenter(selected)!.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-[#CC2229] transition-colors group">
                    <MapPin size={10} className="text-slate-400" />
                    {geocercaCenter(selected)!.lat.toFixed(6)}, {geocercaCenter(selected)!.lng.toFixed(6)}
                    <ExternalLink size={9} className="opacity-0 group-hover:opacity-100" />
                  </a>
                </div>
              )}

              {/* Obra vinculada */}
              <div className="px-4 py-3 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide mb-1.5">Obra vinculada</p>
                {selectedObra ? (
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{selectedObra.nombre}</p>
                      <p className="text-[10px] text-slate-500 truncate">{selectedObra.cliente}</p>
                    </div>
                  </div>
                ) : <p className="text-xs text-slate-400">Sin vincular</p>}
              </div>

              {/* Acciones */}
              <div className="px-4 pb-4 flex gap-2">
                {selectedObra && (
                  <button onClick={() => void desvincular(selectedObra)}
                    className="flex items-center gap-1 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer">
                    <Link2Off size={11} /> Desvincular
                  </button>
                )}
                <button onClick={openLinkModal}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#CC2229] hover:bg-[#aa1a20] text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer">
                  <Link2 size={11} />
                  {selectedObra ? "Cambiar" : "Vincular a obra"}
                </button>
              </div>
            </div>
          )}

          {/* Instrucción cuando nada está seleccionado */}
          {!selected && !loading && geofences.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500]">
              <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2 shadow-sm text-xs text-slate-500">
                Haz clic en una geocerca para ver su detalle
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal vincular ──────────────────────────────────────────── */}
      {showLink && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Vincular a obra</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[300px]">{selected?.name}</p>
              </div>
              <button onClick={() => setShowLink(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input autoFocus value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Buscar obra o cliente…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#CC2229]/30" />
              </div>
            </div>

            <div className="px-5 py-2 border-b border-slate-100">
              <button onClick={() => setPendingObra("")}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2 ${pendingObra === "" ? "bg-slate-100 text-slate-700 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
                <Link2Off size={12} /> Sin vincular (desvincular)
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-0.5">
              {obrasFiltered.map((obra) => (
                <button key={obra.id} onClick={() => setPendingObra(obra.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${pendingObra === obra.id ? "bg-[#CC2229]/5 border border-[#CC2229]/25" : "hover:bg-slate-50 border border-transparent"}`}>
                  <p className={`text-xs font-semibold ${pendingObra === obra.id ? "text-[#CC2229]" : "text-slate-900"}`}>{obra.nombre}</p>
                  <p className="text-[10px] text-slate-500">{obra.cliente}</p>
                  {obra.samsaraAddressId && obra.samsaraAddressId !== selected?.id && (
                    <p className="text-[9px] text-amber-600 mt-0.5 flex items-center gap-1"><Link2 size={8} /> Ya vinculada a otra geocerca</p>
                  )}
                </button>
              ))}
              {obrasFiltered.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin resultados</p>}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setShowLink(false)} className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer">Cancelar</button>
              <button onClick={() => void saveLink()} disabled={linkSaving}
                className="flex items-center gap-1.5 bg-[#CC2229] hover:bg-[#aa1a20] text-white rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                {linkSaving ? "Guardando…" : "Guardar vinculación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
