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

export type Geofence = {
  lat:     number;
  lng:     number;
  radiusM: number;
  name:    string;
  color:   string;
};

type Props = {
  vehicles:        VehicleLocation[];
  selectedId?:     string | null;
  onVehicleClick?: (id: string) => void;
  className?:      string;
  showTraffic?:    boolean;
  mapType?:        "roadmap" | "satellite";
  tripPath?:       { lat: number; lng: number }[] | null;
  geofences?:      Geofence[];
  replayMarker?:   { lat: number; lng: number; heading: number } | null;
};

const TRAIL_MAX = 50;

function vehicleColor(speedKph: number, engineState?: string): string {
  if (!engineState || engineState === "Off") return "#94a3b8";
  if (engineState === "Idle") return "#f59e0b";
  if (speedKph >= 100) return "#ef4444";
  if (speedKph >= 80)  return "#f97316";
  return "#22c55e";
}

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

  const totalW = Math.max(markerW, pillW);
  const totalH = pillH + gap + markerH;
  const mOffX  = (totalW - markerW) / 2;
  const pillX  = (totalW - pillW) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
    <g transform="translate(${mOffX},${pillH + gap})">${markerSvg}</g>
    <rect x="${pillX}" y="0" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="rgba(15,23,42,0.82)"/>
    <text x="${totalW / 2}" y="${pillH * 0.73}" text-anchor="middle" fill="white"
      font-size="9" font-weight="700"
      font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escXml(name)}</text>
  </svg>`;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function replayMarkerSvgUrl(heading: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="#3b82f6" stroke="white" stroke-width="3" opacity="0.9"/>
    <circle cx="22" cy="22" r="20" fill="none" stroke="#3b82f6" stroke-width="6" opacity="0.3"/>
    <g transform="rotate(${heading},22,22)">
      <path d="M22 8 L28 34 L22 29 L16 34 Z" fill="white" fill-opacity="0.95"/>
    </g>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

let mapsApiInitialized = false;

type GMap        = google.maps.Map;
type GMarker     = google.maps.Marker;
type GPolyline   = google.maps.Polyline;
type GCircle     = google.maps.Circle;
type GInfoWindow = google.maps.InfoWindow;

export default function FlotaMap({
  vehicles, selectedId, onVehicleClick, className = "",
  showTraffic = false, mapType = "roadmap",
  tripPath, geofences = [], replayMarker,
}: Props) {
  const containerRef       = useRef<HTMLDivElement>(null);
  const mapRef             = useRef<GMap | null>(null);
  const markersRef         = useRef<Record<string, GMarker>>({});
  const trailsRef          = useRef<Record<string, GPolyline>>({});
  const historyRef         = useRef<Record<string, { lat: number; lng: number }[]>>({});
  const infoWindowRef      = useRef<GInfoWindow | null>(null);
  const trafficRef         = useRef<google.maps.TrafficLayer | null>(null);
  const tripPolyRef        = useRef<GPolyline | null>(null);
  const geofenceCirclesRef = useRef<GCircle[]>([]);
  const geofenceLabelsRef  = useRef<GMarker[]>([]);
  const replayMarkerRef    = useRef<GMarker | null>(null);
  const onClickRef         = useRef(onVehicleClick);
  onClickRef.current       = onVehicleClick;

  // Init map
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current || mapRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    import("@googlemaps/js-api-loader").then(({ setOptions, importLibrary }) => {
      if (!mapsApiInitialized) { setOptions({ key: apiKey }); mapsApiInitialized = true; }
      importLibrary("maps").then(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: 25.65, lng: -100.35 },
          zoom: 11,
          mapTypeId: mapType,
          disableDefaultUI: false,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: "poi",               elementType: "labels",      stylers: [{ visibility: "off" }] },
            { featureType: "poi.business",      elementType: "all",         stylers: [{ visibility: "off" }] },
            { featureType: "transit",           elementType: "labels",      stylers: [{ visibility: "off" }] },
            { featureType: "road",              elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { featureType: "road",              elementType: "geometry",    stylers: [{ color: "#f3f4f6" }] },
            { featureType: "road.highway",      elementType: "geometry",    stylers: [{ color: "#e5e7eb" }] },
            { featureType: "road.highway",      elementType: "geometry.stroke", stylers: [{ color: "#d1d5db" }] },
            { featureType: "water",             elementType: "geometry",    stylers: [{ color: "#bfdbfe" }] },
            { featureType: "landscape",         elementType: "geometry",    stylers: [{ color: "#f9fafb" }] },
            { featureType: "landscape.natural", elementType: "geometry",    stylers: [{ color: "#f3f4f6" }] },
            { featureType: "administrative",    elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
          ],
        });
        mapRef.current        = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        trafficRef.current    = new google.maps.TrafficLayer();
        if (showTraffic) trafficRef.current.setMap(map);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Traffic toggle
  useEffect(() => {
    if (!mapRef.current || !trafficRef.current) return;
    trafficRef.current.setMap(showTraffic ? mapRef.current : null);
  }, [showTraffic]);

  // Map type toggle
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

  // Geofence circles + labels
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    geofenceCirclesRef.current.forEach((c) => c.setMap(null));
    geofenceLabelsRef.current.forEach((m) => m.setMap(null));
    geofenceCirclesRef.current = [];
    geofenceLabelsRef.current  = [];

    geofences.forEach((gf) => {
      const circle = new google.maps.Circle({
        map:           mapRef.current,
        center:        { lat: gf.lat, lng: gf.lng },
        radius:        gf.radiusM,
        strokeColor:   gf.color,
        strokeOpacity: 0.8,
        strokeWeight:  2,
        fillColor:     gf.color,
        fillOpacity:   0.08,
        zIndex:        1,
      });
      geofenceCirclesRef.current.push(circle);

      // Label marker at center
      const labelSvg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
          <rect x="0" y="0" width="120" height="20" rx="10" fill="${gf.color}" fill-opacity="0.85"/>
          <text x="60" y="14" text-anchor="middle" fill="white" font-size="10" font-weight="700"
            font-family="system-ui,-apple-system,sans-serif">${gf.name}</text>
        </svg>`,
      );
      const label = new google.maps.Marker({
        position:  { lat: gf.lat, lng: gf.lng },
        map:       mapRef.current,
        icon:      { url: `data:image/svg+xml;charset=UTF-8,${labelSvg}`, anchor: new google.maps.Point(60, 10) },
        zIndex:    2,
        clickable: false,
      });
      geofenceLabelsRef.current.push(label);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geofences]);

  // Trip history path
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    tripPolyRef.current?.setMap(null);
    tripPolyRef.current = null;
    if (tripPath && tripPath.length > 1) {
      tripPolyRef.current = new google.maps.Polyline({
        path:          tripPath,
        map:           mapRef.current,
        strokeColor:   "#3b82f6",
        strokeOpacity: 0.75,
        strokeWeight:  4,
        zIndex:        5,
      });
      const bounds = new google.maps.LatLngBounds();
      tripPath.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [tripPath]);

  // Replay marker
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!replayMarker) {
      replayMarkerRef.current?.setMap(null);
      replayMarkerRef.current = null;
      return;
    }
    const icon: google.maps.Icon = {
      url:    replayMarkerSvgUrl(replayMarker.heading),
      size:   new google.maps.Size(44, 44),
      anchor: new google.maps.Point(22, 22),
    };
    if (replayMarkerRef.current) {
      replayMarkerRef.current.setPosition({ lat: replayMarker.lat, lng: replayMarker.lng });
      replayMarkerRef.current.setIcon(icon);
    } else {
      replayMarkerRef.current = new google.maps.Marker({
        position: { lat: replayMarker.lat, lng: replayMarker.lng },
        map:      mapRef.current,
        icon,
        zIndex:   20,
        title:    "Replay",
      });
    }
    mapRef.current.panTo({ lat: replayMarker.lat, lng: replayMarker.lng });
  }, [replayMarker]);

  // Update vehicle markers
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const map     = mapRef.current;
    const newIds  = new Set(vehicles.map((v) => v.id));
    const isFirst = Object.keys(markersRef.current).length === 0 && vehicles.length > 0;

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
      const moving   = v.speedMph > 0.5;
      const idle     = v.engineState === "Idle";
      const speedKph = Math.max(0, Math.round(v.speedMph * 1.60934));
      const color    = vehicleColor(speedKph, v.engineState);
      const pos      = { lat: v.lat, lng: v.lng };

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

      if (moving && hist.length > 1) {
        const path = hist.map((p) => ({ lat: p.lat, lng: p.lng }));
        if (trailsRef.current[v.id]) {
          trailsRef.current[v.id].setPath(path);
          trailsRef.current[v.id].setOptions({ strokeColor: color });
        } else {
          trailsRef.current[v.id] = new google.maps.Polyline({
            path, map, strokeColor: color, strokeOpacity: 0.45, strokeWeight: 3,
          });
        }
      } else if (!moving && trailsRef.current[v.id]) {
        trailsRef.current[v.id].setMap(null);
        delete trailsRef.current[v.id];
      }

      const charW  = 6.2;
      const pillPx = 14;
      const pillW  = Math.max(v.name.length * charW + pillPx * 2, 32);
      const pillH  = 15;
      const gap    = 3;
      const mSize  = moving ? 40 : idle ? 26 : 14;
      const totalW = Math.max(mSize, pillW);
      const totalH = pillH + gap + mSize;

      const icon: google.maps.Icon = {
        url:    markerSvgUrl(color, heading, moving, idle, v.name),
        size:   new google.maps.Size(totalW, totalH),
        anchor: new google.maps.Point(totalW / 2, pillH + gap + mSize / 2),
      };

      const stateLabel  = v.engineState === "On" ? "En ruta" : v.engineState === "Idle" ? "Ralentí" : "Apagado";
      const infoContent = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;min-width:190px;color:#111;line-height:1.5;padding:2px 0">
          <p style="font-weight:700;margin:0 0 2px;font-size:13px">${escXml(v.name)}</p>
          <p style="margin:0;color:#6b7280;font-size:10.5px">${escXml(v.address || "Sin dirección")}</p>
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
        const marker = new google.maps.Marker({ position: pos, map, icon, title: v.name, zIndex: moving ? 10 : 1 });
        marker.addListener("click", () => {
          if (onClickRef.current) {
            onClickRef.current(v.id);
          } else {
            infoWindowRef.current?.setContent(infoContent);
            infoWindowRef.current?.open(map, marker);
          }
        });
        markersRef.current[v.id] = marker;
      }
    });

    if (isFirst) {
      const bounds = new google.maps.LatLngBounds();
      vehicles.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [vehicles]);

  // Pan to selected vehicle
  useEffect(() => {
    if (!selectedId || !mapRef.current || !window.google) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (v) { mapRef.current.panTo({ lat: v.lat, lng: v.lng }); mapRef.current.setZoom(16); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Cleanup
  useEffect(() => () => {
    Object.values(markersRef.current).forEach((m) => m.setMap(null));
    Object.values(trailsRef.current).forEach((p) => p.setMap(null));
    geofenceCirclesRef.current.forEach((c) => c.setMap(null));
    geofenceLabelsRef.current.forEach((m) => m.setMap(null));
    tripPolyRef.current?.setMap(null);
    replayMarkerRef.current?.setMap(null);
    infoWindowRef.current?.close();
    mapRef.current = null;
  }, []);

  return <div ref={containerRef} className={className} />;
}
