import { NextResponse } from "next/server";

const RESEND_KEY     = process.env.RESEND_API_KEY;
const SUPPORT_EMAILS = (process.env.SUPPORT_EMAILS ?? "contacto@lpsoft.mx").split(",").map((s) => s.trim()).filter(Boolean);

const TIPO_LABEL: Record<string, string> = {
  bug: "🐛 Bug / Error", mejora: "✨ Mejora", pregunta: "❓ Pregunta", otro: "🔖 Otro",
};
const PRIO_LABEL: Record<string, string> = {
  baja: "Baja", media: "Media", alta: "Alta", "crítica": "🔴 Crítica",
};
const PRIO_COLOR: Record<string, string> = {
  baja: "#64748b", media: "#f59e0b", alta: "#f97316", "crítica": "#ef4444",
};

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { tipo, titulo, prioridad, descripcion, autorNombre, autorEmail,
            ruta, planta, modulo, pasos, adjuntos, navegador, sistemaInfo } = data;

    if (!RESEND_KEY) {
      console.warn("[soporte] RESEND_API_KEY no configurado — se omite el email");
      return NextResponse.json({ ok: true, emailSkipped: true });
    }

    const pColor = PRIO_COLOR[prioridad] ?? "#64748b";

    // Nombre legible del módulo (ej. "transporte › programacion")
    const moduloLabel = modulo
      ? modulo.split("/").filter(Boolean).join(" › ")
      : (ruta ?? "—");

    // Sección pasos (solo si hay)
    const pasosHtml = pasos
      ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-top:16px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">Pasos para reproducir</p>
          <p style="margin:0;font-size:13px;color:#78350f;white-space:pre-wrap;line-height:1.6">${pasos}</p>
        </div>`
      : "";

    // Galería de adjuntos (solo si hay)
    const adjuntosHtml = Array.isArray(adjuntos) && adjuntos.length > 0
      ? `<div style="margin-top:20px">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em">Capturas adjuntas</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(adjuntos as string[]).map((url) =>
              `<a href="${url}" target="_blank"><img src="${url}" width="160" height="120" style="object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;display:block" /></a>`
            ).join("")}
          </div>
        </div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:620px;margin:32px auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">
    <!-- Header -->
    <div style="background:#CC2229;padding:28px 32px">
      <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">ERP Duro Concretos · Soporte</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">Nuevo ticket de soporte</h1>
    </div>
    <!-- Badges -->
    <div style="background:#fff;padding:14px 32px;border-bottom:1px solid #e2e8f0">
      <span style="display:inline-block;background:${pColor}20;color:${pColor};font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;border:1px solid ${pColor}40;margin-right:6px">
        ${PRIO_LABEL[prioridad] ?? prioridad}
      </span>
      <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;border:1px solid #e2e8f0;margin-right:6px">
        ${TIPO_LABEL[tipo] ?? tipo}
      </span>
      <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;border:1px solid #e2e8f0">
        📍 ${moduloLabel}
      </span>
    </div>
    <!-- Cuerpo -->
    <div style="background:#fff;padding:24px 32px">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a">${titulo}</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em">Descripción</p>
        <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;line-height:1.6">${descripcion}</p>
      </div>
      ${pasosHtml}
      ${adjuntosHtml}
      <!-- Metadatos -->
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#475569;margin-top:20px">
        <tr>
          <td style="padding:5px 0;width:110px;font-weight:600;color:#94a3b8;text-transform:uppercase;font-size:11px;letter-spacing:0.05em">Usuario</td>
          <td style="padding:5px 0">${autorNombre ?? ""}${autorEmail ? ` &lt;${autorEmail}&gt;` : ""}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-weight:600;color:#94a3b8;text-transform:uppercase;font-size:11px;letter-spacing:0.05em">Planta</td>
          <td style="padding:5px 0">${planta ?? "—"}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-weight:600;color:#94a3b8;text-transform:uppercase;font-size:11px;letter-spacing:0.05em">Módulo</td>
          <td style="padding:5px 0;font-family:monospace;font-size:12px">${modulo ?? ruta ?? "—"}</td>
        </tr>
        ${sistemaInfo && typeof sistemaInfo === "object"
          ? Object.entries(sistemaInfo as Record<string, string>).map(([k, v]) => {
              const labels: Record<string, string> = {
                navegador: "Navegador", so: "Sistema operativo",
                pantalla: "Resolución", viewport: "Ventana",
                zona: "Zona horaria", conexion: "Conexión", idioma: "Idioma",
              };
              return `<tr>
          <td style="padding:5px 0;font-weight:600;color:#94a3b8;text-transform:uppercase;font-size:11px;letter-spacing:0.05em">${labels[k] ?? k}</td>
          <td style="padding:5px 0">${v}</td>
        </tr>`;
            }).join("")
          : `<tr><td style="padding:5px 0;font-weight:600;color:#94a3b8;text-transform:uppercase;font-size:11px">Navegador</td><td style="padding:5px 0">${navegador ?? "—"}</td></tr>`
        }
      </table>
    </div>
    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">Responde el ticket en <strong>/soporte</strong> del ERP Duro Concretos</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "ERP Duro Concretos <noreply@lpsoft.mx>",
        to: SUPPORT_EMAILS,
        subject: `[Soporte] ${PRIO_LABEL[prioridad] ?? prioridad} · ${titulo}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[soporte] Resend error:", err);
      return NextResponse.json({ ok: false, error: err });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[soporte] Error inesperado:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
