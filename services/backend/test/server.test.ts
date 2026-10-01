import { describe, expect, test } from 'bun:test'
import { ErrorDeNegocio } from '@gps/core/errores'
import { GraphQLError } from 'graphql'
import { enmascararSalvoNegocio } from '../src/server'

class PagoNoAnulable extends ErrorDeNegocio {}

const envuelto = (original: Error) =>
  new GraphQLError(original.message, { originalError: original })

describe('enmascararSalvoNegocio', () => {
  test('un error de negocio llega con su mensaje y su code', () => {
    const error = enmascararSalvoNegocio(
      envuelto(new PagoNoAnulable('Ya está anulado.')),
      'Unexpected error.',
      false,
    ) as GraphQLError
    expect(error.message).toBe('Ya está anulado.')
    expect(error.extensions.code).toBe('PagoNoAnulable')
  })

  test('cualquier otro error se enmascara', () => {
    const error = enmascararSalvoNegocio(
      envuelto(new Error('SQLITE_CONSTRAINT: secreto')),
      'Unexpected error.',
      false,
    ) as GraphQLError
    expect(error.message).toBe('Unexpected error.')
  })
})
