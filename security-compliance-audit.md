# Auditoría técnica de seguridad y preparación de cumplimiento — Aksis

**Fecha:** 4 de octubre de 2026  
**Método:** revisión estática de frontend, API, migraciones de Supabase, configuración versionada y dependencias de producción.  
**Estado:** diagnóstico inicial; no es certificación de seguridad ni dictamen jurídico.

## Alcance y límites

Se revisaron las rutas Next.js, componentes cliente, lógica de autorización de API, migraciones y políticas RLS incluidas en el repositorio. `npm audit --omit=dev` no informó vulnerabilidades conocidas de producción al momento de la revisión.

No se inspeccionaron valores de secretos, la configuración desplegada de Supabase/Vercel, buckets reales, logs, reglas de autenticación, DNS, backups, acuerdos contractuales ni jurisdicciones comerciales definitivas. Los puntos marcados **Verificación requerida** necesitan evidencia de esas plataformas.

## Resumen ejecutivo

No se recomienda habilitar pagos reales, publicación comercial ni procesar datos de producción hasta resolver los hallazgos críticos y altos. El problema más importante es una diferencia entre el modelo de privacidad prometido y las políticas actualmente versionadas: superadministración y coaches asignados pueden leer contenido de sesiones, bitácora y resúmenes que `design.md` define como privados.

| Severidad | Cantidad | Estado de salida |
| --- | ---: | --- |
| Crítica | 3 | Corregir antes de cualquier piloto con datos reales o cobro. |
| Alta | 8 | Corregir antes de publicación o beta externa. |
| Media | 8 | Planificar y cerrar antes de producción. |
| Verificación requerida | 7 | Validar en plataformas y con legal antes de producción. |

## Lista de trabajo acordada con producto

### En espera hasta la siguiente etapa

| ID | Decisión | Condición para retomarlo |
| --- | --- | --- |
| SEC-01 | Mantener compra simulada durante preproducción. | Antes de habilitar pagos o usuarios fuera de QA: reemplazarla por cobro validado y ledger. |
| SEC-06 | No implementar todavía el control de edad en servidor. | Antes de abrir registro al público o admitir menores. |
| COMP-01 | Postergar revisión integral de categorías sensibles y textos legales. | Antes de producción. |
| COMP-02 | Mantener el estado provisorio de responsable, jurisdicción y contratos. | Antes de producción. |
| COMP-03 | Postergar GDPR/DPIA. | Antes de ofrecer el servicio a personas en EEE. |
| COMP-04 | Mantener el enfoque actual de mayores de edad y crisis durante QA. | Antes de producción pública. |

### Trabajo técnico para QA — orden de ejecución

1. **SEC-02 — Privacidad frente a superadmin.** Quitar el acceso RLS de superadmin a sesiones, mensajes, bitácora, fotos y resúmenes; conservar únicamente metadatos operativos agregados.
2. **SEC-03 — Privacidad frente a coach.** Quitar el acceso automático de coaches a bitácora, fotos y resúmenes. Como aún no existe la vinculación con coaches humanos, no se implementará todavía `journal_shares`; se prepara el esquema para incorporarlo después.
3. **SEC-04 — Suspensión de cuentas.** Impedir en base de datos que el atleta modifique `account_status`.
4. **SEC-05 — Consentimientos.** Validar aceptación contra las versiones activas en servidor/base de datos y exigir reaceptación cuando se publique una nueva versión.
5. **SEC-07 — Bloques.** Convertir el descuento de bloques en una operación transaccional/idempotente y dejar la compra simulada claramente aislada de producción.
6. **SEC-12 — Historia del chat.** Hacer que el servidor recupere la historia de la sesión en lugar de confiar en la historia completa enviada por navegador.
7. **SEC-13 — Integridad de escrituras.** Comprobar errores de persistencia y reemplazar operaciones compuestas por RPC/transacciones donde corresponda.
8. **SEC-08 — Protección de API.** Incorporar rate limiting, límites de tamaño, cabeceras de seguridad y control básico de abuso.
9. **SEC-19 — Protección de rutas.** Añadir guard server-side para atleta, admin y laboratorio; RLS sigue como segunda barrera.
10. **SEC-09 — Auditoría administrativa.** Mover mutaciones administrativas a API/RPC con validación y auditoría append-only minimizada.
11. **SEC-10 — Consentimientos de IA.** Modelar consentimiento granular para IA, resumen semanal y fotos; no enviar imágenes a IA sin opt-in por entrada.
12. **SEC-16 — Cron semanal.** Hacer el job idempotente y sensible a la zona horaria/consentimiento del atleta.
13. **SEC-17 — Guardrails.** Implementar clasificador estructurado de entrada/salida, rutas seguras y pruebas de regresión.
14. **SEC-18 — Logs.** Reemplazar logs libres por logging estructurado con redacción de contenido sensible.
15. **SEC-14 — Claves de proveedores.** Eliminar el fallback a `SUPABASE_SECRET_KEY`; exigir clave de cifrado independiente y versionada.
16. **SEC-15 — Imágenes.** Añadir validación de archivos en servidor, retiro de EXIF y pipeline seguro de almacenamiento.

### Dependencias de trabajo

- Los puntos 1–4 deben resolverse primero: corrigen el acceso a datos y consentimiento.
- Los puntos 5–7 preservan consistencia y control de consumo.
- Los puntos 8–10 endurecen la superficie operativa.
- Los puntos 11–16 completan privacidad, IA, observabilidad y adjuntos.

---

## Hallazgos críticos

### SEC-01 — El endpoint de compra simulada entrega créditos gratis
MARIANO: Ok, por ahora ya que todavía estamos en preproduccion

**Evidencia:** `src/app/api/coach/purchase-blocks/route.ts` permite a cualquier atleta autenticado enviar `blocks` entre 1 y 20. Actualiza `blocks_available` y registra un evento simulado sin una validación de pago, feature flag de entorno ni restricción a testers.

**Impacto:** cualquier usuario puede incrementar su saldo repetidamente y consumir IA sin costo. En producción deriva en fraude, gasto no controlado y registros comerciales incorrectos.

**Corrección propuesta:** retirar esta ruta de producción. Mantenerla solo en desarrollo con una comprobación estricta de entorno y una allowlist de cuentas de prueba; para producción, reemplazarla por un flujo de pago server-side con webhook firmado, idempotencia y libro mayor inmutable. Añadir límites de gasto por usuario y alertas de consumo anómalo.

**Criterio de cierre:** un atleta no puede modificar saldo salvo por un evento comercial validado en servidor; cada movimiento tiene origen, idempotency key, actor y saldo resultante verificables.

### SEC-02 — RLS permite a superadmin leer contenido privado de coaching y bitácora
MARIANO: OK, corregir

**Evidencia:** en `supabase/migrations/20261002160215_initial_aksis_schema.sql` las políticas `sessions_select`, `session_messages_select`, `journal_entries_select`, `journal_media_select` y `athlete_context_summaries_select` incluyen `public.is_superadmin()`.

**Impacto:** contradice el modelo de privacidad definido: superadmin debe gestionar metadatos operativos, no transcripciones, resúmenes internos, bitácora, fotos ni notas privadas. Un rol operativo comprometido o usado indebidamente podría acceder a contenido íntimo.

**Corrección propuesta:** eliminar el bypass superadmin de contenido sensible. Crear vistas agregadas y minimizadas para métricas operativas (conteos, costos, errores, estado), sin texto, fotos ni identificadores innecesarios. Reservar accesos excepcionales a un procedimiento de soporte documentado, temporal, con motivo, doble autorización y auditoría inmutable.

**Criterio de cierre:** una sesión de prueba con superadmin recibe cero filas de contenido sensible por Data API y solo puede consultar vistas de metadatos aprobadas.

### SEC-03 — Coaches asignados tienen acceso automático a bitácora y resúmenes privados
MARIANO: Ok, Corregir. pero ten presente que aun no desarrollamos la vinculacion con Coaches humanos

**Evidencia:** las políticas de `journal_entries`, `journal_media`, `journal_entry_followups` y `athlete_context_summaries` permiten acceso si `public.is_assigned_coach(athlete_id)` es verdadero.

**Impacto:** contradice la regla de producto: la bitácora y fotos son privadas; un coach solo puede ver una entrada o resumen mediante una acción explícita, revocable y con alcance/vigencia. Es una exposición de datos sensibles de alto impacto.

**Corrección propuesta:** quitar `is_assigned_coach` de esas políticas. Implementar `journal_shares` con atleta, recurso, coach, alcance, fecha de vencimiento, revocación y trazabilidad; las políticas deben evaluar exclusivamente ese permiso. Separar el contexto de coaching autorizado de la bitácora privada.

**Criterio de cierre:** un coach asignado no puede consultar bitácora/fotos/resúmenes sin un share vigente; una revocación bloquea de inmediato la lectura y las URLs firmadas expiran en minutos.

---

## Hallazgos altos

### SEC-04 — Un atleta puede reactivar su propia cuenta suspendida
MARIANO: Ok, corregir

**Evidencia:** `profiles_update_self` permite actualizar toda la fila cuando `id = auth.uid()`. El trigger solo impide cambiar `role`; no restringe `account_status`. La API considera suspendida a la cuenta según ese campo.

**Impacto:** un usuario suspendido puede actualizar su perfil vía Data API y restaurar `account_status = 'active'`.

**Corrección propuesta:** impedir cambios de `account_status` en un trigger o separar el estado operativo en una tabla actualizable solo por funciones server-side/superadmin. Exponer al atleta una RPC o endpoint con campos explícitamente permitidos, no `update` libre de `profiles`.

### SEC-05 — Aceptación legal falsificable y sin reaceptación por nueva versión
MARIANO: Ok, Corregir

**Evidencia:** `terms_acceptances_insert_own` acepta cualquier `document_key`, `document_version` y `document_hash` enviados por el cliente. `AppGate` solo comprueba que existan tres filas de aceptación, no que correspondan a las versiones vigentes.

**Impacto:** no hay evidencia sólida de consentimiento informado para los documentos actuales; al actualizar términos o privacidad, usuarios anteriores continúan accediendo sin reaceptar.

**Corrección propuesta:** registrar aceptación exclusivamente a través de una función SQL o endpoint que lea la versión publicada vigente, valide documentos requeridos y derive hash/versión desde `legal_documents`. Al ingresar, comparar aceptaciones con versiones activas. Añadir marca de consentimiento por finalidad (términos, privacidad, IA, fotos, voz futura) y retiro revocable donde corresponda.

### SEC-06 — Mayoría de edad controlada solo en el navegador
MARIANO: este todavía no lo implementemos porque aun estamos en pre-produccion pero es algo que tenemos que tener en cuenta despues

**Estado:** implementado para el MVP exclusivo para mayores de 18 años. La migración `20261004174000_enforce_adult_only_policy.sql` valida la fecha de nacimiento en base de datos, incluso si se omite el formulario.

**Evidencia:** `src/components/onboarding-flow.tsx` calcula 18 años en cliente. Un usuario puede omitir o alterar esa comprobación usando la API directa.

**Impacto:** la restricción declarada para mayores de 18 años no es exigible técnicamente.

**Corrección propuesta:** validar fecha de nacimiento y edad en una RPC/end-point de onboarding del servidor; aplicar una regla de base de datos o estado `ineligible` que bloquee sesiones y funciones sensibles. Definir la política de menores antes de habilitar cualquier excepción.

### SEC-07 — Consumo de bloques no atómico y sin libro mayor inmutable
MARIANO: Ok, corregir

**Estado:** implementado en la migración `20261004164000_transactional_session_block_ledger.sql`.

**Evidencia:** `src/app/api/coach/route.ts` lee saldo, calcula bloques y realiza tres escrituras separadas (`user_subscriptions`, `coaching_sessions`, `billing_events`) con cliente de privilegios elevados.

**Impacto:** solicitudes concurrentes, reintentos o fallas parciales pueden duplicar/diluir saldo, cobrar incorrectamente o dejar inconsistencias. `billing_events` no es un ledger inmutable.

**Corrección propuesta:** implementar una función PostgreSQL transaccional que bloquee la suscripción, calcule bloques por reloj del servidor, genere un único movimiento inmutable de crédito y actualice el estado. Usar idempotency key por turno/bloque, restricciones de no-negatividad y pruebas de concurrencia.

### SEC-08 — Sin rate limiting ni defensas de abuso en API sensible
MARIANO: Ok, corregir

**Estado:** implementado un límite server-side por ruta, IP y usuario para las APIs sensibles, límites estrictos de cuerpo JSON y cabeceras de seguridad. La migración `20261004180000_shared_api_rate_limits.sql` reemplaza el contador en memoria por una ventana fija atómica en Supabase, compartida entre réplicas. La migración `20261005110000_ai_provider_circuit_breaker.sql` suma un circuit breaker compartido: tras tres fallas consecutivas de un proveedor, evita nuevos llamados por dos minutos. Antes de producción conviene añadir una política de purga de ventanas antiguas y una capa WAF del host para absorber ataques antes de alcanzar la aplicación.

**Evidencia:** no hay middleware ni controles de tasa en rutas de coach, cierre, proveedor, compra simulada o cron; `next.config.ts` no define cabeceras de seguridad.

**Impacto:** abuso de IA, agotamiento de bloques, fuerza bruta sobre rutas, costo no controlado y degradación de servicio.

**Corrección propuesta:** aplicar rate limiting server-side por usuario, IP y ruta; límites de concurrencia/sesiones, cuota diaria de IA, body size limit y circuit breaker de proveedor. Definir cabeceras CSP, HSTS en producción, `X-Content-Type-Options`, `Referrer-Policy` y `frame-ancestors`.

### SEC-09 — Operaciones administrativas directas desde cliente sin trazabilidad completa
MARIANO: Ok, corregir

**Estado:** implementado para planes, estado y suscripciones de atletas, biblioteca de preguntas y configuración del agente. Las mutaciones pasan por `/api/admin/operations`, con validación Zod, autorización server-side, rate limiting y un evento de auditoría minimizado; la migración `20261004170000_restrict_direct_admin_writes.sql` retira las políticas de escritura directa y hace inmutable el log. Los accesos y cierres de sesión de superadmin se registran mediante `/api/admin/audit-session`, autenticado en servidor.

**Evidencia:** planes, usuarios, suscripciones, prompts y biblioteca de preguntas realizan escrituras directas con el cliente de Supabase. `audit_log` tiene una política de inserción, pero no hay triggers o endpoints que registren automáticamente cada cambio administrativo.

**Impacto:** puede haber cambios de precios, saldos, suspensión y prompts sin evidencia completa de antes/después, motivo o actor. La seguridad depende de RLS y la trazabilidad no es suficiente para operación.

**Corrección propuesta:** mover mutaciones administrativas a endpoints/RPCs protegidos, con esquemas Zod, autorización explícita y auditoría append-only. Guardar actor, recurso, antes/después minimizado, motivo, resultado y request/idempotency ID; no guardar secretos ni texto sensible.

### SEC-10 — Consentimiento y límites de procesamiento de IA insuficientemente modelados
MARIANO: Ok, corregir

**Estado:** implementado en `20261004171000_granular_processing_consents.sql`. El atleta puede autorizar de forma separada el coaching con IA, resumen semanal, voz y eventual procesamiento de fotos; coach y cron verifican esas preferencias antes de procesar contenido.

**Evidencia:** la aceptación de términos es general; no existen tablas/campos para consentimiento granular y revocable de IA, procesamiento de fotos o voz. El cron resume automáticamente todas las entradas semanales y las envía a `createCompactSummary`.

**Impacto:** no se puede demostrar que cada finalidad sensible fue autorizada ni detener selectivamente el procesamiento. Fotos, estados emocionales y contenido conversacional pueden revelar datos sensibles aunque el producto no los solicite explícitamente.

**Corrección propuesta:** modelar finalidades y consentimientos versionados; impedir procesamiento de fotos por IA salvo opt-in específico por entrada; permitir opt-out de resumen/IA sin perder el registro personal; registrar proveedor, región, finalidad y retención de cada envío.

### SEC-11 — Falta flujo de derechos del titular y retención aplicable
MARIANO: Ok, corregir

**Estado:** implementado un flujo de solicitudes de exportación, rectificación, eliminación y retiro de consentimientos en `20261004173000_data_subject_requests.sql`. Superadmin puede revisarlas, marcarlas y resolverlas desde Administración; cada decisión queda auditada sin exponer contenido de coaching ni bitácora. Faltan definir plazos de retención y el proceso operativo/legal de resolución antes de producción.

**Evidencia:** no hay endpoint/interfaz/proceso para exportar, rectificar, suprimir, retirar consentimientos ni gestionar retención de transcripciones, fotos, resúmenes, logs y backups.

**Impacto:** el servicio no está preparado para responder solicitudes de derechos. En Argentina, las personas tienen derechos de información, acceso, rectificación, actualización y supresión; la AAIP indica plazos de referencia de 10 días para acceso y 5 días hábiles para rectificación/supresión. [AAIP: derechos](https://www.argentina.gob.ar/aaip/datospersonales/derechos)

**Corrección propuesta:** definir un proceso DSAR autenticado y de soporte, exportación portable, borrado con cola y prueba de ejecución, retiro de consentimiento y una matriz de retención por tipo de dato/backups. Incluir responsable, canal de contacto y registro de solicitudes.

---

## Hallazgos medios

### SEC-12 — Historia de chat suministrada por el cliente
MARIANO: Ok, corregir

**Estado:** implementado. La API recibe solamente el turno nuevo y recupera la historia autorizada desde `session_messages`.

**Evidencia:** `/api/coach` recibe hasta 100 turnos de `history` enviados por navegador y los usa para componer la conversación; solo limita a los últimos 20.

**Impacto:** un cliente modificado puede inyectar mensajes atribuidos al asistente, alterar contexto conversacional o generar resúmenes inconsistentes.

**Corrección propuesta:** recuperar los turnos autorizados desde `session_messages` en servidor, o validar una cadena de mensajes firmada/asociada a sesión. El cliente debe enviar únicamente el turno nuevo y un `sessionId` válido.

### SEC-13 — Errores de escritura y fallas parciales no se comprueban sistemáticamente
MARIANO: Ok, corregir

**Estado:** implementado para los flujos críticos de conversación, cierre de sesión y bloques en la migración `20261004165000_atomic_coaching_writes.sql`. La migración `20261005100000_atomic_admin_operations.sql` incorpora también planes, suscripciones, estado de atletas, biblioteca de preguntas y configuración del agente: cada modificación y su evento de auditoría se confirman o revierten juntos.

**Evidencia:** varias operaciones de componentes y rutas ejecutan `insert`, `update`, `delete` o `Promise.all` sin evaluar todos los errores devueltos.

**Impacto:** puede informarse éxito cuando faltan registros, consumos o auditorías; se afecta integridad y derecho de acceso.

**Corrección propuesta:** encapsular repositorios, comprobar cada resultado, usar transacciones/RPC para operaciones compuestas, establecer reintentos idempotentes y alertar errores de persistencia.

### SEC-14 — Cifrado de credenciales sin administración de claves separada
MARIANO: Ok, corregir

**Estado:** implementado con una clave obligatoria, independiente y versionada (`AGENT_CREDENTIALS_ENCRYPTION_KEY_V1`); se eliminó el fallback a `SUPABASE_SECRET_KEY`. La migración agrega la versión de clave a cada credencial para habilitar rotación futura.

**Evidencia:** `src/lib/agent/credentials.ts` deriva la clave de cifrado de `AGENT_CONFIG_ENCRYPTION_KEY` o, como fallback, de `SUPABASE_SECRET_KEY`.

**Impacto:** la rotación o compromiso de la clave de Supabase afecta el descifrado de credenciales de IA. No hay key version, rotación ni KMS dedicado.

**Corrección propuesta:** requerir una clave de cifrado independiente, versionada y almacenada en un gestor de secretos/KMS; eliminar el fallback, incluir rotación y re-cifrado. Limitar quién puede reemplazar tokens y nunca devolverlos al cliente.

### SEC-15 — Carga de imágenes sin defensa en profundidad
MARIANO: Ok, Corregir

**Estado:** implementada la capa de sanitización server-side para Bitácora y fotos de perfil: se verifica propiedad, tamaño y magic bytes; la imagen se decodifica con límite de 16 megapíxeles, corrige orientación, se reduce a un máximo de 2048 px por lado y se re-encoda a WebP antes de guardar. Los buckets admiten únicamente ese resultado procesado y ya no permiten inserciones directas desde el cliente. Las migraciones `20261004175000_harden_journal_media_uploads.sql` y `20261005113000_harden_avatar_uploads.sql` aplican esas restricciones. Pendiente antes de producción: análisis antimalware externo en cuarentena y un flujo de eliminación server-side si se habilita borrar imágenes.

**Evidencia:** el cliente valida tipo/tamaño de avatar; la bitácora carga archivos con tipo declarado por navegador. Los buckets admiten formatos y límites, pero no hay escaneo antimalware, validación de bytes/decodificación, eliminación EXIF ni pipeline de cuarentena.

**Impacto:** metadatos de ubicación, contenido no permitido o archivos manipulados pueden permanecer en almacenamiento privado y exponerse mediante URL firmada.

**Corrección propuesta:** validar magic bytes y decodificar/re-encodear en backend, retirar EXIF, aplicar cuarentena/antimalware, límites por dimensión y tasa, y usar URLs firmadas de corta duración. Definir moderación y aviso para imágenes de terceros/sensibles.

### SEC-16 — Cron semanal no contempla zona horaria por atleta ni exclusión/consentimiento
MARIANO: ok, corregir

**Estado:** implementado. El cron calcula períodos por la zona horaria del perfil, verifica el consentimiento específico y usa la unicidad existente del período para que los reintentos no creen resúmenes duplicados.

**Evidencia:** `/api/cron/weekly-journal-summary` usa un período UTC global; itera atletas y no consulta timezone ni consentimiento. La ejecución GET podría solaparse si el proveedor reintenta.

**Impacto:** resúmenes en semanas equivocadas, procesamiento no esperado y duplicación bajo carrera.

**Corrección propuesta:** ejecutar por timezone o calcular rango individual; introducir estado de job, lock/idempotencia único, límite por lote, reintento seguro y evaluación de consentimiento para resumen de bitácora.

### SEC-17 — Falta un guardrail de entrada/salida independiente del prompt
MARIANO: Ok, corregir

**Estado:** implementado un guardrail determinístico de entrada y salida para crisis, daño, salud y prescripciones. Estas rutas suspenden el coaching y devuelven una respuesta segura antes o después del proveedor, independientemente del prompt. La suite `npm run test:safety` cubre crisis, salud, prescripciones y un caso ontológico permitido para detectar regresiones.

**Evidencia:** existen instrucciones y lógica de tono, pero no una clasificación estructurada de riesgo previa/posterior a la respuesta, ni reglas técnicas para bloquear prescripción, urgencia, extracción de datos o jailbreak.

**Impacto:** una instrucción de sistema por sí sola no garantiza el límite clínico/de emergencia declarado por el producto.

**Corrección propuesta:** crear clasificadores/schemas de entrada y salida, rutas de respuesta aprobadas, bloqueo de herramientas, registros mínimos de `safety_event`, pruebas de regresión y feature flags de apagado.

### SEC-18 — Contenido sensible aparece en `console.error` y no hay observabilidad minimizada
MARIANO: Ok, Corregir

**Estado:** implementado para la ruta sensible del coach. Los fallos se registran con evento estructurado, ID de correlación, ruta, estado y tipo de error; no se incluyen mensajes, imágenes, credenciales ni el error crudo. La migración `20261005103000_persist_safe_operational_events.sql` persiste esos campos permitidos en un registro operativo de acceso exclusivo para superadmin; la consola queda solo como respaldo.

**Evidencia:** `/api/coach` hace `console.error("Coach request failed", error)`; faltan una política de redacción, correlación, alertas y retención de logs.

**Impacto:** errores de proveedores o librerías pueden incluir payloads, prompts o metadatos en logs de hosting.

**Corrección propuesta:** usar logger estructurado con redacción por defecto, IDs de correlación y listas permitidas de campos. Configurar retención, acceso y alertas; nunca registrar contenido de sesiones, fotos ni credenciales.

### SEC-19 — Autorización de rutas visible solo en cliente
MARIANO: Ok, corregir

**Estado:** implementado. Las sesiones se sincronizan con una cookie `HttpOnly` validada contra Supabase y los layouts/páginas privadas verifican el rol activo en servidor antes de renderizar. Administración, configuración y laboratorio requieren `superadmin`; las rutas deportivas requieren una cuenta activa no administrativa.
**Evidencia:** páginas de administración, coach/lab y atleta son mayormente componentes cliente o sin guard server-side. RLS evita parte de los datos, pero las rutas y superficies se cargan antes de verificar rol.

**Impacto:** aumenta superficie de errores, filtra estructura de UI y puede permitir acciones futuras sin una barrera centralizada.

**Corrección propuesta:** implementar guard server-side/middleware por grupo de rutas, sesión basada en cookies segura y autorización por rol en cada route handler. Mantener RLS como segunda barrera, no reemplazarlo por frontend.

---

## Cumplimiento y privacidad

### COMP-01 — La política declara menos sensibilidad de la que el producto puede recibir
MARIANO: No por ahora, después lo haremos

La política indica que no se solicita información clínica ni sensible, pero conversaciones, emociones, corporalidad, lesiones mencionadas, fotos y perfiles deportivos pueden revelar datos sensibles o de alto riesgo contextual. La Ley 25.326 exige informar finalidad, destinatarios, responsable, carácter obligatorio/facultativo y derechos; además restringe el tratamiento de datos sensibles. [Texto actualizado de la Ley 25.326, arts. 6 y 7](https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion)

**Acción:** realizar inventario de categorías reales, base legal/finalidad por campo y revisar el texto con asesoría legal. Evitar afirmar “100% privado” mientras superadmin/coach tengan las políticas actuales.

### COMP-02 — Faltan responsable identificado, jurisdicción, transferencias y contratos
MARIANO: Si mantener así por ahora

Los textos legales contienen datos “provisorios”; no hay evidencia versionada de responsable legal definitivo, DPA con Supabase/proveedores de IA, países/regiones de proceso ni evaluación de transferencias internacionales.

**Acción:** antes de producción, definir entidad responsable, domicilio/canales, proveedores/subencargados, DPA, transferencias y aviso de privacidad real. Para Argentina, revisar obligaciones del responsable y transferencias con AAIP. [AAIP: obligaciones](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones)

### COMP-03 — GDPR requiere análisis específico si se ofrecen servicios a personas en EEE
MARIANO: no por ahora, dejar así

Si se orienta el servicio a personas en EEE, se deberá definir base jurídica, condiciones para categorías especiales, DPIA si el riesgo lo exige, derechos, transferencia internacional, DPO cuando corresponda y contratos de encargado. El diseño actual de IA conversacional y posibles datos sensibles amerita evaluación jurídica y DPIA, no una auto-declaración de cumplimiento.

**Acción:** limitar geográficamente el lanzamiento hasta recibir dictamen; preparar DPIA y registro de actividades con profesional especializado. Como referencia, la guía oficial de ICO sobre DPIA destaca la evaluación de riesgos, datos de categoría especial y medidas de IA. [ICO DPIA](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/2-data-protection-impact-assessments/)

### COMP-04 — Menores y crisis requieren políticas operativas reales
MARIANO: Si lo se, pero por ahora dejemos así ya que no vamos a produccion todavía, sino a QA.

La UI intenta limitar el MVP a mayores de edad, pero el control es evadible. No existe evidencia de verificación, consentimiento de responsable, recursos de emergencia por país ni protocolo de reporte/atención.

**Acción:** bloquear menores en servidor hasta tener una política aprobada. Para adultos, definir textos de situación urgente, recursos locales por jurisdicción, responsable de incidentes y pruebas de derivación. No publicitar acompañamiento humano permanente.

---

## Verificaciones requeridas fuera del repositorio

| ID | Verificación | Evidencia necesaria |
| --- | --- | --- |
| VER-01 | RLS y políticas reales coinciden con migraciones | Export de políticas/roles/buckets de Supabase y pruebas con cuentas aisladas. |
| VER-02 | Auth de Supabase | Confirmación de correo, password policy, CAPTCHA, rate limits, MFA, expiración/rotación y redirect URLs. |
| VER-03 | Secretos y despliegue | Variables de Vercel separadas por ambiente, sin claves expuestas, logs redactados y permisos mínimos. |
| VER-04 | Buckets | Privados, límites reales, signed URLs, CORS, lifecycle y acceso después de revocación. |
| VER-05 | Backups/recuperación | Política, cifrado, responsables y prueba de restore documentada. |
| VER-06 | Proveedores y datos | DPA, regiones, retención, `store: false` donde aplique, subprocesadores y transferencias. |
| VER-07 | Legal/comercial | Jurisdicciones, entidad responsable, bases legales, términos, retención, pagos/impuestos y soporte. |

## Plan de remediación recomendado

### Bloqueador de piloto con datos reales

1. Retirar compra simulada y crear ledger/RPC transaccional de créditos.
2. Corregir RLS de sesiones, bitácora, fotos y resúmenes para impedir acceso de superadmin y coach sin share explícito.
3. Bloquear cambios del atleta a `account_status`.
4. Implementar aceptación legal validada en servidor y reaceptación por versión.
5. Validar edad en servidor y dejar menores deshabilitados.

### Antes de beta externa

1. Rate limits, cabeceras de seguridad, guard de rutas y protección de abuso.
2. Auditoría administrativa append-only y mutaciones mediante API/RPC.
3. Consentimiento granular, DSAR/exportación/borrado y matriz de retención.
4. Guardrails de IA estructurados y suite de pruebas de seguridad.
5. Cifrado de credenciales con clave independiente y rotación.
6. Pipeline seguro de imágenes y cron idempotente por zona horaria.

### Antes de producción pública

1. Cerrar todas las verificaciones VER-01 a VER-07.
2. Pruebas automatizadas de RLS, autorización, concurrencia de créditos y regresión de guardrails.
3. Pentest externo proporcionado por profesional autorizado.
4. Revisión legal de Argentina y de cualquier jurisdicción de lanzamiento; DPIA si corresponde.
5. Simulacro de incidente, restore y apagado de proveedor/modelo.

## Próximo paso técnico

Crear una migración de endurecimiento que resuelva SEC-02, SEC-03, SEC-04 y SEC-05, acompañada por pruebas de RLS con al menos dos atletas, un coach asignado y un superadmin. Después se reemplaza la compra simulada por un ledger transaccional de desarrollo, aislado por ambiente.
