# ClubMaster - Documento de Análisis y Requerimientos

## MÓDULO 2: ESPECIFICACIÓN DE REQUERIMIENTOS

---

### 2.1 Requerimientos Funcionales (RF)

Los requerimientos funcionales están categorizados por dominio de negocio y numerados secuencialmente con prefijo **RF-XXX**.

#### 2.1.1 Módulo Ventas y Punto de Venta (POS)

| ID | Requerimiento | Descripción Detallada | Prioridad |
|----|---------------|----------------------|-----------|
| **RF-001** | Gestión Visual de Mesas/Zonas | Plano interactivo editable (drag-drop) con estados en tiempo real: Libre, Ocupada, Cuenta Abierta, Por Cobrar, Reservada. Código de color configurable. Soporte multi-piso/área (VIP, Terraza, Barra). | Alta |
| **RF-002** | Apertura de Mesa/Cuenta | Asignación de nombre/cliente, número de covers, mesero responsable, zona. Generación de ID de cuenta único (prefijo serie + correlativo). Bloqueo de mesa al abrir. | Alta |
| **RF-003** | Toma de Comanda Inteligente | Catálogo jerárquico (Categoría → Subcategoría → Producto). Búsqueda por nombre, código, barcode (cámara/escáner). Modificadores obligatorios/opcionales (ej. punto de cocción, toppings). Notas libres a cocina/barra. Cantidades decimales (botellas fraccionadas). | Alta |
| **RF-004** | Envío a Estaciones de Preparación | Routing automático por tipo de producto (Cocina, Barra, Postres). Impresión de comanda con timestamp, nº mesa, mesero, items con modificadores, prioridad. Reimpresión bajo demanda. | Alta |
| **RF-005** | Gestión de Estados de Comanda | Estados: Pendiente → En Preparación → Listo → Servido → Cancelado. Actualización desde pantalla de cocina (KDS) o móvil mesero. Trazabilidad de tiempos por estado. | Alta |
| **RF-006** | Split & Merge de Cuentas | División de cuenta por items, por comensales (iguales), o montos personalizados. Fusión de mesas (traslado de items y consumos). Historial de movimientos entre cuentas. | Media |
| **RF-007** | Traslado de Items entre Mesas | Drag-drop de items entre cuentas abiertas. Registro de autorización (PIN mesero destino). Ajuste automático de inventario y comisiones. | Media |
| **RF-008** | Happy Hour / Promociones Programadas | Reglas temporales: rango horario, días de semana, productos/categorías aplicables, % descuento o precio fijo. Activación automática. Previsualización en comanda (precio tachado + promo). | Media |
| **RF-009** | Descuentos y Autorizaciones | Descuento por item o total cuenta. Límites por rol: Mesero 0%, Cajero ≤10%, Admin ≤100%. Requerimiento de PIN/supervisor para > límite. Trazabilidad obligatoria (motivo, autorizador). | Alta |
| **RF-010** | Complementarios / Invitaciones (Cortesía) | Marcado de items como "Cortesía" (costo $0, pero registra merma en inventario). Requiere PIN Admin. Reporte separado de cortesías por periodo. | Media |
| **RF-011** | Manejo de Botellas (Botle Service) | Apertura de botella: registro de marca, presentación, nivel inicial. Servicios parciales (shots/copas) con control de nivel restante. Cierre de botella: merma automática vs. teórica. Precio por botella o por servicio. | Alta |

#### 2.1.2 Módulo Facturación y Pagos

| ID | Requerimiento | Descripción Detallada | Prioridad |
|----|---------------|----------------------|-----------|
| **RF-012** | Emisión de Comprobantes Fiscalizados | Factura (A/B/C), Ticket, Nota de Crédito, Nota de Débito. Numeración por serie autorizada (CAE/CAI según legislación local). QR código de verificación fiscal. PDF/impresión térmica simultánea. | Alta |
| **RF-013** | Múltiples Medios de Pago | Efectivo (cálculo cambio), Tarjeta Débito/Crédito (integración POS/PinPad), Transferencia (QR dinámico/alias), Billetera Digital (MercadoPago, Ualá, etc.), Vale/Crédito interno. Pago mixto en una misma factura. | Alta |
| **RF-014** | Propinas y Reparto | Captura de propina: % sugerido (10/15/20%), monto libre, "redondeo". Reparto: individual por mesero, pool por zona/turno, pool general. Liquidación al cierre de turno/caja. | Alta |
| **RF-015** | Notas de Crédito / Devoluciones | Anulación parcial/total de factura cerrada. Requiere autorización Admin (PIN). Reversión automática de inventario (stock + merma). Anulación de comisión mesero. Generación de NC fiscal. | Alta |
| **RF-016** | Cuentas Corrientes / Cliente Frecuente | Límite de crédito por cliente. Consumo a cuenta corriente. Facturación diferida (factura al cierre de mes). Alertas de límite excedido. Historial de pagos y saldos. | Baja |
| **RF-017** | Pre-cierre / Pre-cuenta | Vista previa de cuenta detallada para cliente (sin fiscalizar). Envío a tablet cliente o impresión "precuenta". No afecta inventario ni contabilidad. | Media |

#### 2.1.3 Módulo Inventario y Costos

| ID | Requerimiento | Descripción Detallada | Prioridad |
|----|---------------|----------------------|-----------|
| **RF-018** | Catálogo de Insumos y Productos Terminados | Insumos (materia prima): unidad base, stock actual, stock mínimo, costo promedio, proveedor principal. Productos Terminados (venta): receta (BOM), precio venta, impuestos, categoría, estación impresión. | Alta |
| **RF-019** | Recetas Estándar (Bill of Materials) | Definición de insumos + cantidades por unidad de producto terminado. Rendimiento (mermas de preparación). Sub-recetas (ej. "Base Margarita" usada en múltiples cocteles). Versionado de recetas (vigencia desde/hasta). | Alta |
| **RF-020** | Merma Automática por Venta | Al facturar/entregar item: descuenta insumos según receta × cantidad. Valida stock suficiente (alerta si quiebre). Movimiento de kardex tipo "Salida por Venta" con costo promedio. | Alta |
| **RF-021** | Ajustes de Inventario (Entradas/Salidas Manuales) | Entrada: compra, devolución, transferencia. Salida: merma rotura, degustación, uso interno, robo. Requiere motivo (catálogo) y autorización según monto. Kardex valorado. | Alta |
| **RF-022** | Recepción de Compras / Órdenes de Compra | OC a proveedor. Recepción parcial/total. Validación vs. OC (cantidad, precio). Actualización de costo promedio ponderado. Generación de deuda proveedor (cuentas por pagar). | Media |
| **RF-023** | Alertas de Stock Mínimo y Crítico | Notificación push/email cuando stock ≤ mínimo. Reorden sugerido (lead time proveedor × venta diaria promedio). Dashboard de quiebres y stock crítico. | Media |
| **RF-024** | Inventario Físico / Conteo Cíclico | Generación de planillas de conteo (por zona, categoría, ABC). Captura móvil (tablet). Conciliación sistema vs. físico. Ajuste masivo con autorización. Reporte de diferencias valoradas. | Media |
| **RF-025** | Control de Vasos / Envases Retornables | Stock de vasos prestados por mesa. Cobro de seña/depósito. Devolución al cerrar cuenta. Alerta de faltantes. | Baja |

#### 2.1.4 Módulo Reportes y Analítica

| ID | Requerimiento | Descripción Detallada | Prioridad |
|----|---------------|----------------------|-----------|
| **RF-026** | Dashboard Gerencial en Tiempo Real | KPIs: Ventas totales, Ticket promedio, Mesas activas, Ventas/hora, Top 5 productos, Stock críticos, Caja actual. Actualización < 5 seg. Filtros por turno, fecha, zona. | Alta |
| **RF-027** | Reporte de Ventas Detallado | Desglose por: hora, categoría, producto, mesero, zona, medio de pago, tipo comprobante. Comparativo vs. día anterior / misma semana año anterior. Exportación Excel/CSV/PDF. | Alta |
| **RF-028** | Análisis ABC / Rentabilidad por Producto | Clasificación ABC (ventas $, cantidad, margen). Margen real vs. teórico (costo promedio actual). Identificación de "Stars", "Cash Cows", "Dogs". Sugerencia de ingeniería de menú. | Media |
| **RF-029** | Performance de Meseros | Ventas totales, ticket promedio, items/hora, % propinas, cuentas atendidas, tiempo promedio mesa, upselling (promos vendidas). Ranking. | Media |
| **RF-030** | Rentabilidad por Mesa/Zona | Ingresos vs. costo insumos directos por mesa. Ocupación (horas mesa/horas abiertas). RevPASH (Revenue per Available Seat Hour). | Media |
| **RF-031** | Cierre de Caja / Z-Report | Resumen por medio de pago, facturas emitidas/anuladas, voids, descuentos, propinas, arqueo físico vs. sistema, diferencias. Firma digital cajero + supervisor. PDF fiscal. | Alta |
| **RF-032** | Reporte de Inventario Valorizado | Stock actual × costo promedio = valor inventario. Rotación (días de stock). Productos sin movimiento > 30/60/90 días. Valor de mermas del periodo. | Media |
| **RF-033** | Auditoría de Acciones Críticas | Log inmutable: usuario, acción, entidad afectada, valor anterior/nuevo, timestamp, IP, dispositivo. Filtros y exportación. Cumplimiento regulatorio. | Alta |

#### 2.1.5 Módulo Usuarios, Accesos y Configuración

| ID | Requerimiento | Descripción Detallada | Prioridad |
|----|---------------|----------------------|-----------|
| **RF-034** | Gestión de Usuarios y Roles | CRUD usuarios: datos personales, credenciales, rol(es), sucursal, estado (activo/inactivo/bloqueado). Asignación de permisos granulares por recurso/acción. | Alta |
| **RF-035** | Autenticación y Sesiones | Login email/usuario + password + 2FA TOTP (opcional obligatorio para Admin). JWT access (15 min) + refresh (7 días). Bloqueo tras 5 intentos fallidos (15 min). Cierre sesión remoto (Admin). | Alta |
| **RF-036** | Control de Turnos | Apertura/cierre de turno por usuario. Validación de solapamiento. Arqueo de apertura (fondo de caja inicial). Cierre con conciliación. Reporte de horas trabajadas. | Alta |
| **RF-037** | Configuración de Parámetros del Sistema | Impuestos (IVA, percepciones), series de facturación, numeradores, impresoras por estación, monedas/tasas, horarios de turno, alertas, logos, textos legales. Versionado y auditoría. | Alta |
| **RF-038** | Multi-sucursal / Multi-empresa | Aislamiento de datos por sucursal. Usuario con acceso a una o varias. Consolidación de reportes a nivel grupo. Configuración compartida o independiente por sucursal. | Media |
| **RF-039** | API REST Documentada (OpenAPI 3.0) | Endpoints para: catálogo, ventas, inventario, usuarios, reportes. Autenticación Bearer Token (JWT). Rate limiting. Webhooks para eventos: venta, pago, stock bajo, cierre caja. | Media |
| **RF-040** | Modo Offline (Resiliencia) | Cache local (IndexedDB/Service Worker) para toma de comandas sin conexión. Sincronización automática al recuperar conexión. Cola de eventos pendientes. Resolución de conflictos (last-write-wins + log). | Alta |

---

### 2.2 Requerimientos No Funcionales (RNF)

Categorizados según norma ISO/IEC 25010.

#### 2.2.1 Seguridad (Security)

| ID | Requerimiento | Descripción | Métrica/Verificación |
|----|---------------|-------------|---------------------|
| **RNF-SEG-01** | Autenticación Robusta | Password policy: 12 chars, mayúscula, minúscula, número, símbolo. Hash Argon2id. 2FA TOTP obligatorio Admin. | Pen-test, OWASP ASVS L2 |
| **RNF-SEG-02** | Autorización Basada en Roles (RBAC) | Matriz de permisos por recurso/acción. Validación en backend (middleware) y frontend (guards). | Pruebas de penetración de autorización |
| **RNF-SEG-03** | Cifrado en Tránsito y Reposo | TLS 1.3 obligatorio. AES-256-GCM para datos sensibles en BD (passwords, tokens, datos fiscales). | Certificados válidos, auditoría BD |
| **RNF-SEG-04** | Protección contra OWASP Top 10 | Rate limiting, CSP, HSTS, X-Frame-Options, sanitización inputs, parameterized queries, dependency scanning. | SAST/DAST en CI/CD |
| **RNF-SEG-05** | Auditoría Inmutable (Append-Only) | Tabla de auditoría sin DELETE/UPDATE. Trigger BD + hash encadenado (hash_prev + hash_actual). | Verificación criptográfica de integridad |
| **RNF-SEG-06** | Cumplimiento Fiscal Local | Generación de archivos fiscales (RG3685, SIFERE, etc. según país). Timbrado/CAE online. Conservación 10 años. | Certificación ente fiscal |

#### 2.2.2 Rendimiento (Performance)

| ID | Requerimiento | Descripción | Métrica/Verificación |
|----|---------------|-------------|---------------------|
| **RNF-REN-01** | Tiempo de Respuesta POS | Toma de comanda → envío a impresora < 800 ms (P95). Apertura de mesa < 500 ms. | Load testing (k6/JMeter) 200 usuarios concurrentes |
| **RNF-REN-02** | Throughput Facturación | 50 facturas/minuto sostenidas. Pico 120 facturas/min (cierre de noche). | Stress test 2h |
| **RNF-REN-03** | Consulta Reportes Complejos | Dashboard gerencial < 2 seg. Reporte histórico 30 días < 5 seg. Exportación Excel 100k filas < 10 seg. | Query profiling, índices |
| **RNF-REN-04** | Disponibilidad (Uptime) | 99.9% mensual (excluye mantenimiento programado domingos 04:00-06:00). RTO < 15 min, RPO < 1 min. | Monitoreo uptime (Prometheus/Grafana) |
| **RNF-REN-05** | Escalabilidad Horizontal | Backend stateless + Redis session store. BD read-replicas para reportes. Kubernetes HPA (CPU > 70%). | Test de escalado automático |
| **RNF-REN-06** | Modo Offline Latencia Cero | Operaciones locales (comandas, pagos efectivo) < 100 ms sin red. Sync en background < 30 seg post-reconexión. | Simulación desconexión red |

#### 2.2.3 Usabilidad y Accesibilidad (Usability)

| ID | Requerimiento | Descripción | Métrica/Verificación |
|----|---------------|-------------|---------------------|
| **RNF-USA-01** | Interfaz Responsive Multi-dispositivo | Desktop (1920px), Tablet (1024px/768px), Móvil (375px). Touch-friendly (targets ≥ 48dp). Modo kiosco tablets mesero. | Pruebas en device lab real |
| **RNF-USA-02** | Accesibilidad WCAG 2.1 AA | Contraste 4.5:1, navegación teclado, ARIA labels, foco visible, textos alternativos, zoom 200% sin pérdida función. | Auditoría axe-core + manual |
| **RNF-USA-03** | Flujo de Trabajo Optimizado (UX) | Máx. 3 taps para acción frecuente (tomar comanda, cobrar). Feedback visual inmediato (< 100 ms). Undo rápido (5 seg) para errores. | Usability testing 5 usuarios representativos |
| **RNF-USA-04** | Internacionalización (i18n) | Español (AR, MX, CO, ES), Portugués (BR), Inglés. Formatos fecha/hora/moneda por locale. RTL ready. | Tests de localización |
| **RNF-USA-05** | Modo Oscuro / Contraste Alto | Tema oscuro nativo. Modo alto contraste para ambientes de baja luz (discoteca). Persistencia por usuario/dispositivo. | Validación visual en condiciones reales |

#### 2.2.4 Tecnológicos y Arquitectónicos (Technical)

| ID | Requerimiento | Descripción | Métrica/Verificación |
|----|---------------|-------------|---------------------|
| **RNF-TEC-01** | Stack Tecnológico Definido | Backend: Node.js 20 LTS, Fastify, TypeScript, Prisma ORM. Frontend: React 18, Vite, TanStack Query, TailwindCSS. BD: PostgreSQL 15 + Redis 7. | Documentación arquitectura (ADR) |
| **RNF-TEC-02** | Contenerización y Despliegue | Docker multi-stage. Docker Compose (dev) / Kubernetes Helm (prod). CI/CD GitHub Actions/GitLab CI. | Pipeline verde en < 10 min |
| **RNF-TEC-03** | Observabilidad Completa | Logs estructurados (JSON, Pino), Métricas (Prometheus), Tracing (OpenTelemetry/Jaeger), Alertas (Alertmanager). | Dashboards operativos cubriendo 100% RF críticos |
| **RNF-TEC-04** | Base de Datos: Integridad y Migraciones | FK, CHECK constraints, índices compuestos, particionado mensual (ventas, auditoría). Migraciones versionadas (Prisma Migrate). Rollback automatizado. | Zero-downtime migrations |
| **RNF-TEC-05** | Backup y Disaster Recovery | Backup diario incremental + semanal full (pgBackRest). Point-in-time recovery (PITR). Test de restauración mensual documentado. | RPO < 1 min, RTO < 30 min |
| **RNF-TEC-06** | Versionado Semántico y Changelog | SemVer (MAJOR.MINOR.PATCH). Conventional Commits. CHANGELOG.md automático (standard-version). | Release notes cada deploy |
| **RNF-TEC-07** | Testing Automatizado | Unit (≥80% coverage), Integration (contratos API), E2E (Playwright: flujos críticos POS, caja, inventario). Contract testing (Pact). | Quality gate en CI: coverage, mutación, E2E pass |
| **RNF-TEC-08** | Documentación Técnica Viva | OpenAPI 3.0 (Swagger UI), Storybook (componentes), ADRs (decisiones arquitectónicas), Runbooks operativos. | Docs versionadas con código |

---

> **Fin del Módulo 2** — *Especificación de Requerimientos Funcionales y No Funcionales*  
> *Total: 40 RF + 24 RNF = 64 requerimientos trazables*  
> *Documento controlado bajo procedimiento de gestión de configuración ClubMaster v1.0*