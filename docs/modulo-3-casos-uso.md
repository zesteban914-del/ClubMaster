# ClubMaster - Documento de Análisis y Requerimientos

## MÓDULO 3: CATÁLOGO DE CASOS DE USO

---

### 3.1 Listado General de Casos de Uso

La siguiente tabla enumera todos los casos de uso del sistema, agrupados por paquete funcional, indicando el(los) actor(es) principal(es) que los inician y su identificación única (CU-XXX).

| ID | Caso de Uso | Actor(es) Principal(es) | Paquete |
|----|-------------|------------------------|---------|
| **CU-01** | Iniciar Sesión / Autenticarse | Administrador, Cajero, Mesero | Seguridad |
| **CU-02** | Cerrar Sesión | Administrador, Cajero, Mesero | Seguridad |
| **CU-03** | Gestionar Usuarios y Roles | Administrador | Administración |
| **CU-04** | Configurar Parámetros del Sistema | Administrador | Administración |
| **CU-05** | Gestionar Sucursales y Zonas | Administrador | Administración |
| **CU-06** | Diseñar Plano de Mesas | Administrador | Administración |
| **CU-07** | Gestionar Catálogo de Productos | Administrador | Catálogo |
| **CU-08** | Gestionar Recetas (BOM) | Administrador | Catálogo |
| **CU-09** | Gestionar Promociones / Happy Hour | Administrador | Catálogo |
| **CU-10** | Gestionar Impuestos y Series Fiscales | Administrador | Catálogo |
| **CU-11** | Abrir Mesa / Iniciar Cuenta | Mesero | Ventas - Mesas |
| **CU-12** | Consultar Estado de Mesas (Plano) | Mesero, Cajero, Administrador | Ventas - Mesas |
| **CU-13** | Tomar Comanda | Mesero | Ventas - Comandas |
| **CU-14** | Modificar Comanda (antes de enviar) | Mesero | Ventas - Comandas |
| **CU-15** | Enviar Comanda a Preparación | Mesero | Ventas - Comandas |
| **CU-16** | Consultar Estado de Comanda | Mesero | Ventas - Comandas |
| **CU-17** | Trasladar Items entre Mesas | Mesero | Ventas - Comandas |
| **CU-18** | Unificar / Dividir Cuentas (Split & Merge) | Mesero, Cajero | Ventas - Comandas |
| **CU-19** | Solicitar Cuenta / Pre-cuenta | Mesero | Ventas - Facturación |
| **CU-20** | Facturar Cuenta (Cierre Total/Parcial) | Cajero | Ventas - Facturación |
| **CU-21** | Procesar Pago Múltiples Medios | Cajero | Ventas - Facturación |
| **CU-22** | Emitir Nota de Crédito / Devolución | Cajero (con auth Admin) | Ventas - Facturación |
| **CU-23** | Aplicar Descuento / Cortesía | Cajero, Administrador | Ventas - Facturación |
| **CU-24** | Gestionar Propinas (Reparto/Liquidación) | Cajero, Administrador | Ventas - Facturación |
| **CU-25** | Registrar Botella (Bottle Service) | Mesero | Ventas - Especial |
| **CU-26** | Servir porción de Botella | Mesero | Ventas - Especial |
| **CU-27** | Cerrar Botella (Merma Final) | Mesero, Cajero | Ventas - Especial |
| **CU-28** | Realizar Ajuste de Inventario (Entrada/Salida) | Administrador | Inventario |
| **CU-29** | Recepcionar Orden de Compra | Administrador | Inventario |
| **CU-30** | Generar Orden de Compra Sugerida | Administrador | Inventario |
| **CU-31** | Realizar Conteo Físico / Inventario Cíclico | Administrador | Inventario |
| **CU-32** | Consultar Stock y Alertas | Administrador, Mesero (consulta) | Inventario |
| **CU-33** | Gestionar Vasos/Envases Retornables | Mesero, Cajero | Inventario |
| **CU-34** | Abrir Turno / Arqueo Inicial | Cajero, Administrador | Caja |
| **CU-35** | Cerrar Turno / Arqueo Final (Z-Report) | Cajero, Administrador | Caja |
| **CU-36** | Consultar Ventas del Turno | Cajero | Caja |
| **CU-37** | Visualizar Dashboard Gerencial | Administrador | Reportes |
| **CU-38** | Generar Reporte de Ventas Detallado | Administrador | Reportes |
| **CU-39** | Generar Análisis ABC / Rentabilidad | Administrador | Reportes |
| **CU-40** | Generar Performance Meseros | Administrador | Reportes |
| **CU-41** | Generar Reporte de Inventario Valorizado | Administrador | Reportes |
| **CU-42** | Consultar Auditoría de Acciones Críticas | Administrador | Reportes |
| **CU-43** | Exportar Datos (Excel/PDF/CSV) | Administrador, Cajero | Reportes |
| **CU-44** | Operar en Modo Offline | Mesero, Cajero | Resiliencia |
| **CU-45** | Sincronizar Datos Offline | Sistema (automático) | Resiliencia |

---

### 3.2 Diagrama de Casos de Uso (Mermaid.js)

#### 3.2.1 Vista General del Sistema

```mermaid
useCaseDiagram
    package "ClubMaster" {
        actor "Administrador" as Admin
        actor "Cajero" as Cashier
        actor "Mesero" as Waiter
        actor "Sistema Externo\n(Fiscal, Pagos)" as External

        package "Seguridad y Acceso" {
            usecase "CU-01 Iniciar Sesión" as UC01
            usecase "CU-02 Cerrar Sesión" as UC02
            usecase "CU-44 Operar Offline" as UC44
        }

        package "Administración" {
            usecase "CU-03 Gestionar Usuarios/Roles" as UC03
            usecase "CU-04 Configurar Parámetros" as UC04
            usecase "CU-05 Gestionar Sucursales/Zonas" as UC05
            usecase "CU-06 Diseñar Plano Mesas" as UC06
        }

        package "Catálogo y Configuración" {
            usecase "CU-07 Gestionar Productos" as UC07
            usecase "CU-08 Gestionar Recetas (BOM)" as UC08
            usecase "CU-09 Gestionar Promociones" as UC09
            usecase "CU-10 Impuestos/Series Fiscales" as UC10
        }

        package "Ventas: Mesas y Comandas" {
            usecase "CU-11 Abrir Mesa/Cuenta" as UC11
            usecase "CU-12 Consultar Plano Mesas" as UC12
            usecase "CU-13 Tomar Comanda" as UC13
            usecase "CU-14 Modificar Comanda" as UC14
            usecase "CU-15 Enviar a Preparación" as UC15
            usecase "CU-16 Consultar Estado Comanda" as UC16
            usecase "CU-17 Trasladar Items" as UC17
            usecase "CU-18 Split/Merge Cuentas" as UC18
        }

        package "Ventas: Facturación y Pagos" {
            usecase "CU-19 Solicitar Cuenta" as UC19
            usecase "CU-20 Facturar Cuenta" as UC20
            usecase "CU-21 Procesar Pago Múltiple" as UC21
            usecase "CU-22 Nota Crédito/Devolución" as UC22
            usecase "CU-23 Descuento/Cortesía" as UC23
            usecase "CU-24 Gestionar Propinas" as UC24
        }

        package "Ventas: Bottle Service" {
            usecase "CU-25 Registrar Botella" as UC25
            usecase "CU-26 Servir Porción Botella" as UC26
            usecase "CU-27 Cerrar Botella" as UC27
        }

        package "Inventario" {
            usecase "CU-28 Ajuste Inventario" as UC28
            usecase "CU-29 Recepcionar Compra" as UC29
            usecase "CU-30 Generar OC Sugerida" as UC30
            usecase "CU-31 Conteo Físico" as UC31
            usecase "CU-32 Consultar Stock/Alertas" as UC32
            usecase "CU-33 Vasos Retornables" as UC33
        }

        package "Caja y Turnos" {
            usecase "CU-34 Abrir Turno/Arqueo Inicial" as UC34
            usecase "CU-35 Cerrar Turno/Z-Report" as UC35
            usecase "CU-36 Consultar Ventas Turno" as UC36
        }

        package "Reportes y Analítica" {
            usecase "CU-37 Dashboard Gerencial" as UC37
            usecase "CU-38 Reporte Ventas Detallado" as UC38
            usecase "CU-39 Análisis ABC/Rentabilidad" as UC39
            usecase "CU-40 Performance Meseros" as UC40
            usecase "CU-41 Inventario Valorizado" as UC41
            usecase "CU-42 Auditoría Acciones" as UC42
            usecase "CU-43 Exportar Datos" as UC43
        }

        package "Resiliencia" {
            usecase "CU-45 Sincronizar Offline" as UC45
        }
    }

    %% Relaciones Actores - Casos de Uso
    Admin --> UC01
    Admin --> UC02
    Admin --> UC03
    Admin --> UC04
    Admin --> UC05
    Admin --> UC06
    Admin --> UC07
    Admin --> UC08
    Admin --> UC09
    Admin --> UC10
    Admin --> UC12
    Admin --> UC28
    Admin --> UC29
    Admin --> UC30
    Admin --> UC31
    Admin --> UC32
    Admin --> UC34
    Admin --> UC35
    Admin --> UC37
    Admin --> UC38
    Admin --> UC39
    Admin --> UC40
    Admin --> UC41
    Admin --> UC42
    Admin --> UC43

    Cashier --> UC01
    Cashier --> UC02
    Cashier --> UC12
    Cashier --> UC18
    Cashier --> UC19
    Cashier --> UC20
    Cashier --> UC21
    Cashier --> UC22
    Cashier --> UC23
    Cashier --> UC24
    Cashier --> UC27
    Cashier --> UC33
    Cashier --> UC34
    Cashier --> UC35
    Cashier --> UC36
    Cashier --> UC43
    Cashier --> UC44

    Waiter --> UC01
    Waiter --> UC02
    Waiter --> UC11
    Waiter --> UC12
    Waiter --> UC13
    Waiter --> UC14
    Waiter --> UC15
    Waiter --> UC16
    Waiter --> UC17
    Waiter --> UC18
    Waiter --> UC19
    Waiter --> UC25
    Waiter --> UC26
    Waiter --> UC27
    Waiter --> UC32
    Waiter --> UC33
    Waiter --> UC44

    External --> UC20
    External --> UC21
    External --> UC22
    External --> UC10

    %% Include / Extend Relationships
    UC13 .> UC14 : <<extend>>\n(modificar antes enviar)
    UC13 .> UC09 : <<include>>\n(aplicar promo vigente)
    UC20 .> UC21 : <<include>>\n(procesar pago)
    UC20 .> UC24 : <<include>>\n(liquidar propinas)
    UC20 .> UC23 : <<extend>>\n(descuento autorizado)
    UC20 .> UC22 : <<extend>>\n(devolución post-factura)
    UC25 .> UC26 : <<extend>>\n(servicios sucesivos)
    UC25 .> UC27 : <<extend>>\n(cierre final)
    UC28 .> UC32 : <<include>>\n(validar stock)
    UC29 .> UC07 : <<include>>\n(actualizar catálogo)
    UC31 .> UC28 : <<include>>\n(ajuste por diferencia)
    UC34 .> UC35 : <<extend>>\n(ciclo completo turno)
    UC35 .> UC36 : <<include>>\n(detalle ventas)
    UC44 .> UC45 : <<extend>>\n(sync automático)
    UC01 .> UC44 : <<extend>>\n(modo offline)
```

#### 3.2.2 Detalle: Paquete Ventas - Flujo Núcleo (Mesero ↔ Cajero)

```mermaid
useCaseDiagram
    actor "Mesero" as Waiter
    actor "Cajero" as Cashier
    actor "Administrador" as Admin

    package "Flujo Núcleo de Venta" {
        usecase "CU-11 Abrir Mesa" as UC11
        usecase "CU-13 Tomar Comanda" as UC13
        usecase "CU-15 Enviar a Preparación" as UC15
        usecase "CU-16 Consultar Estado" as UC16
        usecase "CU-17 Trasladar Items" as UC17
        usecase "CU-18 Split/Merge" as UC18
        usecase "CU-19 Solicitar Cuenta" as UC19
        usecase "CU-20 Facturar Cuenta" as UC20
        usecase "CU-21 Procesar Pago" as UC21
        usecase "CU-24 Liquidar Propinas" as UC24
    }

    Waiter --> UC11
    Waiter --> UC13
    Waiter --> UC15
    Waiter --> UC16
    Waiter --> UC17
    Waiter --> UC18
    Waiter --> UC19

    Cashier --> UC19
    Cashier --> UC20
    Cashier --> UC21
    Cashier --> UC24

    Admin --> UC20
    Admin --> UC24

    UC13 .> UC15 : <<include>>
    UC19 .> UC20 : <<extend>>\n(cajero factura)
    UC20 .> UC21 : <<include>>
    UC20 .> UC24 : <<include>>
    UC13 .> UC17 : <<extend>>\n(traslado items)
    UC13 .> UC18 : <<extend>>\n(split/merge)
```

#### 3.2.3 Detalle: Inventario y Compras

```mermaid
useCaseDiagram
    actor "Administrador" as Admin
    actor "Proveedor\n(Externo)" as Supplier

    package "Inventario" {
        usecase "CU-28 Ajuste Inventario" as UC28
        usecase "CU-29 Recepcionar Compra" as UC29
        usecase "CU-30 Generar OC Sugerida" as UC30
        usecase "CU-31 Conteo Físico" as UC31
        usecase "CU-32 Consultar Stock/Alertas" as UC32
    }

    package "Catálogo" {
        usecase "CU-07 Gestionar Productos" as UC07
        usecase "CU-08 Gestionar Recetas" as UC08
    }

    Admin --> UC28
    Admin --> UC29
    Admin --> UC30
    Admin --> UC31
    Admin --> UC32
    Admin --> UC07
    Admin --> UC08

    Supplier --> UC29

    UC29 .> UC07 : <<include>>\n(actualizar costos/stock)
    UC29 .> UC08 : <<include>>\n(validar recetas)
    UC30 .> UC32 : <<include>>\n(stock mínimo + lead time)
    UC31 .> UC28 : <<include>>\n(ajuste diferencias)
    UC28 .> UC32 : <<include>>\n(validar stock resultante)
    UC13 .> UC32 : <<include>>\n(validar disponibilidad)
    UC20 .> UC32 : <<include>>\n(merma automática)
```

---

### 3.3 Matriz de Trazabilidad: Requerimientos Funcionales ↔ Casos de Uso

| RF ID | Casos de Uso Relacionados |
|-------|---------------------------|
| RF-001 | CU-12, CU-06 |
| RF-002 | CU-11 |
| RF-003 | CU-13, CU-14 |
| RF-004 | CU-15 |
| RF-005 | CU-16 |
| RF-006 | CU-18 |
| RF-007 | CU-17 |
| RF-008 | CU-09, CU-13 |
| RF-009 | CU-23 |
| RF-010 | CU-23 |
| RF-011 | CU-25, CU-26, CU-27 |
| RF-012 | CU-20, CU-22 |
| RF-013 | CU-21 |
| RF-014 | CU-24 |
| RF-015 | CU-22 |
| RF-016 | CU-20 |
| RF-017 | CU-19 |
| RF-018 | CU-07, CU-08, CU-32 |
| RF-019 | CU-08 |
| RF-020 | CU-20, CU-25, CU-26, CU-27 |
| RF-021 | CU-28, CU-31 |
| RF-022 | CU-29 |
| RF-023 | CU-30, CU-32 |
| RF-024 | CU-31 |
| RF-025 | CU-33 |
| RF-026 | CU-37 |
| RF-027 | CU-38 |
| RF-028 | CU-39 |
| RF-029 | CU-40 |
| RF-030 | CU-38, CU-39 |
| RF-031 | CU-35 |
| RF-032 | CU-41 |
| RF-033 | CU-42 |
| RF-034 | CU-03 |
| RF-035 | CU-01, CU-02, CU-44 |
| RF-036 | CU-34, CU-35 |
| RF-037 | CU-04, CU-05, CU-06, CU-10 |
| RF-038 | CU-05 |
| RF-039 | (Transversal - API) |
| RF-040 | CU-44, CU-45 |

---

> **Fin del Módulo 3** — *Catálogo de Casos de Uso y Diagramas Mermaid*  
> *Total: 45 Casos de Uso identificados y trazados a Requerimientos Funcionales*  
> *Documento controlado bajo procedimiento de gestión de configuración ClubMaster v1.0*