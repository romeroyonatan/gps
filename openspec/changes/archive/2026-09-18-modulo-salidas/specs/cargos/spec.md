## Purpose

Los cargos que ocupan las personas, con su ámbito —grupo, distrito o diócesis— y su
período, y la consulta de quién ocupaba un cargo un día dado.

## ADDED Requirements

### Requirement: Cargos con ámbito
Cada tipo de cargo SHALL pertenecer a un único ámbito. Los cargos de grupo son jefe de
grupo, subjefe de grupo, jefe de rama, capellán y director; comisionado de distrito es de
distrito; jefe scout diocesano es de diócesis. Un cargo de grupo SHALL apuntar a un grupo
abierto, uno de distrito a un distrito abierto, y uno de diócesis a ninguna entidad, porque
hay una sola diócesis por instancia.

#### Scenario: Asignar un comisionado
- **WHEN** se asigna a una persona el cargo de comisionado de un distrito abierto
- **THEN** el cargo queda registrado con ámbito distrito y ese distrito

#### Scenario: Ámbito incorrecto
- **WHEN** se asigna el cargo de comisionado de distrito apuntando a un grupo
- **THEN** el sistema rechaza la operación

#### Scenario: Jefe scout diocesano
- **WHEN** se asigna a una persona el cargo de jefe scout diocesano
- **THEN** el cargo queda registrado con ámbito diócesis y sin entidad

### Requirement: Cargos existentes se conservan
Los cargos de grupo registrados antes de este cambio SHALL seguir existiendo con ámbito
grupo, el mismo grupo y el mismo período.

#### Scenario: Migración
- **WHEN** se aplica la migración sobre una base con cargos de grupo
- **THEN** cada cargo conserva persona, tipo, grupo, desde y hasta

### Requirement: Quién ocupaba un cargo
El sistema SHALL responder, para un tipo de cargo, una entidad de su ámbito y una fecha,
qué personas ocupaban ese cargo ese día, incluyendo las dos puntas del período.

#### Scenario: Cargo ocupado
- **WHEN** se consulta el director de un grupo en una fecha dentro del período de su cargo
- **THEN** se devuelve esa persona

#### Scenario: Último día del período
- **WHEN** se consulta en la fecha exacta del `hasta` del cargo
- **THEN** la persona todavía se devuelve

#### Scenario: Vacante
- **WHEN** se consulta un cargo que nadie ocupaba ese día
- **THEN** se devuelve una lista vacía
