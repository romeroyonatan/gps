/// <reference types="nativewind/types" />

// nativewind/types sólo tipa la prop `className`; con verbatimModuleSyntax
// (tsconfig.base.json) el import de solo efecto de global.css en _layout.tsx
// necesita esta declaración ambiental para no romper el chequeo de tipos.
declare module '*.css'
