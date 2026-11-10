# Bitácora de Cambios — Duro Concretos ERP

> Registro de modificaciones para justificación de horas de mantenimiento.
> Categorías: 🐛 Bug/Error · ✨ Mejora · 🔧 Ajuste

---

## Noviembre 2026

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
| ✨ Mejoras | 5 | ~12.75 hrs |
| 🔧 Ajustes | 1 | ~0.25 hrs |
| 🐛 Bugs | 0 | — |
| **Total** | **6** | **~13 hrs** |

---

*Este archivo se actualiza con cada sesión de trabajo.*
