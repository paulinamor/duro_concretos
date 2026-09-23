// Shared GPS cycle detection utilities — used by flota-en-vivo and verificacion-viajes

export const PLANTS = [
  { id: "allende",   name: "Planta Allende",  lat: 25.301206,         lng: -100.004068,        radiusM: 300 },
  { id: "pesqueria", name: "Planta Pesquería", lat: 25.80380254093802, lng: -100.1058478460289, radiusM: 300 },
] as const;

export type RichGpsPoint = {
  lat: number; lng: number; time: string; address?: string; speedMph: number;
};

export type TripCycle = {
  num:            number;
  departureTime:  string;
  obraArrival?:   string;
  obraAddress?:   string;
  obraDeparture?: string;
  returnTime?:    string;
  toObraMin:      number;
  obraMin:        number;
  backMin:        number;
  totalMin:       number;
  status:         "complete" | "en_curso";
};

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInPlantCoords(lat: number, lng: number): boolean {
  return PLANTS.some((p) => haversineKm(lat, lng, p.lat, p.lng) * 1000 <= p.radiusM + 100);
}

export function minutesDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export function fmtHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function detectCycles(points: RichGpsPoint[]): TripCycle[] {
  if (points.length < 3) return [];

  const cycles: TripCycle[] = [];
  let state: "in_plant" | "traveling" | "at_obra" =
    isInPlantCoords(points[0].lat, points[0].lng) ? "in_plant" : "traveling";

  let departureTime: string | null  = null;
  let obraArrival:   string | null  = null;
  let obraAddress:   string | undefined;
  let obraDeparture: string | null  = null;
  let dwellRefLat    = 0, dwellRefLng = 0, dwellCount = 0;

  const DWELL_KM = 0.15, MIN_DWELL = 2;

  const pushCycle = (returnTime?: string) => {
    if (!departureTime) return;
    const last = returnTime ?? points[points.length - 1].time;
    cycles.push({
      num: cycles.length + 1,
      departureTime,
      obraArrival:   obraArrival  ?? undefined,
      obraAddress,
      obraDeparture: obraDeparture ?? undefined,
      returnTime,
      toObraMin:  obraArrival  ? minutesDiff(departureTime, obraArrival)   : minutesDiff(departureTime, last),
      obraMin:    obraArrival && obraDeparture ? minutesDiff(obraArrival, obraDeparture)
                : obraArrival ? minutesDiff(obraArrival, last) : 0,
      backMin:    obraDeparture ? minutesDiff(obraDeparture, last) : 0,
      totalMin:   minutesDiff(departureTime, last),
      status:     returnTime ? "complete" : "en_curso",
    });
    departureTime = null; obraArrival = null; obraAddress = undefined; obraDeparture = null;
  };

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const inPlant = isInPlantCoords(pt.lat, pt.lng);

    if (state === "in_plant") {
      if (!inPlant) {
        departureTime = pt.time; state = "traveling";
        dwellCount = 1; dwellRefLat = pt.lat; dwellRefLng = pt.lng;
      }
    } else if (state === "traveling") {
      if (inPlant && departureTime) {
        pushCycle(pt.time); state = "in_plant"; dwellCount = 0;
      } else if (!inPlant) {
        if (haversineKm(pt.lat, pt.lng, dwellRefLat, dwellRefLng) < DWELL_KM) {
          dwellCount++;
          if (dwellCount >= MIN_DWELL && obraArrival === null) {
            const si = Math.max(0, i - dwellCount + 1);
            obraArrival = points[si].time;
            obraAddress = points[si].address;
            state = "at_obra";
          }
        } else {
          dwellCount = 1; dwellRefLat = pt.lat; dwellRefLng = pt.lng;
        }
      }
    } else if (state === "at_obra") {
      if (inPlant) {
        obraDeparture = obraDeparture ?? pt.time;
        pushCycle(pt.time); state = "in_plant"; dwellCount = 0;
      } else if (haversineKm(pt.lat, pt.lng, dwellRefLat, dwellRefLng) > DWELL_KM) {
        obraDeparture = pt.time; state = "traveling";
        dwellCount = 1; dwellRefLat = pt.lat; dwellRefLng = pt.lng;
      } else {
        dwellRefLat = (dwellRefLat + pt.lat) / 2;
        dwellRefLng = (dwellRefLng + pt.lng) / 2;
      }
    }
  }

  if (departureTime && state !== "in_plant") pushCycle();
  return cycles;
}
