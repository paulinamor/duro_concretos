# Changelog — Duro Concretos ERP

Versiones semánticas siguiendo [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.1.0] — 2026-09-25

### Fixed
- CXP: selector de categoría vuelve a `<select>`, filtro usa categorías activas (no lista hardcodeada)
- Seguros: elimina filas fantasma de unidades borradas del catálogo
- Diesel: quita unidades históricas eliminadas del selector del formulario
- Diesel: grupos de unidades por tipo (Revolvedoras, Bombas, Vehículos…) en selectores

### Changed
- Diesel: selector de unidades agrupa por tipo con `<optgroup>` igual que módulo Unidades y Seguros

---

## [1.0.0] — 2026-09-20

### Added
- Módulo Empleados completo: perfil slide-in, foto (Firebase Storage), documentos PDF con nombre personalizado
- Geocercas Samsara integradas al módulo de flota en vivo
- CXP: categorías dinámicas derivadas de registros existentes, nuevas persisten en Firestore sin duplicados
- CXP: dropdown de categoría inline en el listado sin necesidad de abrir la factura

### Fixed
- Build Vercel: `preload: false` en fuentes Google para evitar error de red
- Empleados: duplicados por doble suscripción en Strict Mode
- Empleados: delete optimista restaurado (sin necesidad de refresh)
- Diesel: filtro de unidades solo muestra catálogo activo

---

## [0.9.0] — 2026-08

### Added
- Monitor IA: salud del sistema, errores, integridad de datos, bitácora
- Dev Tools overlay con 6 secciones
- Servicios predictivos y verificación GPS
- Flota en vivo: Google Maps con etiquetas permanentes, rediseño estilo Samsara
- Reportes: drill-down completo con tabs

### Fixed
- Admin ventas, fixes finanzas varios

---

## [0.8.0] — 2026-07

### Added
- Google Maps en configuración/rastreo de viajes
- Firebase Storage: reglas + upload real en pagos
- Asistencia: pase de lista rápido, marcado masivo, resumen por empleado
- KPIs con onClick para filtros en todos los módulos
- Módulo Remisiones: PDF, preview, descarga

### Fixed
- Inventario: siempre carga el mes vigente al entrar

---

## [0.7.0] — 2026-06

### Added
- Facturama multiemisor (CSD por empresa)
- Flujo de autorización para eliminar registros
- Notificaciones reales y permisos granulares por rol
- Módulo Catálogo de Obras: CRUD por cliente, importación automática desde historial
- Cobros: módulo completo con abonos
- Notas de crédito: aplicación a facturas con propagación a anticipo
- Vista Excel CxC/CxP con colores por mes de cobro
- CxC/CxP: editar/revertir abonos individuales, exportar Excel, carga masiva con template
- Estado de cuenta por cliente funcional

---

## [0.6.0] — 2026-05

### Added
- Módulo Facturación CFDI 4.0 con Facturama PAC
- Descarga SAT directa (solicitud, verificación, descarga de paquetes)
- Dev tools en producción (modo admin)
- Vista previa antes de timbrar
- Folio tracker dev-only

### Fixed
- CurrencyExchangeRate en Facturama
- Bancos principales en selector de pago (BANREGIO, BBVA primero)

---

## [0.5.0] — 2026-04

### Added
- Módulo Cobros completo
- Efectivo: salidas de efectivo
- CxC: facturación con métricas y barra de progreso
- Recibos de concreto: rediseño completo con drawer lateral
- Finanzas: filtros multi-select por tipo, estado SAT, receptor y forma de pago
- Abonos con banco/UUID, campo resistencia, folio en carga masiva CxP
- AppSelect en todos los dropdowns del sistema
- Catálogo de puestos en Firestore

---

## [0.4.0] — 2026-03

### Added
- Rediseño completo: Inventarios, Empleados, Mantenimiento de Flota, Programación
- Rastreo con tarjetas expandibles
- Pipeline en Firestore
- Drag-to-scroll en HScrollTable
- Carga masiva CxC/CxP con template Excel

### Fixed
- CxC/CxP: drawer refleja cambios en tiempo real
- Varios errores de undefined en escrituras Firestore

---

## [0.3.0] — 2026-02

### Added
- Multi-planta: Pesquería y Allende con etiquetado y filtrado por planta
- Módulo Seguros de flota completo (todos los campos del Excel)
- Programación con múltiples choferes por registro y cálculos automáticos
- Catálogo de operadores y unidades vinculados
- Diesel: filtro de fechas con rango
- Módulo Mantenimiento de Flota

### Fixed
- Fórmulas de programación (m3, Total x M3, Total General)
- Eliminación de datos mock, todos los módulos conectados a Firestore

---

## [0.2.0] — 2026-01

### Added
- CxC/CxP: campos completos del Excel DURO E-2026, carga masiva, edición y borrado
- Diesel: todos los campos del Excel, totales en historial
- Módulos: Operadores, Unidades, CRM Clientes
- Reportes funcionales con Firestore
- Inventarios: remisiones como salidas, existencia inicial como entrada

### Changed
- Diseño light mode por defecto: sidebar oscuro, contenido claro
- Formularios rediseñados con acento #CC2229

---

## [0.1.0] — 2025-12

### Added
- Bootstrap inicial con Next.js App Router + TypeScript + Tailwind CSS
- Firebase Auth + Firestore como backend
- Módulos base: Dashboard, Programación, Usuarios
- Soporte multi-rol (superadmin, admin, operador)
- Design system: Manrope, KPICard, StatusBadge

---

> Formato: `MAJOR.MINOR.PATCH` — MAJOR = cambio de arquitectura, MINOR = nueva funcionalidad, PATCH = fix.
