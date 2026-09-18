import { NextResponse } from "next/server";

// Webhook — Sybil POSTea aquí el XML "Regreso de Información" después de dosificar.
// Configurar en Sybil: URL = https://<dominio>/api/sgp/regreso
// Seguridad: header Authorization o x-sgp-secret con el valor de SGP_WEBHOOK_SECRET.
//
// Persistencia en Firestore: requiere firebase-admin con service account.
// Mientras tanto, los datos se loguean en consola (visibles en Vercel → Functions → Logs).
// Para activar persistencia: npm install firebase-admin y descomentar la sección al final.

const WEBHOOK_SECRET = process.env.SGP_WEBHOOK_SECRET ?? "";

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1].trim() : "";
}

function num(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseRegreso(xml: string) {
  // Decodifica entidades si viene entity-encoded desde el envelope SOAP
  const decoded = xml
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  const pedidoMatch = decoded.match(/<pedido>([\s\S]*?)<\/pedido>/);
  if (!pedidoMatch) return null;
  const px = pedidoMatch[1];

  // ─── Sección Pedido ───────────────────────────────────────────────────────
  const pedido = {
    empresClave:       tag(px, "pedido_empres_clave"),
    serie:             tag(px, "pedido_serie"),
    numero:            tag(px, "pedido_numero"),
    totecSerie:        tag(px, "pedido_totec_serie"),   // serie_erp que enviamos
    totecNumero:       tag(px, "pedido_totec_numero"),  // numero_erp = folio programación
    clientClave:       tag(px, "pedido_client_clave"),
    clientNumero:      tag(px, "pedido_client_numero"),
    obrasNumero:       tag(px, "pedido_obras_numero"),
    formulClave:       tag(px, "pedido_formul_clave"),
    plantaGenera:      tag(px, "pedido_planta_genera"),
    cantidadSolicita:  num(tag(px, "pedido_cantidad_solicita")),
    remisiones:        [] as ReturnType<typeof parseRemision>[],
    detallesPedido:    [] as ReturnType<typeof parseDetallePedido>[],
  };

  // ─── Remisiones ───────────────────────────────────────────────────────────
  for (const m of px.matchAll(/<remisiones>([\s\S]*?)<\/remisiones>/g)) {
    pedido.remisiones.push(parseRemision(m[1]));
  }

  // ─── Detalles del pedido ─────────────────────────────────────────────────
  // Los <detalles> directos del pedido (no dentro de remisiones)
  const afterRemisiones = px.replace(/<remisiones>[\s\S]*?<\/remisiones>/g, "");
  for (const m of afterRemisiones.matchAll(/<detalles>([\s\S]*?)<\/detalles>/g)) {
    pedido.detallesPedido.push(parseDetallePedido(m[1]));
  }

  return pedido;
}

function parseRemision(rx: string) {
  const remision = {
    serie:                    tag(rx, "remisi_serie"),
    numero:                   tag(rx, "remisi_numero"),
    formulClave:              tag(rx, "remisi_formul_clave"),
    matpriClave:              tag(rx, "remisi_matpri_clave"),
    equipoClave:              tag(rx, "remisi_equipo_clave"),
    otrconClave:              tag(rx, "remisi_otrcon_clave"),
    otrconTraspaso:           tag(rx, "remisi_otrcon_traspaso"),
    percieAnio:               tag(rx, "remisi_percie_anio"),
    percieTipo:               tag(rx, "remisi_percie_tipo"),
    percieNumero:             tag(rx, "remisi_percie_numero"),
    pedidoSerie:              tag(rx, "remisi_pedido_serie"),
    pedidoNumero:             tag(rx, "remisi_pedido_numero"),
    operador:                 tag(rx, "remisi_person_operador"),
    remisiSerieApro:          tag(rx, "remisi_remisi_serie_apro"),
    remisiNumeroApro:         tag(rx, "remisi_remisi_numero_apro"),
    remisiSerieReco:          tag(rx, "remisi_remisi_serie_reco"),
    remisiNumeroReco:         tag(rx, "remisi_remisi_numero_reco"),
    numeroViaje:              tag(rx, "remisi_numero_viaje"),
    fechaRemision:            tag(rx, "remisi_fecha_remision"),
    cantidadRemisionada:      num(tag(rx, "remisi_cantidad_remisionada")),
    cantidadAprovechado:      num(tag(rx, "remisi_cantidad_aprovechado")),
    cantidadRecolocado:       num(tag(rx, "remisi_cantidad_recolocado")),
    cantidadDesperdicio:      num(tag(rx, "remisi_cantidad_desperdicio")),
    cantidadTraspaso:         num(tag(rx, "remisi_cantidad_traspaso")),
    cantidadOtraConcretera:   num(tag(rx, "remisi_cantidad_otra_concretera")),
    cantidadDosificar:        num(tag(rx, "remisi_cantidad_dosificar")),
    cantidadFacturar:         num(tag(rx, "remisi_cantidad_facturar")),
    equipoOtros:              tag(rx, "remisi_equipo_otros"),
    tomarMuestra:             tag(rx, "remisi_tomar_muestra"),
    cancelaMuestra:           tag(rx, "remisi_cancela_muestra"),
    fechaSalidaPlanta:        tag(rx, "remisi_fecha_salida_planta"),
    fechaLlegoObra:           tag(rx, "remisi_fecha_llego_obra"),
    fechaSalidaObra:          tag(rx, "remisi_fecha_salida_obra"),
    fechaLlegoPlanta:         tag(rx, "remisi_fecha_llego_planta"),
    fechaDosificacion:        tag(rx, "remisi_fecha_dosificacion"),
    horometroIni:             num(tag(rx, "remisi_horometro_ini")),
    horometroFin:             num(tag(rx, "remisi_horometro_fin")),
    odometroIni:              num(tag(rx, "remisi_odometro_ini")),
    odometroFin:              num(tag(rx, "remisi_odometro_fin")),
    comentarios:              tag(rx, "remisi_comentarios"),
    tipoGeneracion:           tag(rx, "remisi_tipo_generacion"),
    estatusDosificacion:      tag(rx, "remisi_estatus_dosificacion"), // "D" = Dosificada
    estatus:                  tag(rx, "remisi_estatus"),               // "C" = Cerrada
    consumos:                 [] as ReturnType<typeof parseConsumo>[],
    detalles:                 [] as ReturnType<typeof parseDetalleRemision>[],
  };

  for (const m of rx.matchAll(/<consumos>([\s\S]*?)<\/consumos>/g)) {
    remision.consumos.push(parseConsumo(m[1]));
  }
  const afterConsumos = rx.replace(/<consumos>[\s\S]*?<\/consumos>/g, "");
  for (const m of afterConsumos.matchAll(/<detalles>([\s\S]*?)<\/detalles>/g)) {
    remision.detalles.push(parseDetalleRemision(m[1]));
  }

  return remision;
}

function parseConsumo(cx: string) {
  return {
    remisiSerie:           tag(cx, "remdos_remisi_serie"),
    remisiNumero:          tag(cx, "remdos_remisi_numero"),
    numero:                tag(cx, "remdos_numero"),
    matpriClave:           tag(cx, "remdos_matpri_clave"),
    tipoDosifica:          tag(cx, "remdos_tipo_dosifica"),
    origenDosifica:        tag(cx, "remdos_origen_dosifica"),
    cantidadSobredosifica: num(tag(cx, "remdos_cantidad_sobredosifica")),
    cantidadFormula:       num(tag(cx, "remdos_cantidad_formula")),
    cantidadAjustada:      num(tag(cx, "remdos_cantidad_ajustada")),
    cantidadDosificada:    num(tag(cx, "remdos_cantidad_dosificada")),
    porcentajeHumedad:     num(tag(cx, "remdos_porcentaje_humedad")),
    porcentajeGranulometria: num(tag(cx, "remdos_porcentaje_granulometria")),
    detalleContaminacion:  tag(cx, "remdos_detalle_contaminacion"),
    estatusDosifica:       tag(cx, "remdos_estatus_dosifica"),
  };
}

function parseDetalleRemision(dx: string) {
  return {
    remisiSerie:   tag(dx, "detrem_remisi_serie"),
    remisiNumero:  tag(dx, "detrem_remisi_numero"),
    numero:        tag(dx, "detrem_numero"),
    serdosClave:   tag(dx, "detrem_serdos_clave"),
    servicClave:   tag(dx, "detrem_servic_clave"),
    cantidad:      num(tag(dx, "detrem_cantidad")),
    unimedClave:   tag(dx, "serdos_unimed_clave"),
    comentarios:   tag(dx, "detrem_comentarios"),
  };
}

function parseDetallePedido(dx: string) {
  return {
    pedidoSerie:   tag(dx, "detped_pedido_serie"),
    pedidoNumero:  tag(dx, "detped_pedido_numero"),
    numero:        tag(dx, "detped_numero"),
    serdosClave:   tag(dx, "detped_serdos_clave"),
    servicClave:   tag(dx, "detped_servic_clave"),
    cantidad:      num(tag(dx, "detped_cantidad")),
    comentarios:   tag(dx, "detped_comentarios"),
  };
}

export async function POST(req: Request) {
  // Validar secreto si está configurado
  if (WEBHOOK_SECRET) {
    const auth = req.headers.get("authorization") ?? req.headers.get("x-sgp-secret") ?? "";
    if (auth !== WEBHOOK_SECRET) {
      console.warn("[SGP regreso] Unauthorized — secret mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: string;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = await req.json() as { xml?: string };
    body = json.xml ?? "";
  } else {
    body = await req.text();
  }

  if (!body?.trim()) {
    return NextResponse.json({ error: "Body vacío" }, { status: 400 });
  }

  const pedido = parseRegreso(body);
  if (!pedido) {
    console.warn("[SGP regreso] No se encontró <pedido> en el XML recibido");
    return NextResponse.json({ error: "XML inválido — no contiene <pedido>" }, { status: 422 });
  }

  console.info(
    `[SGP regreso] Pedido ${pedido.serie}-${pedido.numero} | ERP ${pedido.totecSerie}-${pedido.totecNumero} | planta ${pedido.plantaGenera} | ${pedido.remisiones.length} remisiones`,
  );

  // ─── Persistencia en Firestore ────────────────────────────────────────────
  // La programación en Firestore tiene id = pedido.totecNumero (el numero_erp que enviamos).
  // Para escribir desde el servidor se necesita firebase-admin:
  //   npm install firebase-admin
  //   Agregar FIREBASE_ADMIN_CREDENTIALS (JSON del service account) a las env vars
  //   Descomentar el bloque de abajo.
  //
  // const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  // const { getFirestore } = await import("firebase-admin/firestore");
  // if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS!)) });
  // const adminDb = getFirestore();
  // if (pedido.totecNumero) {
  //   await adminDb.collection("programaciones").doc(pedido.totecNumero).update({
  //     sgpRemisiones: pedido.remisiones,
  //     sgpStatus: "dosificado",
  //     sgpUltimoRegreso: new Date().toISOString(),
  //   });
  // }

  return NextResponse.json({ ok: true, pedido });
}
