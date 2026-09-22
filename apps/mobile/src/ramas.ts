// apps/mobile/src/ramas.ts — el gemelo de apps/web/src/ramas.ts.

import type { Rama } from '@gps/estructura/dominio'

/** El color de rama escrito entero, no armado con plantilla: Tailwind lee las
 *  clases del fuente y una interpolada nunca se genera.
 *
 *  USO ÚNICO, como dice la guía: el punto de 8px de una etiqueta gris que
 *  lleva el nombre escrito al lado. Nunca fondo de fila ni color de texto. */
export const COLOR_DE_RAMA: Record<Rama, string> = {
  castores: 'bg-rama-castores',
  lobatos: 'bg-rama-lobatos',
  scouts: 'bg-rama-scouts',
  raiders: 'bg-rama-raiders',
  rovers: 'bg-rama-rovers',
  adultos: 'bg-rama-adultos',
}
