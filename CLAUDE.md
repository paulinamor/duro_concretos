@AGENTS.md

# Duro Concretos ERP — Reglas de diseño

## Tema de color

- **Páginas / fondo:** `bg-[#1A1A1A]` (oscuro)
- **Cards / filas:** `bg-[#242424]` o `bg-[#2A2A2A]`
- **Paneles de detalle expandidos dentro de cards:** `bg-white` con `border-t border-gray-100`
- **Drawers laterales:** `bg-white border-l border-gray-200`

## Regla crítica — secciones expandidas

Las secciones de detalle que se expanden dentro de un card oscuro (como el timeline de eventos en Mantenimiento) deben usar **fondo blanco**, NO fondo oscuro. Esto evita el efecto "doble dark mode" donde el contenido queda ilegible o con bajo contraste.

```tsx
// ✅ Correcto
<div className="border-t border-gray-100 bg-white px-5 py-1">

// ❌ Incorrecto
<div className="border-t border-[#3A3A3A] bg-[#1D1D1D] px-5 py-1">
```

Dentro de estas secciones blancas, usar colores de texto oscuros:
- Texto principal: `text-gray-900`
- Texto secundario: `text-gray-500`
- Texto deshabilitado/done: `text-gray-400`
- Bordes de filas: `border-gray-100`
- Badges: usar variantes `-50` de fondo y `-600`/`-700` de texto (ej. `bg-blue-50 text-blue-600 border-blue-200`)

## Color de marca

`#CC2229` — usar para botones primarios, acciones principales, badges de acción.
