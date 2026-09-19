## Why

Las declaraciones de Afiliación determinan cuánto debe pagar cada grupo, pero hoy el sistema no genera esa deuda ni permite registrar los pagos recibidos fuera de la aplicación. Tesorería necesita una cuenta corriente simple y auditable para conocer el saldo de cada grupo sin incorporar cobro electrónico ni imputaciones contables complejas.

## What Changes

- Incorporar el módulo `tesoreria`, con una cuota única en pesos enteros para cada período de afiliación.
- Generar automáticamente un cargo por los afiliados cobrables de cada declaración, sin impedir que Afiliación complete una declaración si Tesorería no puede generar el cargo.
- Permitir reconciliar de forma manual e idempotente las declaraciones que todavía no tengan cargo.
- Mantener una cuenta corriente por grupo con cargos, pagos externos y anulaciones de pagos como movimientos inmutables.
- Permitir pagos parciales, pagos totales y saldos a favor, registrando fecha, medio de pago, referencia y observación.
- Exponer una vista de todos los grupos con saldo y filtros rápidos, y el detalle cronológico de la cuenta de cada grupo.
- No incorporar cobro dentro de la aplicación, imputación de pagos, vencimientos ni recargos.

## Capabilities

### New Capabilities

- `tesoreria`: Configuración de cuotas, generación y reconciliación de cargos, registro y anulación de pagos, y consulta de cuentas corrientes de grupos.

### Modified Capabilities

Ninguna.

## Impact

- Nuevo paquete `packages/tesoreria` y registro en `services/backend/src/modules.ts`.
- Nueva infraestructura mínima en `@gps/core` para comunicar una declaración de Afiliación a Tesorería sin acoplar ambos módulos.
- Afiliación publicará los datos de declaraciones que Tesorería necesita para generar y reconciliar cargos.
- Nuevas operaciones GraphQL y cliente compartido en `packages/api`.
- Nuevas pantallas mobile-first en web y mobile para administrar Tesorería.
- Nuevas tablas y migraciones SQLite para cuotas y movimientos.
