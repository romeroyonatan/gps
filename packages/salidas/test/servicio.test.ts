import { describe, expect, test } from 'bun:test'
import { alcanceSinLimites, type Reloj } from '@gps/core'
import { sql } from 'drizzle-orm'
import { numeroDeExpediente } from '../src/dominio/permisos'
import { PermisoInvalido, PermisoNoEditable } from '../src/servidor/borradores'
import { FirmaInvalida } from '../src/servidor/firmas'
import {
  alcanceDelFirmante,
  GRUPO_ID,
  MANADA,
  montar,
  mundoPorDefecto,
  permisoConGente,
  persona,
  subirEscaneo,
  TROPA,
} from './montar'

const datos = {
  lugar: 'Estancia La Paz',
  direccion: 'Ruta 9 km 500',
  localidad: 'Los Patos',
  provincia: 'Santa Fe',
  telefono: '11 5488-2210',
  desde: '1970-03-01',
  hasta: '1970-03-03',
}

describe('crear y editar un borrador', () => {
  test('nace en borrador con sus datos', async () => {
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, {
      ...datos,
      comoSeViaja: 'Micro',
    })
    expect(permiso).toMatchObject({
      estado: 'borrador',
      lugar: 'Estancia La Paz',
      comoSeViaja: 'Micro',
      pdfId: null,
    })
  })

  test('fechas invertidas se rechazan', async () => {
    const { servicio } = montar()
    expect(
      servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, { ...datos, hasta: '1970-02-28' }),
    ).rejects.toThrow(PermisoInvalido)
  })

  test('un grupo que no existe o esta cerrado se rechaza', async () => {
    const { servicio } = montar()
    expect(servicio.crearPermiso(alcanceSinLimites(), 'grupo_inexistente', datos)).rejects.toThrow(
      PermisoNoEditable,
    )
  })

  test('editar un borrador cambia los datos', async () => {
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    const editado = await servicio.editarPermiso(alcanceSinLimites(), permiso.id, {
      ...datos,
      lugar: 'Otro lado',
    })
    expect(editado.lugar).toBe('Otro lado')
  })
})

describe('número de expediente', () => {
  test('lo asigna al emitir y la serie va corrida', async () => {
    const { servicio } = montar()
    const uno = await servicio.emitir(alcanceSinLimites(), (await permisoConGente(servicio)).id)
    const otro = await servicio.emitir(alcanceSinLimites(), (await permisoConGente(servicio)).id)
    // El reloj de los tests está clavado en 1970, así que la serie es esa.
    expect(numeroDeExpediente(uno.permiso)).toBe('SAL-1970-0001')
    expect(numeroDeExpediente(otro.permiso)).toBe('SAL-1970-0002')
  })

  test('un borrador no tiene expediente', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect(numeroDeExpediente(permiso)).toBeNull()
  })
})

describe('responsable a cargo', () => {
  test('tiene que ser uno de los dirigentes que van', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect(
      servicio.elegirResponsable(alcanceSinLimites(), permiso.id, 'persona_chico'),
    ).rejects.toThrow(PermisoInvalido)
  })

  test('sacarlo de la salida lo suelta: el permiso no queda a cargo de quien ya no va', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.quitarParticipante(alcanceSinLimites(), permiso.id, 'persona_jefe')
    const [suelto] = await servicio.listarPermisos(alcanceSinLimites(), GRUPO_ID)
    expect(suelto?.responsableId).toBeNull()
  })

  test('sin responsable no se emite', async () => {
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    await servicio.elegirUnidades(alcanceSinLimites(), permiso.id, [TROPA])
    expect(servicio.emitir(alcanceSinLimites(), permiso.id)).rejects.toThrow(PermisoInvalido)
  })
})

describe('unidades que participan', () => {
  test('quedan registradas las elegidas y se anota automáticamente a toda su gente', async () => {
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    await servicio.elegirUnidades(alcanceSinLimites(), permiso.id, [TROPA])
    expect(servicio.unidadesElegidas(permiso.id)).toEqual([TROPA])
    expect(
      (await servicio.listarParticipantes(alcanceSinLimites(), permiso.id))
        .map((uno) => uno.personaId)
        .sort(),
    ).toEqual(['persona_chico', 'persona_jefe'])
  })

  test('una unidad de otro grupo se rechaza', async () => {
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    expect(
      servicio.elegirUnidades(alcanceSinLimites(), permiso.id, ['unidad_ajena']),
    ).rejects.toThrow(PermisoInvalido)
  })

  test('desmarcar una unidad saca a su gente de la lista', async () => {
    // Si no, el PDF diria algo que la pantalla no muestra.
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    await servicio.elegirUnidades(alcanceSinLimites(), permiso.id, [TROPA, MANADA])
    await servicio.elegirUnidades(alcanceSinLimites(), permiso.id, [TROPA])
    expect(
      (await servicio.listarParticipantes(alcanceSinLimites(), permiso.id)).some(
        (uno) => uno.personaId === 'persona_lobato',
      ),
    ).toBeFalse()
  })
})

describe('participantes', () => {
  test('se agregan con la marca que da su categoria', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    const puestos = await servicio.listarParticipantes(alcanceSinLimites(), permiso.id)
    expect(puestos.map((uno) => [uno.personaId, uno.marca]).sort()).toEqual([
      ['persona_chico', 'beneficiario'],
      ['persona_jefe', 'dirigente'],
    ])
  })

  test('alguien de una unidad que no va se rechaza', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect(
      servicio.agregarParticipante(alcanceSinLimites(), permiso.id, 'persona_lobato'),
    ).rejects.toThrow(PermisoInvalido)
  })

  test('alguien de otro grupo se rechaza', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect(
      servicio.agregarParticipante(alcanceSinLimites(), permiso.id, 'persona_ajena'),
    ).rejects.toThrow(PermisoInvalido)
  })

  test('la cocinera entra aunque no tenga unidad', async () => {
    // Es adherente y no pertenece a ninguna unidad, y va a los campamentos
    // igual: dejarla afuera seria una regla que no existe.
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.agregarParticipante(alcanceSinLimites(), permiso.id, 'persona_cocinera')
    expect((await servicio.listarParticipantes(alcanceSinLimites(), permiso.id)).length).toBe(3)
  })

  test('agregar de nuevo a la misma persona no la duplica', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.agregarParticipante(alcanceSinLimites(), permiso.id, 'persona_chico')
    expect(
      (await servicio.listarParticipantes(alcanceSinLimites(), permiso.id)).filter(
        (uno) => uno.personaId === 'persona_chico',
      ),
    ).toHaveLength(1)
  })

  test('quitar saca de la lista', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.quitarParticipante(alcanceSinLimites(), permiso.id, 'persona_chico')
    expect((await servicio.listarParticipantes(alcanceSinLimites(), permiso.id)).length).toBe(1)
  })
})

describe('emitir', () => {
  test('congela los datos, guarda el PDF y pasa a emitido', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    const { permiso: emitido } = await servicio.emitir(alcanceSinLimites(), permiso.id)
    expect(emitido.estado).toBe('emitido')
    expect(emitido.pdfId).not.toBeNull()
    expect(emitido.hashDelPdf).not.toBeNull()
    // La huella del contenido es lo que después deja comprobar que el papel
    // sigue diciendo lo mismo, sin depender de cómo esté dibujado.
    expect(emitido.hashDelContenido).not.toBeNull()
  })

  test('sin ningun dirigente no se emite', async () => {
    const { servicio } = montar()
    const permiso = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    await servicio.elegirUnidades(alcanceSinLimites(), permiso.id, [TROPA])
    await servicio.quitarParticipante(alcanceSinLimites(), permiso.id, 'persona_jefe')
    await servicio.quitarParticipante(alcanceSinLimites(), permiso.id, 'persona_cocinera')
    expect(servicio.emitir(alcanceSinLimites(), permiso.id)).rejects.toThrow(PermisoInvalido)
  })

  test('un emitido no se edita', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    expect(servicio.editarPermiso(alcanceSinLimites(), permiso.id, datos)).rejects.toThrow(
      PermisoNoEditable,
    )
    expect(
      servicio.agregarParticipante(alcanceSinLimites(), permiso.id, 'persona_cocinera'),
    ).rejects.toThrow(PermisoNoEditable)
  })

  test('la fotografia no cambia aunque cambien los datos de la persona', async () => {
    // Lo que se firma tiene que seguir leyendose como se leia.
    const mundo = mundoPorDefecto()
    const { servicio } = montar({ mundo })
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)

    const chico = mundo.miembros.find((uno) => uno.persona.id === 'persona_chico')
    if (chico)
      mundo.miembros[mundo.miembros.indexOf(chico)] = {
        ...chico,
        persona: { ...chico.persona, apellidos: 'Corregido' },
      }

    const emitidos = await servicio.listarParticipantesEmitidos(alcanceSinLimites(), permiso.id)
    expect(emitidos.find((uno) => uno.personaId === 'persona_chico')?.apellidos).toBe('Alvarez')
  })

  test('guarda la unidad de cada uno, y una raya para los que no tienen', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.agregarParticipante(alcanceSinLimites(), permiso.id, 'persona_cocinera')
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    const emitidos = await servicio.listarParticipantesEmitidos(alcanceSinLimites(), permiso.id)
    expect(emitidos.find((uno) => uno.personaId === 'persona_chico')?.unidad).toContain('San Jorge')
    expect(emitidos.find((uno) => uno.personaId === 'persona_cocinera')?.unidad).toBe('-')
  })
})

describe('aviso de anticipacion', () => {
  const relojEn = (dia: string): Reloj => ({ ahora: () => new Date(`${dia}T12:00:00Z`) })

  test('emitir tarde avisa pero emite igual', async () => {
    const { servicio } = montar({ reloj: relojEn('1970-02-25') })
    const permiso = await permisoConGente(servicio)
    const resultado = await servicio.emitir(alcanceSinLimites(), permiso.id)
    expect(resultado.permiso.estado).toBe('emitido')
    expect(resultado.avisos.length).toBe(1)
  })

  test('emitir a tiempo no avisa', async () => {
    const { servicio } = montar({ reloj: relojEn('1970-01-01') })
    const permiso = await permisoConGente(servicio)
    expect((await servicio.emitir(alcanceSinLimites(), permiso.id)).avisos).toEqual([])
  })
})

describe('firmas', () => {
  const trazos = { trazos: [[[0.1, 0.2] as const, [0.8, 0.6] as const]] }

  async function emitido() {
    const montado = montar()
    const permiso = await permisoConGente(montado.servicio)
    await montado.servicio.emitir(alcanceSinLimites(), permiso.id)
    return { ...montado, permisoId: permiso.id }
  }

  test('un permiso emitido muestra tres firmas pendientes con quien las tiene que poner', async () => {
    const { servicio, permisoId } = await emitido()
    const estados = await servicio.estadoDeLasFirmas(alcanceSinLimites(), permisoId)
    expect(estados.map((uno) => uno.cargo)).toEqual([
      'jefeDeGrupo',
      'director',
      'comisionadoDeDistrito',
    ])
    expect(estados.every((uno) => uno.firma === null)).toBe(true)
    expect(estados.map((uno) => uno.quien?.apellidos)).toEqual(['Paz', 'Vera', 'Gil'])
  })

  test('firmar en la app deja la firma con su sello, y verifica', async () => {
    const { servicio, permisoId } = await emitido()
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permisoId, 'jefeDeGrupo', trazos)
    const estado = (await servicio.estadoDeLasFirmas(alcanceSinLimites(), permisoId))[0]
    expect(estado?.firma?.modo).toBe('app')
    expect(estado?.verificada).toBe(true)
  })

  test('el mismo cargo no firma dos veces', async () => {
    const { servicio, permisoId } = await emitido()
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permisoId, 'jefeDeGrupo', trazos)
    expect(
      servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permisoId, 'jefeDeGrupo', trazos),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('un dibujo vacio no es una firma', async () => {
    const { servicio, permisoId } = await emitido()
    expect(
      servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permisoId, 'jefeDeGrupo', {
        trazos: [[]],
      }),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('un cargo vacante no puede firmar', async () => {
    const mundo = mundoPorDefecto()
    mundo.cargos.delete('comisionadoDeDistrito|distrito_1')
    const { servicio } = montar({ mundo })
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    expect(
      servicio.firmarEnApp(
        alcanceDelFirmante('comisionadoDeDistrito'),
        permiso.id,
        'comisionadoDeDistrito',
        trazos,
      ),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('un cargo que no firma permisos se rechaza', async () => {
    const { servicio, permisoId } = await emitido()
    expect(
      servicio.firmarEnApp(alcanceDelFirmante('capellan'), permisoId, 'capellan', trazos),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('un borrador no se firma', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect(
      servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', trazos),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('firma a nombre de quien ocupa el cargo el dia que firma, no el de la emision', async () => {
    // Un cambio de comisionado entre la emision y la firma: firma el nuevo.
    const mundo = mundoPorDefecto()
    const { servicio } = montar({ mundo })
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)

    mundo.cargos.set('comisionadoDeDistrito|distrito_1', [persona('persona_nueva', 'Nueva')])
    const firma = await servicio.firmarEnApp(
      alcanceDelFirmante('comisionadoDeDistrito'),
      permiso.id,
      'comisionadoDeDistrito',
      trazos,
    )
    expect(firma.apellidos).toBe('Nueva')
  })
})

describe('verificacion de sellos', () => {
  const trazos = { trazos: [[[0.1, 0.2] as const]] }

  test('alterar los trazos en la base rompe el sello', async () => {
    const { servicio, bd } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', trazos)

    // Se altera la base por debajo, que es justo el ataque que el sello ataja.
    bd.run(sql`UPDATE firmas SET trazos = '[[[0.9,0.9]]]'`)
    expect((await servicio.estadoDeLasFirmas(alcanceSinLimites(), permiso.id))[0]?.verificada).toBe(
      false,
    )
  })

  test('una firma en papel no tiene sello, asi que no dice ni si ni no', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    const escaneoId = await subirEscaneo(archivos, permiso.id)
    await servicio.firmarEnPapel(alcanceSinLimites(), permiso.id, ['director'], escaneoId)

    const estado = (await servicio.estadoDeLasFirmas(alcanceSinLimites(), permiso.id)).find(
      (uno) => uno.cargo === 'director',
    )
    expect(estado?.verificada).toBeNull()
  })
})

describe('firma en papel y permiso firmado', () => {
  const trazos = { trazos: [[[0.1, 0.2] as const]] }

  test('un escaneo puede respaldar dos firmas', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    const escaneoId = await subirEscaneo(archivos, permiso.id)

    const puestas = await servicio.firmarEnPapel(
      alcanceSinLimites(),
      permiso.id,
      ['jefeDeGrupo', 'director'],
      escaneoId,
    )
    expect(puestas.map((uno) => uno.escaneoId)).toEqual([escaneoId, escaneoId])
  })

  test('un .docx no puede ser la prueba de una firma', async () => {
    // Se puede adjuntar al permiso -eso es otra cosa- pero no se anexa al PDF.
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)

    const bytes = new Uint8Array([1, 2, 3])
    const subida = await archivos.solicitarSubida({
      nombre: 'planificacion.docx',
      tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      tamano: bytes.length,
      modulo: 'salidas',
      recursoId: permiso.id,
    })
    const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''
    await archivos.recibirBytes(subida.id, token, bytes)
    await archivos.confirmarSubida(subida.id)

    expect(
      servicio.firmarEnPapel(alcanceSinLimites(), permiso.id, ['director'], subida.id),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('un escaneo de otro permiso no sirve', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    const ajeno = await subirEscaneo(archivos, 'permiso_ajeno')
    expect(
      servicio.firmarEnPapel(alcanceSinLimites(), permiso.id, ['director'], ajeno),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('con las tres firmas el permiso queda firmado', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', trazos)
    await servicio.firmarEnApp(
      alcanceDelFirmante('comisionadoDeDistrito'),
      permiso.id,
      'comisionadoDeDistrito',
      trazos,
    )
    const escaneoId = await subirEscaneo(archivos, permiso.id)
    await servicio.firmarEnPapel(alcanceSinLimites(), permiso.id, ['director'], escaneoId)

    expect((await servicio.obtenerPermiso(alcanceSinLimites(), permiso.id))?.estado).toBe('firmado')
  })

  test('con dos todavia no', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', trazos)
    await servicio.firmarEnApp(alcanceDelFirmante('director'), permiso.id, 'director', trazos)
    expect((await servicio.obtenerPermiso(alcanceSinLimites(), permiso.id))?.estado).toBe('emitido')
  })
})

describe('anular y re-emitir', () => {
  test('un emitido se anula', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    expect((await servicio.anular(alcanceSinLimites(), permiso.id)).estado).toBe('anulado')
  })

  test('un anulado no admite mas firmas', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.anular(alcanceSinLimites(), permiso.id)
    expect(
      servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', {
        trazos: [[[0.1, 0.2] as const]],
      }),
    ).rejects.toThrow(FirmaInvalida)
  })

  test('un borrador se anula pero no se re-emite', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect((await servicio.anular(alcanceSinLimites(), permiso.id)).estado).toBe('anulado')
    await expect(servicio.reEmitir(alcanceSinLimites(), permiso.id)).rejects.toThrow(
      PermisoNoEditable,
    )
  })

  test('re-emitir copia datos, unidades y participantes en un borrador nuevo', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.anular(alcanceSinLimites(), permiso.id)

    const nuevo = await servicio.reEmitir(alcanceSinLimites(), permiso.id)
    expect(nuevo.estado).toBe('borrador')
    expect(nuevo.id).not.toBe(permiso.id)
    expect(nuevo.reemplazaA).toBe(permiso.id)
    expect(nuevo.lugar).toBe(permiso.lugar)
    expect(servicio.unidadesElegidas(nuevo.id)).toEqual([TROPA])
    expect((await servicio.listarParticipantes(alcanceSinLimites(), nuevo.id)).length).toBe(2)
    // Sin firmas ni PDF: es un borrador de verdad.
    expect(nuevo.pdfId).toBeNull()
  })

  test('solo se re-emite lo anulado, una vez', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await expect(servicio.reEmitir(alcanceSinLimites(), permiso.id)).rejects.toThrow(
      PermisoNoEditable,
    )

    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.anular(alcanceSinLimites(), permiso.id)
    await servicio.reEmitir(alcanceSinLimites(), permiso.id)
    await expect(servicio.reEmitir(alcanceSinLimites(), permiso.id)).rejects.toThrow(
      'Este permiso ya fue re-emitido.',
    )
  })
})

describe('adjuntos', () => {
  test('una planificacion en .docx se puede adjuntar', async () => {
    // Lo que el jefe de rama ya tenia escrito. No se anexa al PDF, solo cuelga
    // del permiso.
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)

    const bytes = new Uint8Array([1, 2, 3])
    const subida = await archivos.solicitarSubida({
      nombre: 'planificacion.docx',
      tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      tamano: bytes.length,
      modulo: 'salidas',
      recursoId: permiso.id,
    })
    const token = new URL(subida.url, 'http://x').searchParams.get('token') ?? ''
    await archivos.recibirBytes(subida.id, token, bytes)
    await archivos.confirmarSubida(subida.id)
    await servicio.adjuntar(alcanceSinLimites(), permiso.id, subida.id)

    expect((await servicio.listarAdjuntos(alcanceSinLimites(), permiso.id)).length).toBe(1)
  })

  test('se puede adjuntar a un permiso firmado sin romper las firmas', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', {
      trazos: [[[0.1, 0.2] as const]],
    })

    const archivoId = await subirEscaneo(archivos, permiso.id)
    await servicio.adjuntar(alcanceSinLimites(), permiso.id, archivoId)

    expect((await servicio.listarAdjuntos(alcanceSinLimites(), permiso.id)).length).toBe(1)
    expect((await servicio.estadoDeLasFirmas(alcanceSinLimites(), permiso.id))[0]?.verificada).toBe(
      true,
    )
  })

  test('quitar un adjunto lo saca de la lista y borra el archivo', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    const archivoId = await subirEscaneo(archivos, permiso.id)
    await servicio.adjuntar(alcanceSinLimites(), permiso.id, archivoId)

    const [adjunto] = await servicio.listarAdjuntos(alcanceSinLimites(), permiso.id)
    if (!adjunto) throw new Error('no se adjunto')
    await servicio.quitarAdjunto(alcanceSinLimites(), permiso.id, adjunto.id)

    expect(await servicio.listarAdjuntos(alcanceSinLimites(), permiso.id)).toEqual([])
    // El archivo tambien: si no, queda basura que nadie puede alcanzar.
    expect(await archivos.obtener(archivoId)).toBeNull()
  })

  test('quitar un adjunto de un permiso firmado no toca las firmas', async () => {
    // Un adjunto no entra en el PDF ni en el hash que sellan las firmas.
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', {
      trazos: [[[0.1, 0.2] as const]],
    })

    const archivoId = await subirEscaneo(archivos, permiso.id)
    await servicio.adjuntar(alcanceSinLimites(), permiso.id, archivoId)
    const [adjunto] = await servicio.listarAdjuntos(alcanceSinLimites(), permiso.id)
    if (!adjunto) throw new Error('no se adjunto')
    await servicio.quitarAdjunto(alcanceSinLimites(), permiso.id, adjunto.id)

    expect((await servicio.estadoDeLasFirmas(alcanceSinLimites(), permiso.id))[0]?.verificada).toBe(
      true,
    )
  })

  test('quitar un adjunto de otro permiso se rechaza', async () => {
    const { servicio, archivos } = montar()
    const uno = await permisoConGente(servicio)
    const otro = await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    const archivoId = await subirEscaneo(archivos, uno.id)
    await servicio.adjuntar(alcanceSinLimites(), uno.id, archivoId)
    const [adjunto] = await servicio.listarAdjuntos(alcanceSinLimites(), uno.id)
    if (!adjunto) throw new Error('no se adjunto')

    expect(servicio.quitarAdjunto(alcanceSinLimites(), otro.id, adjunto.id)).rejects.toThrow(
      PermisoNoEditable,
    )
  })

  test('quitar un adjunto no borra el escaneo de una firma', async () => {
    // El escaneo es la prueba de lo que se firmo en papel: no es un adjunto y
    // no se toca por aca.
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    const escaneoId = await subirEscaneo(archivos, permiso.id)
    await servicio.firmarEnPapel(alcanceSinLimites(), permiso.id, ['director'], escaneoId)

    const adjuntoId = await subirEscaneo(archivos, permiso.id)
    await servicio.adjuntar(alcanceSinLimites(), permiso.id, adjuntoId)
    const [adjunto] = await servicio.listarAdjuntos(alcanceSinLimites(), permiso.id)
    if (!adjunto) throw new Error('no se adjunto')
    await servicio.quitarAdjunto(alcanceSinLimites(), permiso.id, adjunto.id)

    expect(await archivos.obtener(escaneoId)).not.toBeNull()
  })

  test('un archivo de otro permiso no se adjunta', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    const ajeno = await subirEscaneo(archivos, 'permiso_ajeno')
    expect(servicio.adjuntar(alcanceSinLimites(), permiso.id, ajeno)).rejects.toThrow(
      PermisoNoEditable,
    )
  })
})

describe('listar', () => {
  test('los del grupo, del mas proximo al mas viejo', async () => {
    const { servicio } = montar()
    await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, {
      ...datos,
      desde: '1970-03-01',
      hasta: '1970-03-02',
    })
    await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, {
      ...datos,
      desde: '1970-05-01',
      hasta: '1970-05-02',
    })
    await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, {
      ...datos,
      desde: '1970-04-01',
      hasta: '1970-04-02',
    })

    expect(
      (await servicio.listarPermisos(alcanceSinLimites(), GRUPO_ID)).map((uno) => uno.desde),
    ).toEqual(['1970-05-01', '1970-04-01', '1970-03-01'])
  })

  test('los de otro grupo no se mezclan', async () => {
    const { servicio } = montar()
    await servicio.crearPermiso(alcanceSinLimites(), GRUPO_ID, datos)
    expect(await servicio.listarPermisos(alcanceSinLimites(), 'grupo_otro')).toEqual([])
  })
})

describe('pdf del permiso', () => {
  test('un borrador todavia no tiene PDF', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    expect(servicio.pdfDelPermiso(alcanceSinLimites(), permiso.id)).rejects.toThrow(
      PermisoNoEditable,
    )
  })

  test('el emitido se puede descargar y cambia al registrar una firma', async () => {
    const { servicio } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)

    const sinFirmas = await servicio.pdfDelPermiso(alcanceSinLimites(), permiso.id)
    expect(new TextDecoder().decode(sinFirmas.slice(0, 5))).toBe('%PDF-')

    await servicio.firmarEnApp(alcanceDelFirmante('jefeDeGrupo'), permiso.id, 'jefeDeGrupo', {
      trazos: [[[0.1, 0.2] as const]],
    })
    expect(await servicio.pdfDelPermiso(alcanceSinLimites(), permiso.id)).not.toEqual(sinFirmas)
  })

  test('el firmado anexa el escaneo del papel', async () => {
    const { servicio, archivos } = montar()
    const permiso = await permisoConGente(servicio)
    await servicio.emitir(alcanceSinLimites(), permiso.id)
    const sinAnexo = await servicio.pdfDelPermiso(alcanceSinLimites(), permiso.id)

    const escaneoId = await subirEscaneo(archivos, permiso.id)
    await servicio.firmarEnPapel(alcanceSinLimites(), permiso.id, ['director'], escaneoId)
    const conAnexo = await servicio.pdfDelPermiso(alcanceSinLimites(), permiso.id)

    expect(conAnexo.length).toBeGreaterThan(sinAnexo.length)
  })
})
