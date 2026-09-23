## MODIFIED Requirements

### Requirement: Administración elevada auditable y en línea
El sistema MUST permitir operaciones elevadas sólo contra el servidor y MUST registrar cada escritura elevada exitosa con la persona, la operación, el objetivo y el instante. También MUST registrar como intentos rechazados las elevaciones denegadas y las escrituras que intentaron usar privilegios elevados sin una elevación vigente, sin conservar credenciales, secretos ni tokens.

#### Scenario: Escritura con sudo
- **WHEN** el administrador elevado modifica cualquier dato
- **THEN** la operación se ejecuta con alcance global y queda registrada en la auditoría como exitosa

#### Scenario: Dispositivo sin conexión
- **WHEN** se intenta ejecutar una acción administrativa elevada sin conexión al servidor
- **THEN** el sistema no la ejecuta localmente

#### Scenario: Elevación rechazada
- **WHEN** una persona no designada, una identidad no vinculada o una comprobación inválida intenta elevar una sesión
- **THEN** el sistema deniega la elevación y registra el intento sin guardar la credencial presentada

#### Scenario: Escritura elevada sin vigencia
- **WHEN** el cliente marca una escritura como intención elevada pero la elevación venció antes de que el servidor la autorice
- **THEN** el sistema no concede permisos por esa marca, rechaza la escritura y registra el intento como rechazado
