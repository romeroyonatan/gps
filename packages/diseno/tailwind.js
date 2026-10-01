// packages/diseno/tailwind.js — el mismo vocabulario de `tokens.css`, pero
// para el Tailwind v3 que usa NativeWind. Web no lo usa: v4 mapea los mismos
// nombres con `@theme inline` en `apps/web/src/estilos.css`.
//
// Escala tipográfica: 12 · 13 · 14 · 15 · 17 · 20 · 31 · 46. La de espaciado y
// los radios son los de Tailwind sin tocar — la guía ya está escrita sobre
// ellos (escala de 4, radio 8px = rounded-lg).

const fs = require('node:fs')
const path = require('node:path')

/** Las variables de un selector de `tokens.css`, leídas del archivo en vez de
 *  copiadas acá: la paleta tiene un solo lugar donde vive. */
function variablesDe(selector) {
  const css = fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8')
  const bloque = css.match(new RegExp(`\\n${selector}\\s*\\{([^}]*)\\}`))
  if (!bloque) throw new Error(`tokens.css no tiene un bloque ${selector}`)
  return Object.fromEntries(
    bloque[1]
      .split(';')
      .map((linea) => linea.replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter((linea) => linea.startsWith('--'))
      .map((linea) => {
        const corte = linea.indexOf(':')
        return [linea.slice(0, corte).trim(), linea.slice(corte + 1).trim()]
      }),
  )
}

/** El modo oscuro de NativeWind.
 *
 *  Las variables de `.dark` tienen que quedar DESPUÉS del bloque que Tailwind
 *  emite con `--css-interop-darkMode`, y el `@import` de `tokens.css` queda
 *  siempre antes: leído desde ahí, el teléfono se quedaba en claro con el
 *  aparato en oscuro. Este plugin vuelve a emitir el mismo bloque como
 *  utilidad, que es lo que lo corre al final. Los valores salen del mismo
 *  archivo, así que sigue habiendo una sola paleta.
 *
 *  Web no lo usa: Tailwind v4 lee `tokens.css` directo y ahí no hay problema
 *  de orden. */
const variablesOscuras = ({ addUtilities }) =>
  addUtilities({ '.dark:root': variablesDe('\\.dark:root,\\s*\\.dark') })

const colors = Object.fromEntries(
  Object.keys(variablesDe(':root')).map((variable) => [variable.slice(2), `var(${variable})`]),
)

const fontSize = {
  xs: ['12px', '1.4'],
  label: ['13px', '1.4'],
  sm: ['14px', '1.45'],
  base: ['15px', '1.5'],
  lg: ['17px', '1.35'],
  xl: ['20px', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
  '2xl': ['31px', { lineHeight: '1.1', letterSpacing: '-0.035em' }],
  '3xl': ['46px', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
}

module.exports = { colors, fontSize, variablesOscuras }
