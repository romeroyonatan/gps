// packages/diseno/tailwind.js — el mismo vocabulario de `tokens.css`, pero
// para el Tailwind v3 que usa NativeWind. Web no lo usa: v4 mapea los mismos
// nombres con `@theme inline` en `apps/web/src/estilos.css`.
//
// Escala tipográfica: 12 · 13 · 14 · 15 · 17 · 20 · 31 · 46. La de espaciado y
// los radios son los de Tailwind sin tocar — la guía ya está escrita sobre
// ellos (escala de 4, radio 8px = rounded-lg).

const colors = {
  surface: 'var(--surface)',
  'surface-2': 'var(--surface-2)',
  'surface-3': 'var(--surface-3)',
  'surface-4': 'var(--surface-4)',
  ink: 'var(--ink)',
  'ink-muted': 'var(--ink-muted)',
  'ink-faint': 'var(--ink-faint)',
  'ink-inverse': 'var(--ink-inverse)',
  velo: 'var(--velo)',
  line: 'var(--line)',
  'line-strong': 'var(--line-strong)',
  accent: 'var(--accent)',
  'accent-strong': 'var(--accent-strong)',
  'accent-soft': 'var(--accent-soft)',
  'accent-line': 'var(--accent-line)',
  'accent-ink': 'var(--accent-ink)',
  ok: 'var(--ok)',
  'ok-soft': 'var(--ok-soft)',
  warn: 'var(--warn)',
  'warn-soft': 'var(--warn-soft)',
  danger: 'var(--danger)',
  'danger-soft': 'var(--danger-soft)',
  info: 'var(--info)',
  'info-soft': 'var(--info-soft)',
  'rama-castores': 'var(--rama-castores)',
  'rama-lobatos': 'var(--rama-lobatos)',
  'rama-scouts': 'var(--rama-scouts)',
  'rama-raiders': 'var(--rama-raiders)',
  'rama-rovers': 'var(--rama-rovers)',
  'rama-adultos': 'var(--rama-adultos)',
}

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

module.exports = { colors, fontSize }
