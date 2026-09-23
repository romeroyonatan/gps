## MODIFIED Requirements

### Requirement: Cargos con ámbito
Cada tipo de cargo SHALL pertenecer a un único ámbito. Los cargos de grupo son jefe de
grupo, subjefe de grupo, jefe de rama, capellán y director; comisionado de distrito es de
distrito; jefe scout diocesano es de diócesis. Un cargo de grupo SHALL apuntar a un grupo
abierto, uno de distrito a un distrito abierto, y uno de diócesis a ninguna entidad, porque
hay una sola diócesis por instancia. El alta de una persona y su detalle SHALL ofrecer y
aceptar sólo cargos de grupo, porque apuntan al grupo de la persona.

#### Scenario: Asignar un comisionado
- **WHEN** se asigna a una persona el cargo de comisionado de un distrito abierto
- **THEN** el cargo queda registrado con ámbito distrito y ese distrito

#### Scenario: Ámbito incorrecto
- **WHEN** se asigna el cargo de comisionado de distrito apuntando a un grupo
- **THEN** el sistema rechaza la operación

#### Scenario: Jefe scout diocesano
- **WHEN** se asigna a una persona el cargo de jefe scout diocesano
- **THEN** el cargo queda registrado con ámbito diócesis y sin entidad

#### Scenario: Alta con un cargo que no es de grupo
- **WHEN** se da de alta a una persona con el cargo de comisionado de distrito
- **THEN** el sistema rechaza el alta

#### Scenario: Cargo con fin de mandato desde el detalle
- **WHEN** la jefa del grupo le asigna a una persona el cargo de subjefe con fecha de fin
- **THEN** el cargo queda registrado desde hoy hasta esa fecha, con ámbito el grupo
