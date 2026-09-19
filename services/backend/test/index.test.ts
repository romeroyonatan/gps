import { describe, expect, test } from 'bun:test'
import {
  leerClavesDeSello,
  leerConfigDeAuth,
  leerDirectorioDeArchivos,
  leerEntorno,
  leerPuerto,
  leerRutaDeBd,
} from '../src/index'

describe('leerEntorno', () => {
  test('sin ENTORNO definido, usa desarrollo', () => {
    expect(leerEntorno(undefined)).toBe('desarrollo')
  })

  test('acepta los cuatro entornos conocidos', () => {
    expect(['desarrollo', 'produccion', 'prueba', 'demo'].map(leerEntorno)).toEqual([
      'desarrollo',
      'produccion',
      'prueba',
      'demo',
    ])
  })

  test('con un valor desconocido, lanza en vez de arrancar en desarrollo', () => {
    expect(() => leerEntorno('production')).toThrow('ENTORNO invalido')
  })
})

describe('leerPuerto', () => {
  test('sin PUERTO definido, usa 3000 por defecto', () => {
    expect(leerPuerto(undefined)).toBe(3000)
  })

  test('con un valor valido, lo usa', () => {
    expect(leerPuerto('4000')).toBe(4000)
  })

  test('con un valor malformado, lanza en vez de dejarlo en NaN', () => {
    expect(() => leerPuerto('abc')).toThrow('PUERTO invalido')
  })
})

describe('leerConfigDeAuth', () => {
  const variables = {
    ORIGEN_PUBLICO: 'https://gps.example',
    GOOGLE_CLIENTE_WEB_ID: 'google-web',
    GOOGLE_CLIENTE_IOS_ID: 'google-ios',
    GOOGLE_CLIENTE_ANDROID_ID: 'google-android',
    GOOGLE_CLIENTE_SECRETO: 'google-secreto',
    APPLE_SERVICIO_ID: 'apple-web',
    APPLE_BUNDLE_ID: 'org.example.gps',
    APPLE_EQUIPO_ID: 'equipo',
    APPLE_CLAVE_ID: 'clave',
    APPLE_CLAVE_PRIVADA: 'linea-1\\nlinea-2',
  }

  test('fuera de produccion permite trabajar sin proveedores externos', () => {
    expect(leerConfigDeAuth('prueba', {})).toBeNull()
  })

  test('produccion exige todas las credenciales', () => {
    expect(() => leerConfigDeAuth('produccion', {})).toThrow('Faltan variables de auth')
  })

  test('rechaza configuraciones parciales tambien en desarrollo', () => {
    expect(() => leerConfigDeAuth('desarrollo', { ORIGEN_PUBLICO: 'http://localhost' })).toThrow(
      'GOOGLE_CLIENTE_WEB_ID',
    )
  })

  test('produccion exige origen https', () => {
    expect(() =>
      leerConfigDeAuth('produccion', { ...variables, ORIGEN_PUBLICO: 'http://gps.example' }),
    ).toThrow('https')
  })

  test('valida y normaliza la configuracion completa', () => {
    expect(leerConfigDeAuth('produccion', variables)).toEqual({
      origenPublico: 'https://gps.example',
      google: {
        clienteWebId: 'google-web',
        clienteIosId: 'google-ios',
        clienteAndroidId: 'google-android',
        clienteSecreto: 'google-secreto',
      },
      apple: {
        servicioId: 'apple-web',
        bundleId: 'org.example.gps',
        equipoId: 'equipo',
        claveId: 'clave',
        clavePrivada: 'linea-1\nlinea-2',
      },
    })
  })
})

describe('leerRutaDeBd', () => {
  test('sin BD definida, usa un archivo en el directorio de trabajo', () => {
    expect(leerRutaDeBd('desarrollo', undefined)).toBe('./gps.db')
  })

  test('respeta BD cuando esta definida', () => {
    expect(leerRutaDeBd('produccion', '/datos/gps.db')).toBe('/datos/gps.db')
  })

  test('en demo ignora BD y usa memoria', () => {
    // Es lo que garantiza que un build de demostracion no pueda apuntar a
    // datos reales, ni siquiera por una variable de entorno mal puesta.
    expect(leerRutaDeBd('demo', '/datos/gps.db')).toBe(':memory:')
  })
})

describe('leerClavesDeSello', () => {
  test('fuera de produccion hay una clave fija: levantar el proyecto no pide configurar nada', () => {
    expect(leerClavesDeSello('desarrollo', undefined, undefined)).toEqual({
      claves: { dev: 'clave-de-sello-solo-para-desarrollo' },
      activa: 'dev',
    })
  })

  test('en produccion faltar es un error, no un default silencioso', () => {
    // Una clave de desarrollo en produccion hace que los sellos no prueben
    // nada, y nadie se entera hasta que importa.
    expect(() => leerClavesDeSello('produccion', undefined, undefined)).toThrow()
  })

  test('lee varias claves: es lo que permite rotar sin invalidar lo ya firmado', () => {
    expect(leerClavesDeSello('produccion', '2026-03=una,2026-09=otra', '2026-09')).toEqual({
      claves: { '2026-03': 'una', '2026-09': 'otra' },
      activa: '2026-09',
    })
  })

  test('sin activa declarada toma la primera', () => {
    expect(leerClavesDeSello('produccion', 'sola=una', undefined).activa).toBe('sola')
  })

  test('una clave con `=` adentro no se parte: solo cuenta el primero', () => {
    // Las claves suelen venir en base64, que termina en `=`.
    expect(leerClavesDeSello('produccion', 'k=YWJj==', 'k').claves.k).toBe('YWJj==')
  })

  test('una activa que no esta entre las claves es un error', () => {
    // Sellar con una clave inexistente seria sellar con undefined.
    expect(() => leerClavesDeSello('produccion', 'a=una', 'b')).toThrow()
  })

  test('un par sin `=` o sin clave es un error', () => {
    expect(() => leerClavesDeSello('produccion', 'suelta', undefined)).toThrow()
    expect(() => leerClavesDeSello('produccion', 'a=', undefined)).toThrow()
  })
})

describe('leerDirectorioDeArchivos', () => {
  test('en demo no se puede configurar: no escribe sobre archivos de verdad', () => {
    expect(leerDirectorioDeArchivos('demo', '/datos/reales')).toBe('')
  })

  test('fuera de demo, el del entorno o el default', () => {
    expect(leerDirectorioDeArchivos('produccion', '/datos/archivos')).toBe('/datos/archivos')
    expect(leerDirectorioDeArchivos('desarrollo', undefined)).toBe('./archivos')
  })
})
