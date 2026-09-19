/** Lo mínimo para hablar HTTP con un proveedor OIDC: intercambiar el código
 *  por un token y leer su conjunto de claves públicas. Es una interfaz y no
 *  `fetch` a secas para que los tests puedan sustituir a Google y Apple por
 *  proveedores falsos sin red real (ver diseño §9 y tareas 3.4/3.5). */
export interface ClienteHttp {
  postFormulario(url: string, cuerpo: Record<string, string>): Promise<unknown>
  get(url: string): Promise<unknown>
}

/** `fetch` es una API web estándar, no `node:*` ni `bun:*`: no rompe la regla
 *  de portabilidad, y este archivo vive en `/servidor`, que es donde corren
 *  los pedidos salientes reales. */
export function crearClienteHttp(): ClienteHttp {
  return {
    async postFormulario(url, cuerpo) {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(cuerpo),
      })
      if (!respuesta.ok) {
        throw new Error(`El proveedor respondió ${respuesta.status} en ${url}`)
      }
      return respuesta.json()
    },
    async get(url) {
      const respuesta = await fetch(url)
      if (!respuesta.ok) {
        throw new Error(`El proveedor respondió ${respuesta.status} en ${url}`)
      }
      return respuesta.json()
    },
  }
}
