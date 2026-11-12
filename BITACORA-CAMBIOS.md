# Bitácora de Cambios — Duro Concretos ERP

> Registro de modificaciones para justificación de horas de mantenimiento.
> Categorías: 🐛 Bug/Error · ✨ Mejora · 🔧 Ajuste

---

## Noviembre 2026

### 2026-11-12 (sesión 10) — Pipeline CRM y Nómina

#### ✨ Mejora — Pipeline CRM: KPI cards rediseñados (grid 3 columnas + valores abreviados)
- **Archivo:** `app/(dashboard)/crm/pipeline/page.tsx`
- **Descripción:** Los 6 KPI cards estaban en una fila de 6 columnas (`xl:grid-cols-6`), dejando los valores truncados. Se rediseñaron:
  - Grid cambiado a `grid-cols-2 md:grid-cols-3` (2 filas de 3 cards, con más espacio por card)
  - Valores monetarios abreviados con helper `fmtMoney()`: ≥1M → `$8.1M`, ≥1k → `$Xk`
  - Subtítulo muestra el valor exacto en cada card monetaria
  - Subtítulo "oportunidades" en "En cierre" y "Perdidas"
  - Títulos sin truncar: M³ estimados, En cierre, Ganadas, Perdidas
- **Horas estimadas:** 0.2 hrs

#### ✨ Mejora — Nómina: campos manuales de montos + cálculo automático como "Próximamente"
- **Archivo:** `app/(dashboard)/recursos-humanos/nomina/page.tsx`
- **Descripción:**
  1. **Campos manuales**: Se agregó sección "Montos de nómina" con 5 campos capturables: Sueldo bruto, Neto a pagar, IMSS obrero, ISR retenido, Subsidio al empleo. El botón "Guardar recibo" se activa con solo llenar Sueldo bruto + Neto.
  2. **Cálculo automático griseado**: El botón "Calcular con tablas SAT 2026" se muestra con overlay semitransparente y badge "Cálculo automático · Próximamente". Deshabilitado permanentemente hasta implementar el módulo de tablas SAT.
  3. **`guardar()` actualizado**: Usa `desglose` si existe (futuro), o los montos manuales del formulario.
- **Horas estimadas:** 0.3 hrs

### 2026-11-12 (sesión 9b) — Fixes post-testing Facturama

#### 🐛 Bug — Facturama: `GlobalInformation` faltante para receptor XAXX010101000
- **Archivo:** `lib/facturama.ts` (`buildCfdiPayload`)
- **Descripción:** El SAT exige el nodo `GlobalInformation` cuando el RFC del receptor es `XAXX010101000` (Público en General). Sin él, el CFDI es rechazado. Se agregó condicionalmente: `Periodicity: "01"`, `Months: MM` (mes actual con cero inicial), `Year: YYYY`.
- **Horas estimadas:** 0.1 hrs

#### 🐛 Bug — TypeScript: tipo `FmDoctoRelacionado` sin campo `Taxes`
- **Archivo:** `lib/facturama.ts`
- **Descripción:** El agente de sandbox agregó `Taxes: [...]` a los objetos `FmDoctoRelacionado` en `buildComplementoPayload` pero no actualizó la interfaz TypeScript. Se corrigió añadiendo `Taxes?: FmTax[]` al tipo `FmDoctoRelacionado`. El compilador (`npx tsc --noEmit`) pasó limpio tras el fix.
- **Horas estimadas:** 0.05 hrs

### 2026-11-12 (sesión 9) — Testing y corrección de integración Facturama

#### 🐛 Bug — Facturama: endpoints de descarga PDF/XML incorrectos
- **Archivo:** `lib/facturama.ts` (`obtenerPdfBase64`, `obtenerXmlBase64`)
- **Descripción:** Los endpoints `/api-lite/3/cfdis/{id}/pdf/issued` y `/api-lite/3/cfdis/{id}/xml/issued` retornaban 404 siempre. Corregidos a `/Cfdi/pdf/issuedLite/{id}` y `/Cfdi/xml/issuedLite/{id}` (confirmado que responden HTTP 200 con contenido base64).
- **Horas estimadas:** 0.1 hrs

#### 🐛 Bug — Facturama: endpoint de cancelación incorrecto
- **Archivo:** `lib/facturama.ts` (`cancelarCfdi`)
- **Descripción:** El endpoint de cancelación `/api-lite/3/cfdis/{id}?type=issued` retornaba 404. Corregido a `/Cfdi/{id}?type=issuedLite` (igual que vocare).
- **Horas estimadas:** 0.05 hrs

#### 🐛 Bug — Facturama: `buildComplementoPayload` usaba formato incorrecto para CFDI tipo P
- **Archivo:** `lib/facturama.ts` (`buildComplementoPayload`)
- **Descripción:** 3 errores en el payload de complemento de pago:
  1. Usaba `Complement` (inglés) en vez de `Complemento` (español) → API no reconocía el nodo
  2. Incluía `Items` → la API de Facturama rechaza items en CFDI tipo P ("No deben existir items")
  3. Incluía `Currency: "XXX"` a nivel raíz → la API rechaza Currency en CFDI tipo P
  También se agregaron `Taxes` en `RelatedDocuments` (IVA trasladado), requerido para TaxObject "02".
- **Horas estimadas:** 0.3 hrs

#### 🐛 Bug — Facturama Nómina: Curp del emisor enviado para Persona Moral
- **Archivo:** `app/api/facturama/timbrar-nomina/route.ts`
- **Descripción:** El campo `Curp` en `Payroll.Issuer` se enviaba como `""` siempre, pero cuando el emisor es Persona Moral (ej. SA de CV), el SAT rechaza la nómina con "Como persona moral no debe existir el CURP". Corregido para solo incluir `Curp` si `body.curpEmisor` es no vacío.
- **Horas estimadas:** 0.1 hrs

#### 🐛 Bug — Facturama Nómina: endpoint de descarga PDF incorrecto
- **Archivo:** `app/api/facturama/timbrar-nomina/route.ts`
- **Descripción:** El endpoint `/api-lite/3/cfdis/{id}/pdf/payroll` retorna 404. Corregido a `/Cfdi/pdf/issuedLite/{id}`.
- **Horas estimadas:** 0.05 hrs

#### 🔧 Ajuste — `.env.local`: activar sandbox de Facturama para testing
- **Archivo:** `.env.local`
- **Descripción:** `FACTURAMA_SANDBOX` cambiado de `false` a `true` para que el ERP apunte al sandbox durante desarrollo y pruebas. Cambiar a `false` solo en producción.
- **Horas estimadas:** 0.01 hrs

#### ✨ Mejora — Validación del payload de Nómina confirmada en sandbox
- **Descripción:** Se probaron los 4 tipos de CFDI directamente contra el sandbox de Facturama (`apisandbox.facturama.mx`) con los CSDs registrados (LOLR790822SG4 y GJL130308N34):
  - **CFDI Ingreso** ✅ — UUID: `2265d1e6-d31b-42f0-a161-1b1e5dcade76`
  - **CFDI Egreso (Nota de crédito)** ✅ — UUID: `b8c45757-b9c7-455e-bb38-b693d10b1e95`
  - **Complemento de Pago** ✅ — UUID: `90542702-2d30-4050-9da8-d741f687a94f` (corregido payload)
  - **CFDI Nómina** ✅ — UUID: `c4cd3345-9281-4b66-a0d0-73c6b04701ef` (CP correcto del empleado: 64480)
  - Nota: cuando el receptor es XAXX010101000, se requiere nodo `GlobalInformation` con `Periodicity/Months/Year`
- **Horas estimadas:** 1.5 hrs

### 2026-11-12 (sesión 8)

#### ✨ Mejora — Recibos de Concreto: modal de opciones de impresión (1 por hoja / 2 por hoja)
- **Archivo:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`
- **Descripción:** Se eliminó el toggle "Hoja completa / Media hoja" del header. Ahora al presionar **Imprimir** aparece un modal limpio con dos opciones visuales:
  - **1 por hoja** — carta horizontal (igual que antes: recibo completo landscape)
  - **2 por hoja** — carta vertical, original + copia con línea de corte punteada
  - Cada opción tiene un ícono SVG que representa el layout de la hoja
  - Al seleccionar, configura el tamaño e imprime inmediatamente (sin paso extra)
  - Modal con backdrop blur, cierra con Esc o clic fuera
- **Horas estimadas:** 0.25 hrs

#### ✨ Mejora — Recibos de Concreto: media hoja imprime 2 copias en una sola hoja carta
- **Archivo:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`
- **Descripción:** El modo "Media hoja" ya no imprime en 5.5×8.5" (media hoja sola). Ahora imprime DOS copias del recibo en una sola hoja carta portrait (letter portrait):
  - Primera mitad: **ORIGINAL — CLIENTE**
  - Línea punteada de corte con tijera ✂
  - Segunda mitad: **COPIA — EMPRESA**
  - El contenido del recibo se extrajo a una función local `receiptBody(label?)` para renderizarse dos veces sin duplicar código
  - Tamaño de página actualizado: `5.5in 8.5in portrait` → `letter portrait`
  - Hoja completa sigue igual: landscape letter con un solo recibo
- **Horas estimadas:** 0.5 hrs

#### ✨ Mejora — Caja Chica: responsable ligado a cuenta del sistema + control de acceso + filtros + bitácora
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:**
  1. **Responsable = cuenta del sistema**: El campo "Responsable" en el modal de nueva/editar caja ahora es un `<select>` que muestra todos los usuarios activos del sistema (nombre + email). Se guarda `responsableEmail` en Firestore junto con `responsable` (nombre para display).
  2. **Control de acceso**: Administradores ven todas las cajas. Usuarios tipo `operador` solo ven las cajas asignadas a su correo (`responsableEmail === session.email`). Las cajas sin asignar también las ve solo el admin.
  3. **Filtros profesionales con etiquetas**: Rediseñados en dos filas:
     - Fila 1: buscador (folio/descripción/entrega) + botón "Limpiar filtros" + contador de resultados
     - Fila 2: **Estado** · **Categoría** · **Período** (desde–hasta) con etiquetas claras
  4. **Bitácora de movimientos**: Nueva sección colapsable al final de cada caja que muestra un timeline cronológico inverso con TODOS los eventos:
     - ↓ Fondos recibidos (distribuciones)
     - · Gasto registrado (creadoEn)
     - ✓ Gasto aprobado (aprobadoEn + aprobadoPor)
     - ✗ Gasto rechazado (rechazadoEn + motivoRechazo)
- **Horas estimadas:** 1.5 hrs

#### ✨ Mejora — Caja Chica: tarjetas KPI clickeables con panel de detalle y origen de datos
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Las 3 tarjetas de la caja principal ahora son clickeables. Al tocar una se abre un panel explicativo que muestra de dónde viene ese número:
  - **Entradas de efectivo** → explica que viene del módulo de Efectivo, muestra conteo de recibos entregados vs pendientes
  - **Total egresos** → muestra los dos componentes: egresos directos de efectivo + distribuciones a cajas chicas con tabla detalle (fecha, caja, concepto, monto)
  - **Saldo disponible** → muestra la fórmula completa: Entradas − Egresos − Cajas = Saldo
  - Tocar la misma tarjeta dos veces cierra el panel; hay botón "✕ cerrar"
  - También se renombró "Comprometido" → "Total egresos"
- **Horas estimadas:** 0.5 hrs

#### 🐛 Fix — Caja Chica: datos de Caja Principal solo de la planta activa
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** La Caja Principal estaba jalando efectivo de TODAS las plantas (mostraba ~$9M de toda la empresa). Se importó y aplicó `filterByPlanta` del módulo de efectivo para que los totales cuadren con los que muestra ese módulo. Ahora solo muestra los recibos de la planta seleccionada en el selector global.
- **Horas estimadas:** 0.25 hrs

#### 🐛 Fix — Caja Chica: entradas solo cuentan recibos realmente entregados
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** `totalEfectivoEntradas` sumaba TODOS los recibos incluyendo los que aún no han sido abonados. Se agregó filtro `r.entregado === true` para solo contar el efectivo que ya fue físicamente entregado a la empresa. Esto alinea la lógica con la del módulo de efectivo.
- **Horas estimadas:** 0.25 hrs

### 2026-11-12 (sesión 7)

#### ✨ Mejora — Caja Chica: alineación con Excel existente (CAJA CHICA.xlsx)
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`, `components/Sidebar.tsx`, `lib/auth.ts`
- **Descripción:** Se revisó el Excel de trabajo actual y se alinearon los campos para que no se pierda ninguna columna:
  - **"Responsable" → "Entrega"**: renombrado en form, tabla, modal de rechazo y buscador (igual al Excel)
  - **"Tipo Comprobante" dropdown → "Soporte" SI/NO**: simplificado igual que el Excel (no dropdown largo)
  - **"No. Comprobante" → "No. Ticket"**: renombrado para coincidir con columna Excel
  - **Columna SOBRANTE**: agregada a la tabla — saldo corriente calculado tras cada gasto aprobado (rojo si negativo)
  - CSV de exportación actualizado: cabeceras ENTREGA, SOPORTE, NO.TICKET igual que el Excel
  - Sidebar: módulo Caja Chica agregado a sección Operaciones (antes no aparecía = "sale bloqueado")
  - auth.ts: `/operaciones/caja-chica` agregado al catálogo de módulos y permisos por defecto
- **Horas estimadas:** 0.75 hrs

### 2026-11-12 (sesión 6)

#### ✨ Mejora — Caja Chica: rastreo profesional completo
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Rewrite completo con trazabilidad total de dinero:
  - **Timestamps en gastos**: `creadoEn` (ISO) se guarda al registrar; `aprobadoEn` + `aprobadoPor` al aprobar; `rechazadoEn` + `rechazadoPor` + `motivoRechazo` al rechazar
  - **Botón Rechazar** en gastos en revisión: abre modal con campo motivo (obligatorio), cambia estado a "Rechazado", queda registrado en Firestore con trazabilidad completa
  - **Folios secuenciales por caja/mes**: formato `{PREFIX}-{YYMMM}-{NNN}` (ej. `ALL-2611-001`) en lugar de timestamp
  - **Filtros de fecha** (Desde / Hasta) en la barra de filtros, con botón para limpiar; filtra por ISO de la fecha del gasto
  - **Arqueo de caja**: tarjeta KPI clickable que expande panel; input para efectivo físico contado; calcula diferencia vs saldo sistema con badge verde (cuadra) o rojo (faltante/sobrante)
  - **Exportar CSV**: botón en la barra superior y en el encabezado de la tabla; incluye todos los campos de rastreo (creadoEn, aprobadoEn, motivoRechazo); BOM UTF-8 para acentos
  - **KPI "Rechazados"**: nueva tarjeta junto a En revisión y Aprobados; clickable para filtrar
  - **Totales en pie de tabla**: fila tfoot con suma de montos de los gastos filtrados
  - **Columna de estado mejorada**: muestra fecha de aprobación (mes corto) y motivo de rechazo truncado con tooltip
  - **Filtro "Rechazado"** agregado al dropdown de estado
- **Horas estimadas:** 2 hrs

### 2026-11-12 (sesión 5)

#### 🐛 Bug — Nómina timbrado: payload incorrecto para API Facturama multiemisor
- **Archivos:** `app/api/facturama/timbrar-nomina/route.ts`, `lib/facturama.ts`, `app/(dashboard)/recursos-humanos/nomina/page.tsx`
- **Descripción:** El endpoint y la estructura del payload de nómina eran incorrectos. Se identificaron y corrigieron 7 errores:
  1. Endpoint `/api/3/cfdis` → `/api-lite/3/cfdis` (igual que facturas regulares)
  2. Faltaba `NameId: "16"` (identificador Facturama para nómina)
  3. `Payroll:` directo → `Complemento: { Payroll: { ... } }`
  4. `Earnings: [...]` → `Perceptions: { Details: [...] }` con `PerceptionType`, `Code`
  5. `Deductions: [...]` → `Deductions: { Details: [...] }` con `DeduccionType`, `Code`
  6. Faltaba `OtherPayments: [{ OtherPaymentType: "002", EmploymentSubsidy: {...} }]` (obligatorio SAT para RegimeType "02")
  7. `PaymentForm: "99"` → eliminado (nómina no lleva forma de pago)
  8. Corregido mapeo de periodicidades: quincenal "03"→"04", mensual "04"→"05"
  9. Nuevos campos agregados al payload: `curpEmisor`, `registroPatronal`, `subsidioEmpleo`, `salarioDiario`, `salarioBase`, `fechaInicioLaboral`, `Folio` (timestamp)
  10. `EmisorFm` ampliado con `curp` y `registroPatronal`
- **Estado:** Estructura verificada en sandbox. Validación final pendiente con RFC real de empleado (SAT valida l_RFC contra catálogo activo incluso en sandbox).
- **Horas estimadas:** 2.5 hrs

### 2026-11-11 (sesión 4)

#### ✨ Mejora — Caja Chica: arquitectura completa con caja principal y cajas chicas dinámicas
- **Archivos:** `app/(dashboard)/operaciones/caja-chica/page.tsx`, `lib/db.ts`
- **Descripción:** Rewrite completo del módulo con arquitectura de fondos:
  - **Caja Principal**: saldo calculado de forma automática como `entradas efectivo − salidas efectivo − distribuido a cajas chicas`
  - **Cajas chicas dinámicas**: admin crea, edita y desactiva cajas; nombre, planta y responsable libres
  - **Distribución de fondos**: desde la caja principal se distribuye dinero a cada caja chica con trazabilidad (fecha, concepto, autoriza)
  - **Tabs de cajas**: la caja principal + cada caja chica como tab, con saldo visible en el tab
  - **Resumen en principal**: tabla con todas las cajas, recibido/gastado/saldo por caja y link a su detalle
  - **Historial de distribuciones**: tabla cronológica de movimientos en la vista principal
  - **Formulario funcional**: todos los campos con inputs libres (monto, descripción, responsable)
  - **Botón Aprobar operativo**: actualiza estado en Firestore
  - Nuevas colecciones Firestore: `cajasConfig`, `cajasDistribuciones`
- **Horas estimadas:** 2.5 hrs

### 2026-11-10 (sesión 3)

#### ✨ Mejora — Reportes: M³ por tipo de entrega con costo total
- **Archivo:** `app/(dashboard)/reportes/page.tsx`
- **Descripción:** La card "M³ por tipo de entrega" ahora incluye una mini tabla debajo de la gráfica con columnas: Tipo · M³ · Pedidos · Total ($). Permite ver de un vistazo cuánto se factura por entrega directa vs bomba.
- **Horas estimadas:** 0.5 hrs

#### 🐛 Bug — Programación Ventas: filtro de días no aplicaba a la tabla de pedidos
- **Archivo:** `app/(dashboard)/ventas/programacion/page.tsx`
- **Descripción:** `pedidosFiltrados` (la tabla principal "Todos mis pedidos") ignoraba el `diaActivo`. Al cambiar el día con ← →, la tabla no se actualizaba. Ahora filtra primero por `diaActivo` y luego por búsqueda de texto.
- **Horas estimadas:** 0.25 hrs

#### ✨ Mejora — CRM Pipeline: cierre de oportunidades (Ganado/Perdido)
- **Archivo:** `app/(dashboard)/crm/pipeline/page.tsx`, `lib/crmPipeline.ts`
- **Descripción:** Implementado sistema de cierre tipo CRM profesional:
  - Cada card muestra botones "Ganada" (verde) y "Perdida" (rojo)
  - Modal de confirmación con campo de motivo de pérdida (opcional)
  - Toggle "Ver cerradas" para acceder al historial de oportunidades cerradas
  - Vista de cerradas: lista con estado, motivo, valor y botón "Reactivar"
  - KPIs ampliados: Pipeline, Ponderado, M³, En cierre, Ganadas ($), Perdidas (count)
  - Campo `estado?: "activo" | "ganado" | "perdido"` + `fechaCierre` + `motivoPerdida` en el modelo
- **Horas estimadas:** 2 hrs

#### ✨ Mejora — Recibos de Concreto: selector de tamaño de hoja (completa / media)
- **Archivo:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`
- **Descripción:** Toggle "Hoja completa / Media hoja" en el encabezado del módulo. Media hoja imprime en 5.5 × 8.5 pulgadas (portrait), hoja completa en letter landscape. El ancho del layout de impresión se ajusta automáticamente (980px → 520px para media hoja).
- **Horas estimadas:** 0.5 hrs

#### ✨ Mejora — Recibos de Concreto: envío de PDF adjunto por WhatsApp
- **Archivo:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`
- **Descripción:** El botón WhatsApp ahora genera un PDF real del recibo usando html2canvas + jsPDF y lo envía como adjunto:
  - En móvil (iOS/Android): abre el share nativo del sistema con el PDF adjunto
  - En escritorio sin soporte nativo: descarga el PDF automáticamente y abre WhatsApp Web con el mensaje de texto + nota para adjuntar el PDF descargado
  - Respeta el tamaño de hoja seleccionado (completa o media hoja)
- **Horas estimadas:** 1.5 hrs

### 2026-11-10 (sesión 2)

#### ✨ Mejora — CXC y CXP: paginación SAP y filtro por mes actual
- **Archivo:** `components/finanzas/SatAccountsPage.tsx`
- **Descripción:**
  - El filtro de mes ahora arranca en el **mes actual** (antes era "Todos") — reduce el volumen inicial de datos mostrados de forma dramática
  - Añadido selector de **filas por página**: 25 / 50 / 100 / Todos (default: 50)
  - Añadido **pie de paginación estilo SAP**: "1–50 de 240 registros · Página 1 / 5" con botones ← →
  - La página se reinicia a 1 automáticamente al cambiar cualquier filtro
  - El mes actual siempre aparece como opción en el selector de mes (aunque no tenga registros aún), para que el dropdown muestre el valor correcto
- **Impacto:** La tabla que antes renderizaba todos los registros de todos los tiempos ahora muestra solo los 50 más recientes del mes en curso → carga significativamente más rápida
- **Horas estimadas:** 1 hr

### 2026-11-10

#### ✨ Mejora — Programación Ventas: nuevos campos y mejoras de captura
- **Archivo:** `app/(dashboard)/ventas/programacion/page.tsx`
- **Descripción:**
  - Campo "Para qué es el pedido" con chips (Losa, Cimentación, Columnas, Trabe, Muro, Firme, Otro) + texto libre
  - Campo M³ vacíos junto a M³ solicitados (para seguimiento de metros no entregados)
  - Campo Tiempo extra ($) en sección Extras — se suma automáticamente al total del pedido
  - Teléfono se autocompleta al seleccionar cliente si ya tiene número registrado en CRM
  - Hora de entrega con indicador visual "(24 hrs)" para evitar confusión AM/PM
- **Horas estimadas:** 2 hrs

#### ✨ Mejora — Inventarios: acceso igualitario por módulo
- **Archivo:** `app/(dashboard)/operaciones/inventario/page.tsx`
- **Descripción:** Los botones "Capturar manualmente", "← Traer stock del mes anterior", "Existencia inicial" y el modal de existencia estaban restringidos a un único email hardcodeado (`SUPERADMIN`). Se eliminó la restricción para que todos los usuarios con acceso al módulo vean las mismas opciones.
- **Impacto:** Usuarios como AZLY ARELY CANTU GUERRERO ahora pueden capturar existencias sin depender del administrador.
- **Horas estimadas:** 0.5 hrs

---

## Noviembre 2026 (inicio de mes)

### 2026-11-03

#### ✨ Mejora — Recibos de Concreto: soporte multi-producto
- **Archivos:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`, `lib/concreteReceipts.ts`
- **Descripción:** Rewrite completo del módulo de recibos. Nuevas capacidades:
  - Múltiples productos por recibo (distintas resistencias y tipos de suministro)
  - Aditivos con dosificación por m³ (impermeabilizante, acelerante, fibra, color)
  - Renglones libres de extras (maniobras, tubería, tiempo extra, etc.)
  - Servicio de bomba con mínimo de m³ configurable
  - Metros vacíos como concepto opcional
  - Impresión profesional: solo muestra secciones con valores (sin $0.00 ni renglones vacíos)
  - 5 condiciones del servicio al pie del recibo
  - Migración automática de recibos antiguos al nuevo formato
- **Horas estimadas:** 8 hrs

#### ✨ Mejora — Recibos de Concreto: ajuste de firma en impresión
- **Archivo:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`
- **Descripción:** Se eliminó la columna "NOMBRE Y FIRMA DE QUIEN ELABORA / RECIBE" del impreso. Se agregó espacio en blanco (height: 36) encima de la línea de firma de conformidad para que haya espacio físico para firmar.
- **Horas estimadas:** 0.25 hrs

#### ✨ Mejora — Reportes: filtros SAP en tabla de detalle de pedidos
- **Archivo:** `app/(dashboard)/reportes/page.tsx`
- **Descripción:** Se reemplazó la interacción "click en gráfica para filtrar" (drill) por filtros dropdown estilo SAP: Cliente, Vendedor, Resistencia, Tipo de suministro. Incluye contador de filtros activos y botón "Limpiar". Los filtros se resetean al cambiar de período o tab.
- **Horas estimadas:** 3 hrs

#### 🔧 Ajuste — Reportes: precio promedio/m³
- **Archivo:** `app/(dashboard)/reportes/page.tsx`
- **Descripción:** Se ajustó el KPI "Precio promedio/m³" para usar `totalIngresos / totalM3`, incluyendo bomba y extras en el cálculo (refleja el ingreso real por m³ despachado).
- **Horas estimadas:** 0.25 hrs

---

## Resumen del período

| Categoría | Cantidad | Horas estimadas |
|---|---|---|
| ✨ Mejoras | 13 | ~24.75 hrs |
| 🔧 Ajustes | 1 | ~0.25 hrs |
| 🐛 Bugs | 4 | ~3.25 hrs |
| **Total** | **18** | **~28.25 hrs** |

---

*Este archivo se actualiza con cada sesión de trabajo.*
