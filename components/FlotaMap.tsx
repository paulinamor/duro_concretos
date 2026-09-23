"use client";

import { useEffect, useRef } from "react";

export type VehicleLocation = {
  id:             string;
  name:           string;
  lat:            number;
  lng:            number;
  speedMph:       number;
  headingDegrees: number;
  address:        string;
  updatedAt:      string;
  engineState?:   "On" | "Off" | "Idle";
};

type Props = {
  vehicles:    VehicleLocation[];
  selectedId?: string | null;
  className?:  string;
};

const ENGINE_COLOR: Record<string, string> = {
  On:   "#22c55e",
  Idle: "#f59e0b",
  Off:  "#94a3b8",
};

const TRAIL_MAX = 50;

function bearingTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toR = (d: number) => d * Math.PI / 180;
  const dLon = toR(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toR(lat2));
  const x = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) -
            Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function escXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function markerSvgUrl(color: string, heading: number, moving: boolean, idle: boolean, name: string): string {
  const charW  = 6.2;
  const pillPx = 14;
  const pillW  = Math.max(name.length * charW + pillPx * 2, 32);
  const pillH  = 15;
  const gap    = 3;

  let markerW: number, markerH: number, markerSvg: string;

  if (moving) {
    markerW = 40; markerH = 40;
    markerSvg = `
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
      <g transform="rotate(${heading},20,20)">
        <path d="M20 6 L26 32 L20 27 L14 32 Z" fill="white" fill-opacity="0.95" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
      </g>`;
  } else if (idle) {
    markerW = 26; markerH = 26;
    markerSvg = `
      <circle cx="13" cy="13" r="12" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>
      <circle cx="13" cy="13" r="7" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else {
    markerW = 14; markerH = 14;
    markerSvg = `<circle cx="7" cy="7" r="6" fill="${color}" stroke="white" stroke-width="2"/>`;
  }

  const totalW  = Math.max(markerW, pillW);
  const totalH  = pillH + gap + markerH;
  const mOffX   = (totalW - markerW) / 2;
  const pillX   = (totalW - pillW) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
    <g transform="translate(${mOffX},${pillH + gap})">${markerSvg}</g>
    <rect x="${pillX}" y="0" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="rgba(15,23,42,0.82)"/>
    <text x="${totalW / 2}" y="${pillH * 0.73}" text-anchor="middle" fill="white"
      font-size="9" font-weight="700"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escXml(name)}</text>
  </svg>`;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

type GMap       = google.maps.Map;
type GMarker    = google.maps.Marker;
type GPolyline  = google.maps.Polyline;
type GInfoWindow = google.maps.InfoWindow;

export default function FlotaMap({ vehicles, selectedId, className = "" }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<GMap | null>(null);
  const markersRef    = useRef<Record<string, GMarker>>({});
  const trailsRef     = useRef<Record<string, GPolyline>>({});
  const historyRef    = useRef<Record<string, { lat: number; lng: number }[]>>({});
  const infoWindowRef = useRef<GInfoWindow | null>(null);

  // Init map
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    if (mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

    import("@googlemaps/js-api-loader").then(({ setOptions, importLibrary }) => {
      setOptions({ key: apiKey });
      importLibrary("maps").then(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: 25.65, lng: -100.35 },
          zoom: 11,
          mapTypeId: "roadmap",
          disableDefaultUI: false,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: "poi",               elementType: "labels",    stylers: [{ visibility: "off" }] },
            { featureType: "poi.business",      elementType: "all",       stylers: [{ visibility: "off" }] },
            { featureType: "transit",           elementType: "labels",    stylers: [{ visibility: "off" }] },
            { featureType: "road",              elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { featureType: "administrative",    elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
            { featureType: "road",              elementType: "geometry",  stylers: [{ color: "#f3f4f6" }] },
            { featureType: "road.highway",      elementType: "geometry",  stylers: [{ color: "#e5e7eb" }] },
            { featureType: "road.highway",      elementType: "geometry.stroke", stylers: [{ color: "#d1d5db" }] },
            { featureType: "water",             elementType: "geometry",  stylers: [{ color: "#bfdbfe" }] },
            { featureType: "landscape",         elementType: "geometry",  stylers: [{ color: "#f9fafb" }] },
            { featureType: "landscape.natural", elementType: "geometry",  stylers: [{ color: "#f3f4f6" }] },
          ],
        });
        mapRef.current    = map;
        infoWindowRef.current = new google.maps.InfoWindow();
      });
    });
  }, []);

  // Update markers whenever vehicles change
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    const map      = mapRef.current;
    const newIds   = new Set(vehicles.map((v) => v.id));
    const isFirst  = Object.keys(markersRef.current).length === 0 && vehicles.length > 0;

    // Remove stale markers + trails
    Object.keys(markersRef.current).forEach((id) => {
      if (!newIds.has(id)) {
        markersRef.current[id].setMap(null);
        trailsRef.current[id]?.setMap(null);
        delete markersRef.current[id];
        delete trailsRef.current[id];
        delete historyRef.current[id];
      }
    });

    vehicles.forEach((v) => {
      const color  = ENGINE_COLOR[v.engineState ?? "Off"];
      const moving = v.speedMph > 0.5;
      const idle   = v.engineState === "Idle";
      const speedKph = Math.max(0, Math.round(v.speedMph * 1.60934));
      const pos    = { lat: v.lat, lng: v.lng };

      // Trail history
      if (!historyRef.current[v.id]) historyRef.current[v.id] = [];
      const hist = historyRef.current[v.id];
      const last = hist[hist.length - 1];
      if (!last || last.lat !== v.lat || last.lng !== v.lng) {
        hist.push({ lat: v.lat, lng: v.lng });
        if (hist.length > TRAIL_MAX) hist.shift();
      }

      let heading = v.headingDegrees;
      if ((heading === 0 || heading == null) && moving && hist.length >= 2) {
        const prev = hist[hist.length - 2];
        heading = bearingTo(prev.lat, prev.lng, v.lat, v.lng);
      }

      // Trail polyline
      if (moving && hist.length > 1) {
        const path = hist.map((p) => ({ lat: p.lat, lng: p.lng }));
        if (trailsRef.current[v.id]) {
          trailsRef.current[v.id].setPath(path);
        } else {
          trailsRef.current[v.id] = new google.maps.Polyline({
            path, map,
            strokeColor: color, strokeOpacity: 0.55, strokeWeight: 3,
          });
        }
      } else if (!moving && trailsRef.current[v.id]) {
        trailsRef.current[v.id].setMap(null);
        delete trailsRef.current[v.id];
      }

      // Marker icon — includes name pill above the marker in the SVG
      const charW   = 6.2;
      const pillPx  = 14;
      const pillW   = Math.max(v.name.length * charW + pillPx * 2, 32);
      const pillH   = 15;
      const gap     = 3;
      const mSize   = moving ? 40 : idle ? 26 : 14;
      const totalW  = Math.max(mSize, pillW);
      const totalH  = pillH + gap + mSize;
      const anchorX = totalW / 2;
      const anchorY = pillH + gap + mSize / 2; // center of the vehicle marker shape

      const icon: google.maps.Icon = {
        url:    markerSvgUrl(color, heading, moving, idle, v.name),
        size:   new google.maps.Size(totalW, totalH),
        anchor: new google.maps.Point(anchorX, anchorY),
      };

      const stateLabel = v.engineState === "On" ? "En ruta" : v.engineState === "Idle" ? "Ralentí" : "Apagado";
      const infoContent = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;min-width:190px;color:#111;line-height:1.5;padding:2px 0">
          <p style="font-weight:700;margin:0 0 2px;font-size:13px">${v.name}</p>
          <p style="margin:0;color:#6b7280;font-size:10.5px">${v.address || "Sin dirección"}</p>
          <div style="margin:7px 0;height:1px;background:#f3f4f6"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-weight:700;font-size:15px">${speedKph} <span style="font-size:11px;font-weight:500;color:#6b7280">km/h</span></span>
            <span style="font-size:10.5px;background:${color}22;color:${color};border:1px solid ${color}55;border-radius:10px;padding:2px 9px;font-weight:600">${stateLabel}</span>
          </div>
          <p style="margin:5px 0 0;color:#9ca3af;font-size:10px">${new Date(v.updatedAt).toLocaleTimeString("es-MX")}</p>
        </div>`;

      if (markersRef.current[v.id]) {
        markersRef.current[v.id].setPosition(pos);
        markersRef.current[v.id].setIcon(icon);
        markersRef.current[v.id].setZIndex(moving ? 10 : 1);
      } else {
        const marker = new google.maps.Marker({
          position: pos, map, icon,
          title:    v.name,
          zIndex:   moving ? 10 : 1,
        });
        marker.addListener("click", () => {
          infoWindowRef.current?.setContent(infoContent);
          infoWindowRef.current?.open(map, marker);
        });
        markersRef.current[v.id] = marker;
      }

      // Update info window if already open on this vehicle
      const iw = infoWindowRef.current;
      if (iw && (iw as unknown as { anchor?: GMarker }).anchor === markersRef.current[v.id]) {
        iw.setContent(infoContent);
      }
    });

    // Fit bounds on first load
    if (isFirst) {
      const bounds = new google.maps.LatLngBounds();
      vehicles.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [vehicles]);

  // Fly to selected vehicle
  useEffect(() => {
    if (!selectedId || !mapRef.current || !window.google) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (!v) return;
    mapRef.current.panTo({ lat: v.lat, lng: v.lng });
    mapRef.current.setZoom(16);
    const marker = markersRef.current[v.id];
    if (marker && infoWindowRef.current) {
      const stateLabel = v.engineState === "On" ? "En ruta" : v.engineState === "Idle" ? "Ralentí" : "Apagado";
      const color = ENGINE_COLOR[v.engineState ?? "Off"];
      const speedKph = Math.max(0, Math.round(v.speedMph * 1.60934));
      infoWindowRef.current.setContent(`
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;min-width:190px;color:#111;line-height:1.5;padding:2px 0">
          <p style="font-weight:700;margin:0 0 2px;font-size:13px">${v.name}</p>
          <p style="margin:0;color:#6b7280;font-size:10.5px">${v.address || "Sin dirección"}</p>
          <div style="margin:7px 0;height:1px;background:#f3f4f6"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-weight:700;font-size:15px">${speedKph} <span style="font-size:11px;font-weight:500;color:#6b7280">km/h</span></span>
            <span style="font-size:10.5px;background:${color}22;color:${color};border:1px solid ${color}55;border-radius:10px;padding:2px 9px;font-weight:600">${stateLabel}</span>
          </div>
          <p style="margin:5px 0 0;color:#9ca3af;font-size:10px">${new Date(v.updatedAt).toLocaleTimeString("es-MX")}</p>
        </div>`);
      infoWindowRef.current.open(mapRef.current, marker);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Cleanup on unmount
  useEffect(() => () => {
    Object.values(markersRef.current).forEach((m) => m.setMap(null));
    Object.values(trailsRef.current).forEach((p) => p.setMap(null));
    infoWindowRef.current?.close();
    markersRef.current  = {};
    trailsRef.current   = {};
    historyRef.current  = {};
    mapRef.current      = null;
  }, []);

  return <div ref={containerRef} className={className} />;
}
