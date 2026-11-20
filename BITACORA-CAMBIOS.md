# Bitácora de Cambios — Duro Concretos ERP

> Registro de modificaciones para justificación de horas de mantenimiento.
> Categorías: 🐛 Bug/Error · ✨ Mejora · 🔧 Ajuste

---

## Noviembre 2026

### 2026-11-20 (sesión 20-b) — 🐛 Cobros: spinner infinito en cuentas con primer login reciente

#### 🐛 Bug — Cobros (y cualquier módulo) se quedaba cargando indefinidamente en primer login
- **Archivos:** `lib/firebase.ts`, `lib/db.ts`, `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Dos bugs independientes que producían el mismo síntoma. Bug A (login directo con token frío): race condition de Firebase Auth — `subscribeToCollection` y `getCollectionDocs` arrancaban antes de que `onAuthStateChanged` confirmara la sesión; Firestore veía `request.auth = null` y rechazaba. Solución: exportar `authReady` desde `lib/firebase.ts` (promesa que resuelve en el primer disparo de `onAuthStateChanged`); ambas funciones ahora la esperan. Bug B (impersonación): la línea `checkDone()` vivía DESPUÉS del `setPagos(...sort(...))` — si algún pago tenía `fecha: null`, el sort lanzaba un error silenciado y `loadedPagos` quedaba en false para siempre; con la cuenta de Allende afectaba documentos distintos a los de Pesquería. Solución: mover todos los `checkDone()` ANTES de la línea que procesa datos, y usar `?? ""` en todos los sorts para que un campo null no tire.
- **Horas estimadas:** 0.8 hrs

---

### 2026-11-20 (sesión 20-a) — 🐛 Programación ventas: folios duplicados y planta incorrecta

#### 🐛 Bug — `getCapturePlanta()` usaba planta de perfil en vez de selección activa del header
- **Archivo:** `lib/auth.ts`
- **Descripción:** `getCapturePlanta()` revisaba primero `session.planta` (planta del perfil del usuario) antes de `session.plantaActiva` (selección del header). Esto hacía que todos los documentos se guardaran con la planta del perfil aunque el usuario hubiera cambiado la planta activa en el selector del header. Se simplificó la función para usar directamente `getActivePlanta()`, que ya tiene la prioridad correcta: `plantaActiva ?? planta ?? "Todas"`.
- **Horas estimadas:** 0.3 hrs

#### 🐛 Bug — Folios duplicados en programaciones de ventas (race condition)
- **Archivos:** `lib/db.ts`, `app/(dashboard)/ventas/programacion/page.tsx`
- **Descripción:** `generarFolio(allProgs)` usaba el snapshot local de React (limitado a 400 docs y potencialmente desactualizado) para calcular el siguiente número de folio. Con dos usuarios guardando simultáneamente, ambos veían el mismo máximo y generaban el mismo folio. Se reemplazó por `nextFolioProgramacion()` en `lib/db.ts`: usa una transacción Firestore atómica sobre el documento `counters/programaciones-{año}` que incrementa y devuelve el siguiente número sin condición de carrera. En el primer uso (cuando el contador no existe), la función consulta el folio máximo existente en Firestore para inicializar el contador desde ahí y no reiniciar desde 1.
- **Horas estimadas:** 0.8 hrs

---

### 2026-11-19 (sesión 19-q) — ✨ Dev Tools: tester de notificaciones

#### ✨ Mejora — Enviar notificaciones de prueba desde Dev Tools
- **Archivo:** `app/(dashboard)/dev/page.tsx`
- **Descripción:** Se agregó una nueva tarjeta "Tester de notificaciones" en la pestaña Herramientas de `/dev`. Permite seleccionar destinatario (todos o un usuario específico por email), tipo de notificación, título y detalle. Al disparar, escribe documentos reales en la colección `notificaciones` de Firestore que el header del destinatario recibe en tiempo real vía la campana. Útil para verificar que el sistema de notificaciones de autorizaciones funciona correctamente.
- **Horas estimadas:** 0.3 hrs

---

### 2026-11-19 (sesión 19-p) — ✨ Caja Chica: control de acceso por rol

#### ✨ Mejora — Operadores solo ven y operan su propia caja
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Se implementó restricción completa por rol. Operadores: solo ven cajas asignadas a su email (se eliminó el filtro que mostraba cajas sin responsable), arrancan directo en su caja (no en Principal), no ven tab Principal, no ven botones Nueva caja / Distribuir / Devolver / Transferir / Settings. Solo pueden registrar gastos y exportar CSV. Admins: comportamiento sin cambios, ven todo.
- **Horas estimadas:** 0.5 hrs

---

### 2026-11-19 (sesión 19-o) — 🐛 Caja Chica: modal Transferir tenía el mismo bug que Devolver

#### 🐛 Bug — Modal "Transferir" no procesaba los valores del formulario
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Mismo bug que Devolver: `FormModal` guarda valores con la clave `"Caja destino *"` / `"Monto *"` (textContent incluye el span *), pero el handler leía `values["Caja destino"]` y `values.Monto` → undefined → monto=0 → salía sin hacer nada. Se reemplazó por modal controlado con estado React propio, preview en tiempo real (quedaría X, destino recibirá Y), select nativo para caja destino, validaciones antes del write, Firestore write antes del setState, try/catch.
- **Horas estimadas:** 0.5 hrs

---

### 2026-11-19 (sesión 19-n) — 🐛 Caja Chica: tab mostraba total recibido en vez de saldo real

#### 🐛 Bug — Chip del tab mostraba monto recibido, no saldo disponible
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** El chip de cada caja calculaba `rec - gas` (distribuciones menos gastos aprobados) pero no restaba `salidasCaja` (devoluciones ni transferencias). La fórmula correcta es `rec - gas - outs`, igual que `saldoCaja`.
- **Horas estimadas:** 0.1 hrs

---

### 2026-11-19 (sesión 19-m) — 🐛 Caja Chica: devolución a caja principal no funcionaba

#### 🐛 Bug — Modal "Devolver fondos" no procesaba el monto
- **Archivo:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** El modal usaba `FormModal` con inputs sin `name` attr. `FormModal` lee valores por texto de `<label>`, así que la clave era `"Monto a devolver *"` pero `handleDevolver` leía `values.Monto` (undefined → 0 → retornaba sin hacer nada). Se reemplazó por modal controlado con estado React propio. Ahora muestra preview en tiempo real (saldo actual / a devolver / quedaría), valida antes de guardar, y el Firestore write ocurre antes de actualizar el state.
- **Horas estimadas:** 0.5 hrs

---

### 2026-11-19 (sesión 19-l) — ✨ Notificaciones en solicitudes de autorización

#### ✨ Mejora — Todas las solicitudes de autorización notifican a los autorizadores
- **Archivos:** `lib/notificaciones.ts` (nuevo), `crm/clientes`, `finanzas/cobros`, `operaciones/inventario`, `ventas/programacion`, `transporte/programacion`
- **Descripción:** Se creó la función helper `notificarAutorizadores()` centralizada. Ahora cuando cualquier usuario genera una solicitud (nuevo cliente, editar pago, editar inventario, eliminar programación), todos los usuarios con `canAuthorize: true` reciben automáticamente una notificación en el bell del Header con link directo a Configuración > Autorizaciones. Transporte ya tenía la lógica inline; se migró al helper centralizado.
- **Horas estimadas:** 1 hr

---

### 2026-11-19 (sesión 19-k) — 🐛 Auditoría: manejo de errores en handlers críticos

#### 🐛 Bug — Cobros: `handleEliminar` sin catch ni toast de éxito
- **Archivo:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** El handler usaba `try/finally` pero sin `catch`, por lo que un error en Firestore se propagaba silenciosamente sin notificar al usuario. Se agregó bloque `catch` con toast de error y toast de éxito al completar.
- **Horas estimadas:** 0.2 hrs

#### 🐛 Bug — Cobros: `handleAprobarpagosol` sin try/catch
- **Archivo:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Handler de aprobación de solicitudes de pago sin manejo de errores. Se envolvió en try/catch con toast de error.
- **Horas estimadas:** 0.1 hrs

#### 🐛 Bug — Cobros: `handleMergeClientes` sin try/catch ni toast
- **Archivo:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Unificación de clientes sin manejo de errores ni confirmación visual de éxito. Se agregó try/catch y toasts de éxito/error.
- **Horas estimadas:** 0.1 hrs

#### 🐛 Bug — Transporte Programación: `handleDeleteConfirmado` actualizaba estado antes del write
- **Archivo:** `app/(dashboard)/transporte/programacion/page.tsx`
- **Descripción:** El state se eliminaba antes de completar el `deleteDocument`. Si el write fallaba, la programación desaparecía de la UI sin ser eliminada en Firestore. Se corrigió el orden y se agregó try/catch.
- **Horas estimadas:** 0.2 hrs

#### 🐛 Bug — CRM Clientes: `handleDelete` sin try/catch, sin toast, estado antes del write
- **Archivo:** `app/(dashboard)/crm/clientes/page.tsx`
- **Descripción:** Eliminación de cliente sin manejo de errores, sin feedback al usuario y con state actualizado optimistamente antes del write. Se corrigió el orden y se agregó try/catch con toasts.
- **Horas estimadas:** 0.2 hrs

#### 🐛 Bug — Ventas Programación: `syncClienteM3` sin try/catch
- **Archivo:** `app/(dashboard)/ventas/programacion/page.tsx`
- **Descripción:** La sincronización de m³ acumulados del cliente se llamaba como fire-and-forget sin manejar errores. Se agregó try/catch para no romper silenciosamente la actualización.
- **Horas estimadas:** 0.1 hrs

---

### 2026-11-19 (sesión 19-j) — 🐛 Configuración: aprobar editar_pago ahora aplica el cambio

#### 🐛 Bug — Configuración > Autorizaciones: aprobación de pagos no aplicaba el cambio
- **Archivo:** `app/(dashboard)/configuracion/page.tsx`
- **Descripción:** Las solicitudes de tipo `editar_pago` aparecían en Configuración con el label "Edición de inventario" y al aprobarlas desde ahí solo se marcaban como "aprobada" sin modificar el pago en Firestore. Se agregó el caso `editar_pago` al handler de aprobación, se corrigió el label a "Edición de pago" y se añade el desglose de campos cambiados (fecha, monto, tipo).
- **Horas estimadas:** 0.5 hrs

---

### 2026-11-19 (sesión 19-i) — ✨ Programación: buscador en vista tabla + folio visible

#### ✨ Mejora — Programación: buscador por folio/cliente/vendedor en vista tabla
- **Archivos:** `app/(dashboard)/transporte/programacion/page.tsx`, `ExcelView.tsx`
- **Descripción:** Se agregó un campo de búsqueda en las vistas Día/Semana/Mes/Rango (igual al de Rastreo de viajes). Filtra por folio de programación, cliente, vendedor o dirección. También se muestra el folio (ej. PROG-2026-0518) debajo de la fecha en la columna DÍA de la tabla.
- **Horas estimadas:** 0.5 hrs

---

### 2026-11-19 (sesión 19-h) — 🐛 Cobros: orden correcto de coladas y remisiones

#### 🐛 Bug — Cobros: remisiones del cliente ordenadas por fecha correcta
- **Archivo:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Las remisiones en el estado de cuenta de un cliente se ordenaban con `localeCompare` sobre fechas en formato `DD/MM/YYYY`, lo que producía orden lexicográfico incorrecto (ej. marzo aparecía antes que septiembre). Se reemplazó por comparación de timestamps parseando el formato DD/MM/YYYY.
- **Horas estimadas:** 0.25 hrs

#### 🔧 Ajuste — Cobros: coladas pendientes ordenadas más recientes primero
- **Archivo:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** En el formulario Nuevo Pago y el detalle de pago, las coladas pendientes se mostraban en orden ascendente (más antiguas primero). Ahora se muestran descendentes (más recientes primero) para facilitar la lectura. La lógica de auto-aplicación (FIFO) sigue aplicando de más antigua a más reciente internamente.
- **Horas estimadas:** 0.25 hrs

---

### 2026-11-19 (sesión 19-g) — ✨🐛 Cobros: reconciliación de abonos + solicitudes globales

#### ✨ Mejora — Herramienta de reconciliación de abonos (superadmin)
- **Archivos:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Función `handleReconciliarAbonos` que recalcula `montoPagado` de cada programación sumando los abonos reales de todos los pagos. Detecta discrepancias (ej. residuales de $0.59 de distribuciones antiguas) y las corrige en Firestore. Botón "Reconciliar datos" visible en el landing del módulo solo para superadmin. Permite corregir todos los clientes en un solo clic.
- **Horas estimadas:** 0.5 h

#### ✨ Mejora — Solicitudes de edición de pagos en landing global
- **Archivos:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Panel en el landing del módulo (sin cliente seleccionado) que muestra todas las solicitudes de edición pendientes con aprobar/rechazar, sin necesidad de navegar al tab Pagos de cada cliente. Se complementa con la carga inicial desde Firestore (fix anterior).
- **Horas estimadas:** 0.25 h

---

### 2026-11-19 (sesión 19-f) — 🐛🐛 Cobros: auto-asociar abonos + cargar solicitudes pendientes

#### 🐛 Bug — Coladas seleccionadas al crear pago se ignoraban
- **Archivos:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Al crear un pago, el usuario seleccionaba coladas pendientes y el sistema las descartaba (guardaba `abonos: []`). Ahora `handleSave` auto-distribuye el monto entre las programaciones seleccionadas en orden (más antigua a más reciente), actualiza `montoPagado` en cada una y guarda los abonos correctamente. Se propagó `progUpdates` al padre para actualizar `progs` sin esperar la suscripción.
- **Horas estimadas:** 0.5 h

#### 🐛 Bug — Pagos anteriores sin asociar: banner de recuperación
- **Archivos:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Pagos registrados antes del fix (con `abonos: []`) muestran un banner amarillo "Pago sin asociar a coladas" con botón "Aplicar automáticamente". Al hacer clic, `handleAutoAplicar` distribuye el saldo del pago en las coladas pendientes del cliente (mismo algoritmo que la creación) y persiste en Firestore.
- **Horas estimadas:** 0.25 h

#### 🐛 Bug — Solicitudes de edición de pagos no se cargaban al entrar al módulo
- **Archivos:** `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** `solicitudesPagos` arrancaba vacío y solo se llenaba con solicitudes creadas en la misma sesión. El superadmin no veía solicitudes pendientes de sesiones anteriores. Se agregó `getCollectionDocs` con filtro `tipo === "editar_pago"` en el `useEffect` inicial, filtrando `status === "pendiente"` en cliente.
- **Horas estimadas:** 0.25 h

---

### 2026-11-19 (sesión 19-e) — 🐛 Caja Principal: corregir fórmula totalDistribuido

#### 🐛 Bug — Saldo de Caja Principal inflado por transferencias entre cajas
- **Archivos:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** La fórmula `totalDistribuido` sumaba TODOS los docs en `cajasDistribuciones`, incluyendo entradas de tipo `transferencia_entrada` (movimientos inter-caja). Esto inflaba incorrectamente el total distribuido del principal en el monto de cada transferencia entre cajas, mostrando un saldo de Principal más negativo de lo real. Fix: filtrar `tipo !== "transferencia_entrada"` antes de sumar.
- **Horas estimadas:** 0.25 h

---

### 2026-11-18 (sesión 19-d) — ✨ Cajas Chicas: transferencias, devoluciones, inactivas y edición

#### ✨ Mejora — Transferencia entre cajas chicas
- **Archivos:** `app/(dashboard)/operaciones/caja-chica/page.tsx`, `lib/db.ts`
- **Descripción:** Desde cualquier caja chica (botón "Transferir" en el header) se puede enviar fondos a otra caja con monto, caja destino, concepto, fecha y autorización. Crea una SalidaCaja en la caja origen y una DistribucionCaja de tipo "transferencia_entrada" en la caja destino. Ambas cajas reflejan el movimiento en su saldo y bitácora.
- **Horas estimadas:** 0.5 h

#### ✨ Mejora — Devolución de caja chica a caja principal
- **Archivos:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Botón "Devolver" en el header de cada caja chica. Registra una SalidaCaja de tipo "devolucion_principal" que reduce el saldo de la caja y suma de vuelta al saldo de Caja Principal. El KPI de saldo en Caja Principal ahora muestra la línea de devoluciones.
- **Horas estimadas:** 0.25 h

#### ✨ Mejora — Ver y reactivar cajas desactivadas
- **Archivos:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Tab "Inactivas (N)" en las pestañas de cajas. Al expandir muestra todas las cajas desactivadas con su saldo histórico, planta y responsable. Botón "Reactivar" las devuelve a la vista activa.
- **Horas estimadas:** 0.25 h

#### ✨ Mejora — Editar movimientos (gastos y distribuciones)
- **Archivos:** `app/(dashboard)/operaciones/caja-chica/page.tsx`
- **Descripción:** Botón "Editar" en gastos con estado Revisión (edita fecha, monto, descripción, categoría, no. ticket y autoriza). Botón lápiz en cada fila de la tabla de distribuciones/historial (edita fecha, monto, concepto y autoriza). Cambios persisten en Firestore.
- **Horas estimadas:** 0.5 h

---

### 2026-11-18 (sesión 19-c) — 🐛 Fix SAT Descarga Masiva no funcionaba

#### 🐛 Fix — Descarga SAT nunca enviaba credenciales a las APIs
- **Archivos:** `app/(dashboard)/configuracion/sat-descarga/page.tsx`, `app/(dashboard)/facturacion/page.tsx`, `app/api/sat/solicitar/route.ts`
- **Descripción:** Tres bugs críticos: (1) La página `/configuracion/sat-descarga` cargaba config desde `/api/sat/config-status` que ya solo devuelve `{ok:true}` — nunca obtenía `certB64`/`keyB64`. (2) `handleSolicitar`, `verificar` y `descargarPaquete` no pasaban `certB64`/`keyB64` a las APIs del SAT que los requerían. (3) `DescargaSATTab` en facturación nunca se renderizaba — la tab "Descarga CFDI" solo mostraba la consulta de Facturama. Bonus: validación de `direccion` y `tipo` en `solicitar`. Verificado con 53 tests automatizados (HTTP + lógica).
- **Horas estimadas:** 1 h

---

### 2026-11-18 (sesión 19-b) — ✨ Auto-marcar entregado al capturar remisión

#### ✨ Mejora — Programación se marca "Entregado" automáticamente al guardar con remisión
- **Archivos:** `app/(dashboard)/transporte/programacion/page.tsx`
- **Descripción:** Al guardar una programación desde el drawer "Completar programación", si algún chofer tiene número de remisión capturado y la programación aún no está en fase "Entregado", el sistema la marca automáticamente como entregada y registra entrada en historial. Elimina la necesidad de hacer el paso manual "Marcar como entregado" cuando ya se capturó la remisión de entrega.
- **Horas estimadas:** 0.25 h

---

### 2026-11-18 (sesión 19) — ✨ Calizas CXP en Inventario

#### ✨ Nueva tab "Calizas CXP" en módulo Inventario
- **Archivos:** `lib/db.ts`, `app/(dashboard)/operaciones/inventario/page.tsx`
- **Descripción:** Nuevo módulo de cuentas por pagar a proveedor de calizas. Incluye: (1) campo `precioUnitario` y `costoTotal` en EntradaMaterial — aparece automáticamente al registrar material que contiene "caliz" en almacén; (2) tab "Calizas CXP" con 4 KPIs (toneladas período, costo período, total pagado, saldo pendiente); (3) tabla de entregas filtrada por período; (4) tabla histórica de pagos; (5) drawer "Registrar pago" (fecha, monto, referencia, nota); (6) export a Excel con dos hojas (Entradas + Pagos); (7) nueva colección Firestore `pagosProveedorMat`. Permite cuadrar contra estados de cuenta del proveedor.
- **Horas estimadas:** 2.5 h

---

### 2026-11-17 (sesión 18-b) — Fix: KPI "Total cobrado" en efectivo

#### 🐛 Fix — Total importe efectivo sumaba monto completo del recibo en lugar de lo cobrado
- **Archivos:** `app/(dashboard)/ventas/recibos-concreto/page.tsx`, `app/(dashboard)/efectivo/page.tsx`
- **Descripción:** El sync de recibos-concreto a efectivo guardaba `importe: realTotal` (monto total facturado), pero el KPI sumaba ese total sin considerar que solo el `anticipo` había sido cobrado. Fix: el sync ahora también guarda `montoCobrado: nextReceipt.anticipo ?? 0`. El KPI usa `montoCobrado` para registros de origen concreto y `importe` para registros manuales. KPI renombrado de "Total importe" a "Total cobrado" para mayor claridad.
- **Horas estimadas:** 0.5 h

---

### 2026-11-17 (sesión 18) — Horómetro al estilo TMS profesional

#### ✨ Mejora — Horómetro: validación, referencia histórica y delta automático (SAP/TMS style)
- **Archivos:** `app/(dashboard)/transporte/mantenimiento/page.tsx`
- **Descripción:** El campo Horómetro ahora se comporta como un contador de medición profesional: (1) muestra el último valor registrado para esa unidad como referencia ("Último: 17,876.8 h · 01/10/2026"), (2) calcula y muestra el delta automáticamente ("Δ +245.3 h") cuando el valor es válido, (3) muestra aviso rojo si el valor capturado es menor al último registro, (4) bloquea el guardado si se intenta capturar un horómetro inferior al máximo histórico de esa unidad. `allEventos` se pasa al drawer como prop; `lastHorometroInfo` se calcula con `useMemo` tomando el máximo horómetro registrado para la unidad (excluyendo el registro en edición).
- **Horas estimadas:** 0.5 h

---

### 2026-11-17 (sesión 17) — Audit logs globales + modal confirmación + selector de planta unificado

#### ✨ Mejora — Audit log automático en todas las eliminaciones
- **Archivos:** `lib/db.ts`, `lib/errorLogger.ts`
- **Descripción:** `deleteDocument` ahora guarda automáticamente el documento antes de eliminarlo y registra en `auditLog` (Firestore) con acción, colección, documentId, usuario, planta, timestamp y snapshot `before`. Sin cambios en cada módulo.
- **Horas estimadas:** 1 h

#### ✨ Mejora — Modal de confirmación global para borrar (DeleteProvider)
- **Archivos:** `lib/delete-context.tsx` (nuevo), `app/(dashboard)/layout.tsx`, `app/(dashboard)/transporte/diesel/page.tsx`, `app/(dashboard)/transporte/operadores/page.tsx`, `app/(dashboard)/ventas/productos/page.tsx`, `app/(dashboard)/ventas/obras/page.tsx`, `app/(dashboard)/finanzas/cobros/page.tsx`, `app/(dashboard)/transporte/programacion/page.tsx`
- **Descripción:** Contexto React global `DeleteProvider` con hook `useConfirmDelete`. Todos los módulos ahora piden autorización antes de borrar con un modal dark-theme con botón rojo "Eliminar". Reemplaza los modales inline ad-hoc en cada página.
- **Horas estimadas:** 1.5 h

#### ✨ Mejora — Componente PlantaFilter unificado en todos los módulos
- **Archivos:** `components/PlantaFilter.tsx` (nuevo), `lib/useCollection.ts`, `app/(dashboard)/ventas/recibos-concreto/page.tsx`, `app/(dashboard)/ventas/remisiones/page.tsx`, `app/(dashboard)/transporte/diesel/page.tsx`, `app/(dashboard)/reportes/page.tsx`, `app/(dashboard)/transporte/programacion/page.tsx`, `app/(dashboard)/transporte/mantenimiento/page.tsx`, `app/(dashboard)/operaciones/inventario/page.tsx`, `app/(dashboard)/efectivo/page.tsx`, `app/(dashboard)/finanzas/cobros/page.tsx`
- **Descripción:** Un solo componente de selector Todas/Allende/Pesquería con diseño dark consistente (rojo/azul/verde). Modo controlado (filtro local, sin tocar sesión) y modo uncontrolled (actualiza sesión global). `useCollectionWithLoading` y `useCollection` escuchan `duro:session-updated` para re-filtrar en tiempo real sin recargar. Inventario reemplazó su selector custom; recibos-concreto agrega badge de planta por fila cuando está en "Todas".
- **Horas estimadas:** 2 h

#### 🐛 Fix — Recibo #0086 "desaparecido" (planta incorrecta en filtro)
- **Archivos:** `app/(dashboard)/dev-recover/page.tsx` (nuevo), `lib/auth.ts`
- **Descripción:** Recibo existía en Pesquería pero el usuario tenía filtro Allende activo. Se creó página diagnóstico `/dev-recover` (solo admin) que consulta Firestore directamente. Registrada causa raíz: datos con `planta: "Pesquería"` no visibles en vista Allende.
- **Horas estimadas:** 0.5 h

---

### 2026-11-15 (sesión 16) — Dashboard: KPIs Concreto vs Bomba + indicadores + gráficas + trazabilidad

#### 🐛 Fix — Dashboard: cálculo erróneo de ventas Tiro Directo vs Bombeado
- **Archivos:** `app/(dashboard)/dashboard/page.tsx`
- **Descripción:** Dos iteraciones. Primera: se intentó separar componente precio concreto (precioM3×m3) vs cargo bomba (precioM3Bomba×m3), pero los datos en Firestore tienen precioM3Bomba almacenando el precio COMPLETO del pedido bombeado, no solo el surcharge — resultado incorrecto. Segunda (definitiva): misma lógica que módulo de Reportes — agrupar por tdBom con detección inclusiva `isBomba=(tdBom)=>(tdBom??"").toUpperCase().includes("BOM")`, sumar campo `total` por tipo. Columnas renombradas a "Tiro Directo" / "Bombeado". Ticket = $/m³ por tipo. Verifica automáticamente: Directo+Bombeado=Total.
- **Horas estimadas:** 0.5 h

#### ✨ Mejora — Trazabilidad de datos: dashboard ↔ programación
- **Archivos:** `app/(dashboard)/transporte/programacion/page.tsx`, `app/(dashboard)/dashboard/page.tsx`
- **Descripción:** KPI "Total m³" renombrado a "M³ entregados" y "Total facturado" a "Ventas entregadas" en programación — ahora solo suman fase="Entregado", igual que el dashboard. El subtítulo muestra el total incluyendo pendientes para ver la diferencia. KPI "Ventas mes" del dashboard ahora linkea a programación. Los números del módulo de programación (vista Mes) deben coincidir con los del dashboard.
- **Horas estimadas:** 0.5 h

---

### 2026-11-15 (sesión 16-a) — Dashboard: KPIs Concreto vs Bomba + indicadores + gráficas avanzadas

#### ✨ Mejora — Dashboard: tabla de indicadores del mes (Concreto vs Bomba)
- **Archivos:** `app/(dashboard)/dashboard/page.tsx`
- **Descripción:** Nueva sección "Indicadores del mes" al estilo del sistema externo: tabla con columnas Total, Concreto y Bomba para ventas ($), m³ despachados, promedio diario, tendencia a fin de mes y ticket promedio. Footer muestra % bombeado vs tiro directo y m³ promedio por pedido.
- **Horas estimadas:** 1 h

#### ✨ Mejora — Dashboard: gráfica "Ventas anuales" (año actual vs anterior)
- **Archivos:** `app/(dashboard)/dashboard/page.tsx`
- **Descripción:** Reemplazada la gráfica "Ventas últimos 6 meses" por comparativa anual m³ entregados: año actual (rojo) vs año anterior (gris). La carga de datos se amplió de 6 meses a 2 años para soportar la comparativa.
- **Horas estimadas:** 0.5 h

#### ✨ Mejora — Dashboard: gráficas "Más vendidos" y "Bomba vs Tiro Directo"
- **Archivos:** `app/(dashboard)/dashboard/page.tsx`
- **Descripción:** Nueva sección con dos gráficas: (1) Top 6 mezclas/resistencias por m³ del mes (barras horizontales), (2) Visualización Bomba vs Tiro Directo con barras de progreso, conteo de pedidos, % y resumen de m³ prom/pedido.
- **Horas estimadas:** 0.5 h

---

### 2026-11-15 (sesión 15) — Obras agrupadas por cliente + paginación en módulos pesados

#### ✨ Mejora — Catálogo de Obras: vista agrupada por cliente
- **Archivos:** `app/(dashboard)/ventas/obras/page.tsx`
- **Descripción:** En lugar de mostrar el mismo cliente en cada fila, las obras ahora se agrupan bajo un encabezado por cliente. Cada grupo muestra el nombre del cliente en negrita con un badge del conteo de obras. Las obras dentro del grupo quedan indentadas con solo nombre, dirección y acciones.
- **Horas estimadas:** 1 h

#### ✨ Mejora — Paginación en módulos pesados (Remisiones + Recibos de concreto)
- **Archivos:**
  - `app/(dashboard)/ventas/remisiones/page.tsx`
  - `app/(dashboard)/ventas/recibos-concreto/page.tsx`
- **Descripción:** Implementada paginación SAP-style en los dos módulos con más registros. Footer con selector de filas (25/50/100/200/Todos), contador de registros y controles de página anterior/siguiente. La página se reinicia automáticamente al cambiar filtros.
- **Horas estimadas:** 1.5 h

---

### 2026-11-15 (sesión 14) — Módulo Soporte habilitado + botón flotante + notificación email

#### ✨ Mejora — Módulo Soporte: activación, botón flotante y email
- **Archivos:**
  - `lib/auth.ts`
  - `app/api/soporte/route.ts` (nuevo)
  - `components/SupportFloatingButton.tsx` (nuevo)
  - `app/(dashboard)/layout.tsx`
  - `app/(dashboard)/soporte/page.tsx`
  - `.env.local`
- **Descripción:**
  - `/soporte` agregado a `moduleCatalog` y a `getDefaultModulesForRole()` → ya no aparece bloqueado para operadores
  - Nuevo API route `POST /api/soporte` que envía notificación por email via Resend con HTML estilizado
  - Destinatarios configurables en `SUPPORT_EMAILS` (.env) — por defecto `contacto@lpsoft.mx`; agregar email de Paulina como segundo destinatario
  - `handleNuevoTicket` en página de soporte actualizado para llamar al API route (fire-and-forget)
  - Componente `SupportFloatingButton` — botón circular rojo (auricular) fijo en esquina inferior derecha, visible desde cualquier página excepto `/soporte`
  - Al hacer clic abre el formulario de ticket sobre la pantalla actual con pantalla de éxito ✅
  - Variables documentadas: `RESEND_API_KEY` y `SUPPORT_EMAILS`
- **Horas estimadas:** 2.0 hrs

---

### 2026-11-13 (sesión 13) — Sidebar rediseño + reestructura de módulos

#### ✨ Mejora — Sidebar: diseño JC + nueva estructura de módulos
- **Archivo:** `components/Sidebar.tsx`
- **Descripción:**
  - Rediseño visual basado en el sidebar del proyecto Grupo JC:
    - Gradiente radial rojo-marca en esquina superior izquierda + fade inferior sutil
    - Item activo: `bg-white/[0.09]` + `shadow-[inset...]` (sutil) en lugar de `bg-[#CC2229]` sólido
    - Indicador activo: barra roja lateral izquierda de 3px (igual que JC)
    - User card al pie con avatar de iniciales (gradiente azul→rojo), nombre, rol y botón logout
    - Botón colapsar/expandir con `PanelLeftClose/Open`, estado persistido en `localStorage`
    - Sidebar colapsado: 76px icon-only con tooltips HTML `title`
    - Grupos sin toggle expand/collapse → labels estáticos (más limpio)
    - Ancho: 72 (288px) → 264px
  - **Reestructura de módulos:**
    - Antes: Dashboard+Reportes / Transporte / Administración / Operaciones / CRM / Ventas / Finanzas / Facturación / RRHH / Sistema
    - Después: Inicio (top) / **Programación** (prog. transporte+ventas, recibos, remisiones) / **Transporte** (flota, verificación, unidades, diésel, mantenimiento) / **Ventas & CRM** / **Finanzas** (incluye Facturas CFDI) / **Operaciones** / **RRHH** / **Sistema**
  - Todas las rutas/hrefs existentes conservadas sin cambios
- **Horas estimadas:** 1.5 hrs

---

### 2026-11-13 (sesión 13) — Dashboard rediseño completo

#### ✨ Mejora — Dashboard: tema oscuro + corrección de datos
- **Archivo:** `app/(dashboard)/dashboard/page.tsx`
- **Descripción:**
  - Todos los cards/secciones cambiados de `bg-white` a `bg-[#242424]` para consistencia con el tema oscuro del sistema (antes eran blancos sobre fondo oscuro)
  - Colores de texto: `text-gray-900` → `text-white`, `text-gray-500` → `text-gray-500/400`
  - Bordes: `border-gray-100` → `border-white/10`
  - Badges de estado: variantes light → `bg-*/15 text-*-400` (dark-safe)
  - Gráficas: grid/ejes ajustados para tema oscuro (`stroke="#2a2a2a"`), tooltips con fondo `#1a1a1a`
  - Alerta cartera vencida: `bg-red-50` → `bg-red-500/10`
  - **NETO SIN IVA corregido:** antes usaba campo `incluyeIVA` que casi nunca está marcado → siempre devolvía el mismo valor que Ventas ($0 de IVA). Ahora: `ventasMes / 1.16` (siempre se asume IVA incluido en este negocio)
  - KPI grid reorganizado: de `grid-cols-4` asimétrico → `grid-cols-3` balanceado (Ventas | Cobrado | Por Cobrar / Neto sin IVA | Por Pagar | Flota)
  - Subtítulos más claros: "Por cobrar" = "todos los meses", "Cobrado" = "programaciones marcadas", "IVA 16%: $X" en neto
- **Horas estimadas:** 1.5 hrs

---

### 2026-11-13 (sesión 12) — Bug Permisos OC

#### 🐛 Bug — Permisos OC multiplicaba por m³ cuando debe ser cargo fijo
- **Archivo:** `app/(dashboard)/ventas/programacion/page.tsx`
- **Descripción:** El campo "Permisos OC" estaba incluido en el factor `txm3` que se multiplica por la cantidad de m³, generando totales incorrectos. Se movió a la suma de cargos fijos (junto con `tuberiaExtra` y `tiempoExtraCosto`). También se actualizó el label de "$/m³" a "$" para reflejar que es un cargo fijo.
- **Horas estimadas:** 0.3

---

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
