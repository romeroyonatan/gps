import type { AmbitoDeCargo, TipoDeCargo } from '@gps/personas/dominio'
import type { Trazos } from './trazos'
import { serializar } from './trazos'

/** Quien tiene que firmar un permiso, y donde buscar a esa persona.
 *
 *  `ambitoId` es la entidad concreta: el grupo del permiso para los dos
 *  primeros, y el distrito de ese grupo para el comisionado. */
export interface FirmanteRequerido {
  readonly cargo: TipoDeCargo
  readonly ambito: AmbitoDeCargo
  readonly ambitoId: string
}

/** Los tres que firman un permiso de salida: el jefe de grupo y el director del
 *  grupo, y el comisionado del distrito al que ese grupo pertenece.
 *
 *  Son tres cargos y no tres personas: quien firma es quien ocupa el cargo el
 *  dia que firma, y eso se resuelve al firmar y no al emitir. Asi un cambio de
 *  comisionado en el medio no deja una firma pendiente a nombre de quien ya no
 *  es comisionado.
 *
 *  Funcion pura y en el dominio porque las pantallas la necesitan igual que el
 *  servidor: la lista de firmas pendientes se dibuja con esto. */
export function firmantesRequeridos(
  grupoId: string,
  distritoId: string,
): readonly FirmanteRequerido[] {
  return [
    { cargo: 'jefeDeGrupo', ambito: 'grupo', ambitoId: grupoId },
    { cargo: 'director', ambito: 'grupo', ambitoId: grupoId },
    { cargo: 'comisionadoDeDistrito', ambito: 'distrito', ambitoId: distritoId },
  ]
}

/** Lo que se sella cuando alguien firma en la app.
 *
 *  Lleva el hash del PDF emitido para que la firma quede atada a ese documento
 *  y no a otro; el cargo y la persona para que dos firmas del mismo permiso no
 *  sean intercambiables; la fecha porque es parte de lo que se afirma; y los
 *  trazos porque son la firma.
 *
 *  Las partes van separadas por `|`, que no aparece en un id ni en una fecha, y
 *  los trazos van al final porque son lo unico que puede contenerlo: asi dos
 *  entradas distintas no pueden producir la misma cadena.
 *
 *  Es puro y vive en el dominio: el HMAC necesita la clave y por eso lo hace
 *  Core, pero que se sella no es un secreto, y el dia que se verifique del lado
 *  del cliente esta mitad ya esta de ese lado. */
export function mensajeASellar(datos: {
  hashDelPdf: string
  cargo: TipoDeCargo
  personaId: string
  fecha: string
  trazos: Trazos
}): string {
  return [
    'firma',
    datos.hashDelPdf,
    datos.cargo,
    datos.personaId,
    datos.fecha,
    serializar(datos.trazos),
  ].join('|')
}
