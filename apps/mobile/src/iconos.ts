// apps/mobile/src/iconos.ts
//
// Los trazos de los iconos, uno por destino del menú. Son los mismos `d` que
// dibuja la web en `apps/web/src/App.tsx`: el menú es el mismo en los dos
// lados y los iconos también. No hay librería de iconos —no vale la pena una
// dependencia para cinco dibujos de una pieza—, así que un icono nuevo es una
// constante con sus trazos.

export const CASA = ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V20h13V9.5'] as const

export const LISTA = ['M9 6h11M9 12h11M9 18h11', 'M4.5 6h.01M4.5 12h.01M4.5 18h.01'] as const

export const CARPA = ['M12 3.5 3 20.5h18L12 3.5Z', 'M12 11.5 7.5 20.5h9L12 11.5Z'] as const

export const GENTE = [
  'M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  'M2.5 20v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1',
  'M16.5 5.3a3.5 3.5 0 0 1 0 6.4M17 15.2a4 4 0 0 1 4.5 3.8V20',
] as const

export const MONEDA = [
  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  'M12 6.5v11M14.6 9.6A2.7 2.7 0 0 0 12 8.2c-1.4 0-2.5.8-2.5 1.9s1.1 1.9 2.5 1.9 2.5.8 2.5 1.9-1.1 1.9-2.5 1.9a2.7 2.7 0 0 1-2.6-1.4',
] as const

/** Abre, cierra y lleva adelante. Rotado 90° es el que apunta abajo. */
export const CHEVRON = ['m9 18 6-6-6-6'] as const
