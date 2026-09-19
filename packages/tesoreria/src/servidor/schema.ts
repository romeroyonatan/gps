import { alcanceDe } from '@gps/core'
import type { Builder } from '@gps/core/graphql'
import { GraphQLError } from 'graphql'
import {
  type CuentaDeGrupo,
  type CuotaDeAfiliacion,
  MEDIOS_DE_PAGO,
  type MedioDePago,
  type MovimientoDeTesoreria,
  type ResultadoDeReconciliacion,
  type ResumenDePendientes,
  type TipoDeMovimiento,
} from '../dominio'
import { CuotaUtilizada, DatosDePagoInvalidos, OperacionDenegada, PagoNoAnulable } from './servicio'

export function registrarSchema(builder: Builder): void {
  const MedioDePagoRef = builder.enumType('MedioDePago', {
    description: 'Cómo recibió Tesorería un pago externo.',
    values: MEDIOS_DE_PAGO as unknown as readonly MedioDePago[],
  })
  const TipoDeMovimientoRef = builder.enumType('TipoDeMovimientoDeTesoreria', {
    description: 'La causa de un movimiento de la cuenta corriente.',
    values: [
      'cargo_afiliacion',
      'pago',
      'anulacion_pago',
    ] as const satisfies readonly TipoDeMovimiento[],
  })

  const CuotaRef = builder.objectRef<CuotaDeAfiliacion>('CuotaDeAfiliacion').implement({
    fields: (t) => ({
      periodo: t.exposeInt('periodo'),
      importe: t.exposeInt('importe'),
    }),
  })

  const MovimientoRef = builder
    .objectRef<MovimientoDeTesoreria>('MovimientoDeTesoreria')
    .implement({
      fields: (t) => ({
        id: t.exposeID('id'),
        fecha: t.exposeString('fecha'),
        tipo: t.field({ type: TipoDeMovimientoRef, resolve: (movimiento) => movimiento.tipo }),
        importe: t.int({ resolve: (movimiento) => Math.abs(movimiento.importe) }),
        periodo: t.exposeInt('periodo', { nullable: true }),
        declaracionId: t.exposeID('declaracionId', { nullable: true }),
        cantidad: t.exposeInt('cantidad', { nullable: true }),
        cuota: t.exposeInt('cuota', { nullable: true }),
        medioDePago: t.field({
          type: MedioDePagoRef,
          nullable: true,
          resolve: (movimiento) => movimiento.medioDePago,
        }),
        referencia: t.exposeString('referencia', { nullable: true }),
        observacion: t.exposeString('observacion', { nullable: true }),
        anulaA: t.exposeID('anulaA', { nullable: true }),
      }),
    })

  const CuentaRef = builder.objectRef<CuentaDeGrupo>('CuentaDeGrupo').implement({
    fields: (t) => ({
      grupoId: t.exposeID('grupoId'),
      numero: t.exposeInt('numero'),
      nombre: t.exposeString('nombre'),
      cerrado: t.exposeBoolean('cerrado'),
      saldo: t.exposeInt('saldo', {
        description: 'Positivo es deuda; negativo es saldo a favor.',
      }),
    }),
  })

  const PendientesRef = builder
    .objectRef<ResumenDePendientes>('ResumenDeDeudasPendientes')
    .implement({
      fields: (t) => ({
        cantidad: t.exposeInt('cantidad'),
        periodosSinCuota: t.intList({ resolve: (resumen) => [...resumen.periodosSinCuota] }),
      }),
    })
  const ResultadoRef = builder
    .objectRef<ResultadoDeReconciliacion>('ResultadoDeReconciliacion')
    .implement({
      fields: (t) => ({
        creados: t.exposeInt('creados'),
        cantidad: t.exposeInt('cantidad'),
        periodosSinCuota: t.intList({ resolve: (resultado) => [...resultado.periodosSinCuota] }),
      }),
    })

  builder.queryField('cuotasDeAfiliacion', (t) =>
    t.field({
      type: [CuotaRef],
      resolve: async (_padre, _args, contexto) => [...(await contexto.tesoreria.listarCuotas())],
    }),
  )
  builder.queryField('periodosConfigurablesDeAfiliacion', (t) =>
    t.intList({
      resolve: async (_padre, _args, contexto) => [
        ...(await contexto.tesoreria.listarPeriodosConfigurables(alcanceDe(contexto))),
      ],
    }),
  )
  builder.queryField('cuentasDeGrupos', (t) =>
    t.field({
      type: [CuentaRef],
      resolve: async (_padre, _args, contexto) => [
        ...(await contexto.tesoreria.listarCuentas(alcanceDe(contexto))),
      ],
    }),
  )
  builder.queryField('movimientosDeTesoreria', (t) =>
    t.field({
      type: [MovimientoRef],
      args: { grupoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => [
        ...(await contexto.tesoreria.listarMovimientos(alcanceDe(contexto), String(args.grupoId))),
      ],
    }),
  )
  builder.queryField('deudasPendientes', (t) =>
    t.field({
      type: PendientesRef,
      resolve: (_padre, _args, contexto) =>
        contexto.tesoreria.resumenDePendientes(alcanceDe(contexto)),
    }),
  )

  const traducir = (error: unknown): never => {
    if (
      error instanceof DatosDePagoInvalidos ||
      error instanceof CuotaUtilizada ||
      error instanceof PagoNoAnulable ||
      error instanceof OperacionDenegada
    ) {
      throw new GraphQLError(error.message, { extensions: { code: error.name } })
    }
    throw error
  }

  builder.mutationField('definirCuotaDeAfiliacion', (t) =>
    t.field({
      type: CuotaRef,
      args: { periodo: t.arg.int({ required: true }), importe: t.arg.int({ required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.tesoreria.definirCuota(
            alcanceDe(contexto),
            args.periodo,
            args.importe,
          )
        } catch (error) {
          return traducir(error)
        }
      },
    }),
  )
  builder.mutationField('registrarPago', (t) =>
    t.field({
      type: MovimientoRef,
      args: {
        grupoId: t.arg.id({ required: true }),
        fecha: t.arg.string({ required: true }),
        importe: t.arg.int({ required: true }),
        medioDePago: t.arg({ type: MedioDePagoRef, required: true }),
        referencia: t.arg.string(),
        observacion: t.arg.string(),
      },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.tesoreria.registrarPago(alcanceDe(contexto), {
            grupoId: String(args.grupoId),
            fecha: args.fecha,
            importe: args.importe,
            medioDePago: args.medioDePago,
            referencia: args.referencia,
            observacion: args.observacion,
          })
        } catch (error) {
          return traducir(error)
        }
      },
    }),
  )
  builder.mutationField('anularPago', (t) =>
    t.field({
      type: MovimientoRef,
      args: { pagoId: t.arg.id({ required: true }) },
      resolve: async (_padre, args, contexto) => {
        try {
          return await contexto.tesoreria.anularPago(alcanceDe(contexto), String(args.pagoId))
        } catch (error) {
          return traducir(error)
        }
      },
    }),
  )
  builder.mutationField('generarDeudasPendientes', (t) =>
    t.field({
      type: ResultadoRef,
      resolve: (_padre, _args, contexto) => contexto.tesoreria.reconciliar(alcanceDe(contexto)),
    }),
  )
}
