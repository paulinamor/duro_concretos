# Bitácora de Cambios — Duro Concretos ERP

> Registro de modificaciones para justificación de horas de mantenimiento.
> Categorías: 🐛 Bug/Error · ✨ Mejora · 🔧 Ajuste

---

## Noviembre 2026

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
| ✨ Mejoras | 9 | ~17.25 hrs |
| 🔧 Ajustes | 1 | ~0.25 hrs |
| 🐛 Bugs | 1 | ~0.25 hrs |
| **Total** | **11** | **~17.75 hrs** |

---

*Este archivo se actualiza con cada sesión de trabajo.*
