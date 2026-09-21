"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Polyline } from "leaflet";

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

// Compass bearing from point A → B (degrees 0–360)
function bearingTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toR = (d: number) => d * Math.PI / 180;
  const dLon = toR(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toR(lat2));
  const x = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) -
            Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Outer circle stays fixed; only the inner SVG arrow rotates to heading.
// Prevents the border from tilting and makes the direction clearly visible.
function markerSvg(color: string, heading: number, moving: boolean, idle: boolean): string {
  if (moving) {
    return `
      <div style="position:relative;width:40px;height:40px">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${color};
          border:3px solid rgba(255,255,255,0.97);
          box-shadow:0 4px 14px rgba(0,0,0,0.45),0 0 0 4px ${color}44;
        "></div>
        <div style="
          position:absolute;inset:0;
          display:flex;align-items:center;justify-content:center;
          transform:rotate(${heading}deg);
        ">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 3 L16.5 18 L11 14 L5.5 18 Z"
              fill="white" fill-opacity="0.97"
              stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
          </svg>
        </div>
      </div>`;
  }
  if (idle) {
    return `
      <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center">
        <div style="
          position:absolute;width:26px;height:26px;border-radius:50%;
          border:2px solid ${color}66;background:${color}22;
        "></div>
        <div style="
          width:14px;height:14px;background:${color};border-radius:50%;
          border:2.5px solid rgba(255,255,255,0.9);
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          position:relative;
        "></div>
      </div>`;
  }
  return `
    <div style="
      width:14px;height:14px;background:${color};border-radius:50%;
      border:2.5px solid rgba(255,255,255,0.85);
      box-shadow:0 1px 6px rgba(0,0,0,0.4);
    "></div>`;
}

export default function FlotaMap({ vehicles, selectedId, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markersRef   = useRef<Record<string, L.Marker>>({});
  const trailsRef    = useRef<Record<string, Polyline>>({});
  const historyRef   = useRef<Record<string, { lat: number; lng: number }[]>>({});

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof import("leaflet");

    if (!mapRef.current) {
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
      // OpenStreetMap — free, no API key required
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
    }

    const map = mapRef.current;
    const isFirstLoad = Object.keys(markersRef.current).length === 0;
    const newIds = new Set(vehicles.map((v) => v.id));

    // Remove stale markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!newIds.has(id)) {
        markersRef.current[id].remove();
        trailsRef.current[id]?.remove();
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

      // Position history
      if (!historyRef.current[v.id]) historyRef.current[v.id] = [];
      const hist = historyRef.current[v.id];
      const last = hist[hist.length - 1];
      if (!last || last.lat !== v.lat || last.lng !== v.lng) {
        hist.push({ lat: v.lat, lng: v.lng });
        if (hist.length > TRAIL_MAX) hist.shift();
      }

      // Use GPS heading when available; fall back to bearing from position trail.
      // headingDegrees = 0 from Samsara usually means "unknown", not "facing north".
      let heading = v.headingDegrees;
      if ((heading === 0 || heading == null) && moving && hist.length >= 2) {
        const prev = hist[hist.length - 2];
        heading = bearingTo(prev.lat, prev.lng, v.lat, v.lng);
      }

      // Trail polyline
      if (moving && hist.length > 1) {
        const coords = hist.map((p) => [p.lat, p.lng] as [number, number]);
        if (trailsRef.current[v.id]) {
          trailsRef.current[v.id].setLatLngs(coords);
        } else {
          trailsRef.current[v.id] = L.polyline(coords, {
            color, weight: 3, opacity: 0.5,
          }).addTo(map);
        }
      } else if (!moving && trailsRef.current[v.id]) {
        trailsRef.current[v.id].remove();
        delete trailsRef.current[v.id];
      }

      // Marker icon
      const html = markerSvg(color, heading, moving, idle);
      const size = moving ? 40 : idle ? 26 : 14;
      const half = size / 2;
      const icon = L.divIcon({
        html,
        iconSize:   [size, size],
        iconAnchor: [half, half],
        className:  "",
      });

      const stateLabel = v.engineState === "On" ? "En ruta" : v.engineState === "Idle" ? "Ralentí" : "Apagado";
      const popup = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;min-width:180px;color:#111;line-height:1.5">
          <p style="font-weight:700;margin:0 0 2px;font-size:13px">${v.name}</p>
          <p style="margin:0;color:#666;font-size:10.5px">${v.address || "Sin dirección"}</p>
          <div style="margin:7px 0;height:1px;background:#efefef"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-weight:700;font-size:15px">${speedKph} <span style="font-size:11px;font-weight:500;color:#555">km/h</span></span>
            <span style="font-size:10.5px;background:${color}22;color:${color};border:1px solid ${color}55;border-radius:10px;padding:2px 9px;font-weight:600">${stateLabel}</span>
          </div>
          <p style="margin:5px 0 0;color:#aaa;font-size:10px">${new Date(v.updatedAt).toLocaleTimeString("es-MX")}</p>
        </div>`;

      if (markersRef.current[v.id]) {
        markersRef.current[v.id]
          .setLatLng([v.lat, v.lng])
          .setIcon(icon)
          .setPopupContent(popup);
        if (moving) markersRef.current[v.id].setZIndexOffset(1000);
      } else {
        markersRef.current[v.id] = L.marker([v.lat, v.lng], {
          icon,
          zIndexOffset: moving ? 1000 : 0,
        })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 220, offset: [0, -half] });
      }
    });

    if (isFirstLoad && vehicles.length > 0) {
      map.fitBounds(
        vehicles.map((v) => [v.lat, v.lng] as [number, number]),
        { padding: [50, 50], maxZoom: 14 },
      );
    }
  }, [vehicles]);

  // Fly to selected
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (v) {
      mapRef.current.flyTo([v.lat, v.lng], 16, { animate: true, duration: 0.8 });
      markersRef.current[v.id]?.openPopup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current    = null;
    markersRef.current  = {};
    trailsRef.current   = {};
    historyRef.current  = {};
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} className={className} />
    </>
  );
}
