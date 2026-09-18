/** Los .sql que genera drizzle-kit se importan como texto, no como modulo.
 *  Sin esta declaracion tsc no sabe que tipo tienen. */
declare module '*.sql' {
  const contenido: string
  export default contenido
}
