import type { Module } from './module'

export class DependenciaFaltante extends Error {
  constructor(modulo: string, dependencia: string) {
    super(`El modulo "${modulo}" depende de "${dependencia}", que no esta registrado.`)
    this.name = 'DependenciaFaltante'
  }
}

export class CicloDeDependencias extends Error {
  constructor(ciclo: readonly string[]) {
    super(`Ciclo de dependencias entre modulos: ${ciclo.join(' -> ')}.`)
    this.name = 'CicloDeDependencias'
  }
}

type Estado = 'pendiente' | 'visitando' | 'listo'

/** Orden topologico estable: respeta el orden de entrada entre modulos que
 *  no dependen uno del otro, para que el resultado sea reproducible. */
// biome-ignore lint/suspicious/noExplicitAny: el registro es agnostico del tipo de servicios
export function ordenarModulos(modulos: readonly Module<any>[]): Module<any>[] {
  // biome-ignore lint/suspicious/noExplicitAny: idem
  const porNombre = new Map<string, Module<any>>()
  for (const modulo of modulos) porNombre.set(modulo.name, modulo)

  const estados = new Map<string, Estado>()
  // biome-ignore lint/suspicious/noExplicitAny: idem
  const ordenados: Module<any>[] = []

  // biome-ignore lint/suspicious/noExplicitAny: idem
  const visitar = (modulo: Module<any>, camino: readonly string[]): void => {
    const estado = estados.get(modulo.name) ?? 'pendiente'
    if (estado === 'listo') return
    if (estado === 'visitando') throw new CicloDeDependencias([...camino, modulo.name])

    estados.set(modulo.name, 'visitando')
    for (const dependencia of modulo.dependencies) {
      const siguiente = porNombre.get(dependencia)
      if (!siguiente) throw new DependenciaFaltante(modulo.name, dependencia)
      visitar(siguiente, [...camino, modulo.name])
    }
    estados.set(modulo.name, 'listo')
    ordenados.push(modulo)
  }

  for (const modulo of modulos) visitar(modulo, [])
  return ordenados
}
