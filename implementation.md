# Plan de implementación — Aksis

## Propósito y forma de trabajo

Este documento organiza el trabajo posterior al MVP actual en entregables verificables. El orden importa: no se publica una PWA, app nativa ni landing comercial antes de cerrar los controles mínimos de seguridad, privacidad y operación.

El alcance se divide en cinco frentes:

1. Auditoría de seguridad y preparación de cumplimiento.
2. PWA instalable para deportistas.
3. Aplicación Android basada en la experiencia móvil.
4. Landing pública de producto.
5. Video breve de presentación.

`design.md` y `agent-methodology.md` son documentación confidencial local y no se incorporan a repositorios, piezas públicas ni prompts de herramientas externas.

## Orden propuesto

| Fase | Entregable | Dependencia | Estado |
| --- | --- | --- | --- |
| 0 | Inventario y auditoría técnica | Acceso de desarrollo y Supabase | Pendiente |
| 1 | Plan de remediación y paquete de cumplimiento | Hallazgos de fase 0 | Pendiente |
| 2 | PWA del deportista | Controles críticos cerrados | Pendiente |
| 3 | Android | PWA estable y pruebas en móvil | Pendiente |
| 4 | Landing | Mensaje comercial, capturas aprobadas | Pendiente |
| 5 | Video | Landing, guion y recursos visuales aprobados | Pendiente |

No se interpreta este plan como una certificación legal ni como declaración de conformidad total con GDPR. La aprobación jurídica, las bases legales, los contratos de tratamiento y las políticas para menores requieren asesoría legal especializada antes de producción.

---

## Fase 0 — Auditoría de seguridad y preparación de cumplimiento

### Objetivo

Identificar riesgos técnicos y de privacidad, verificar los controles definidos en `design.md` y clasificar cada hallazgo por severidad, evidencia, responsable y fecha de corrección.

### 0.1 Inventario y superficie de ataque

- [ ] Documentar rutas públicas, rutas autenticadas, APIs, cron jobs y callbacks.
- [ ] Inventariar tablas, buckets, políticas RLS, funciones, roles y credenciales de Supabase.
- [ ] Identificar proveedores y flujos de datos: Supabase, IA, analítica, correo, hosting, pagos futuros y almacenamiento de fotos.
- [ ] Clasificar los datos tratados: cuenta, perfil deportivo, objetivos, bitácora, fotos, conversaciones, resúmenes, telemetría y facturación.
- [ ] Confirmar que secretos, claves de servicio y tokens no estén en Git, bundles del cliente, logs ni documentación pública.

**Evidencia:** diagrama de flujo de datos, inventario de activos y lista de secretos/propietarios sin valores sensibles.

### 0.2 Revisión de autenticación, autorización y privacidad

- [ ] Probar registro, confirmación de correo, reinicio de contraseña, expiración y cierre de sesión.
- [ ] Verificar que cada rol solo pueda acceder a sus recursos: atleta, coach, superadmin y backend.
- [ ] Ejecutar pruebas negativas de RLS entre dos atletas y entre roles distintos.
- [ ] Revisar que superadmin no pueda acceder a transcripciones, resúmenes internos, bitácora o notas privadas.
- [ ] Confirmar que los adjuntos de bitácora estén en buckets privados y solo se entreguen con URLs firmadas de corta duración.
- [ ] Definir MFA obligatorio para coach y superadmin antes de producción.

**Criterio de aceptación:** no existen lecturas, escrituras ni borrados entre usuarios no autorizados; los controles se prueban automáticamente y quedan documentados.

### 0.3 Revisión de aplicación y dependencias

- [ ] Ejecutar análisis de dependencias y corregir vulnerabilidades de severidad alta/crítica justificadamente.
- [ ] Revisar validación de entrada, límites de tamaño, sanitización, rate limiting, CORS, CSRF donde aplique y cabeceras de seguridad.
- [ ] Revisar endpoints de IA, administración, cron y carga de archivos para evitar escalamiento de privilegios, abuso y exposición de secretos.
- [ ] Validar manejo de errores: mensajes seguros al usuario, sin datos internos, claves ni trazas sensibles.
- [ ] Configurar controles de seguridad HTTP: CSP, HSTS en producción, `X-Content-Type-Options`, `Referrer-Policy` y `frame-ancestors`/protección de clickjacking.
- [ ] Revisar auditoría: debe registrar metadatos mínimos, no el texto sensible de sesiones ni bitácora.

**Criterio de aceptación:** cero hallazgos críticos abiertos; los hallazgos altos tienen corrección verificada o mitigación aprobada antes del piloto.

### 0.4 IA, seguridad conversacional y operación

- [ ] Confirmar que todas las claves de proveedor se usan solo en servidor y que los proveedores no reciben datos no autorizados.
- [ ] Probar prompt injection, extracción de contexto, acceso a datos de terceros, contenido sensible y fallas de proveedor.
- [ ] Validar las rutas estructuradas: coaching normal, límite de alcance, situación urgente e incidente de plataforma.
- [ ] Confirmar que el contexto se compone en backend y que mensajes de usuarios no se tratan como instrucciones del sistema.
- [ ] Definir apagado rápido por feature flag para proveedor, modelo y prompt.
- [ ] Revisar límites de tokens, duración, reintentos, cobro de bloques y reversos frente a errores.
- [ ] Establecer backup, restauración de prueba, monitoreo, alertas y proceso de incidentes.

**Criterio de aceptación:** la suite de escenarios críticos no presenta fuga de datos, prescripción clínica ni bypass de roles; existe un procedimiento probado de suspensión y recuperación.

### 0.5 Paquete de cumplimiento y decisiones legales

- [ ] Construir registro de actividades de tratamiento: dato, finalidad, base legal, destinatario, retención y responsable.
- [ ] Redactar y versionar términos, privacidad, consentimiento de IA, consentimiento de fotos y consentimiento de voz futuro.
- [ ] Diseñar flujos de acceso, rectificación, exportación, borrado, retiro de consentimiento y trazabilidad de solicitudes.
- [ ] Definir política de retención por tipo de dato y proceso para copias de respaldo.
- [ ] Revisar acuerdos de tratamiento, transferencias internacionales y ubicación de datos con cada proveedor.
- [ ] Definir edad mínima, verificación y política para menores antes de habilitar ese segmento.
- [ ] Someter el paquete a revisión de asesoría legal de las jurisdicciones de lanzamiento.

**Salida de fase:** informe de auditoría priorizado, matriz de riesgos, plan de remediación, evidencias técnicas y lista explícita de decisiones legales pendientes.

---

## Fase 2 — PWA del deportista

### Objetivo

Ofrecer una experiencia instalable, segura y mobile-first exclusivamente para deportistas autenticados. La PWA no debe abrir ni exponer las superficies de coach o superadministración como parte de su navegación.

### Tareas

- [ ] Definir el manifiesto: nombre Aksis, nombre corto, colores oficiales, orientación, categorías e iconos en todos los tamaños requeridos.
- [ ] Generar iconos adaptables/maskable, splash screens y metadatos sociales sin incluir datos personales.
- [ ] Implementar service worker con una estrategia conservadora: cachear shell y recursos públicos; no guardar conversaciones, fotos, tokens, respuestas de IA ni datos sensibles offline.
- [ ] Agregar experiencia de instalación solo para rutas del deportista: invitación discreta, instalación manual en iOS y estado de app ya instalada.
- [ ] Revisar responsive, safe areas, teclado móvil, navegación inferior, contraste, foco y lectores de pantalla.
- [ ] Agregar tratamiento de conexión: indicar estado offline, evitar envíos duplicados y explicar qué acciones requieren conexión.
- [ ] Probar registro, login, chat, bitácora, calendario, perfil, cierre de sesión y expiración de sesión instalados como PWA.
- [ ] Configurar analítica agregada y consentida, sin textos de coaching ni bitácora.

### Criterios de aceptación

- Instalable desde Android Chrome y navegadores compatibles; instrucciones claras para iOS Safari.
- La app abre con identidad y navegación de atleta, sin acceso directo a funciones administrativas.
- No persiste contenido sensible en Cache Storage, IndexedDB, service worker ni notificaciones.
- Lighthouse/validación PWA sin fallos críticos y pruebas manuales en al menos dos Android y un iPhone.

---

## Fase 3 — Aplicación Android

### Decisión técnica a validar

Se evaluarán dos rutas antes de construir:

1. **Trusted Web Activity (TWA):** distribución Android que abre la PWA verificada mediante Digital Asset Links. Es la opción inicial preferida si la PWA satisface cámara, micrófono, notificaciones y experiencia requerida.
2. **Capacitor:** contenedor nativo con plugins controlados, si se necesitan permisos, integración de cámara/micrófono, notificaciones o almacenamiento que una TWA no pueda resolver de forma adecuada.

No se iniciará una app nativa independiente ni se duplicará la lógica de negocio: autenticación, sesiones, permisos y datos seguirán viviendo en la misma plataforma backend.

### Tareas comunes

- [ ] Definir `applicationId`, firma, cuenta de Google Play, propiedad de activos y ambientes interno/cerrado/producción.
- [ ] Configurar nombre, iconos adaptables, splash screen, versiones y enlace de privacidad.
- [ ] Implementar permisos mínimos y justificación visible para cámara, micrófono y notificaciones.
- [ ] Validar autenticación, deep links, recuperación de sesión, carga de fotos, dictado, TTS y enlaces externos.
- [ ] Configurar reportes de fallos y métricas técnicas sin almacenar contenido sensible.
- [ ] Preparar ficha de Google Play: clasificación de contenido, Data Safety, política de privacidad, capturas y contacto de soporte.
- [ ] Ejecutar pruebas en dispositivos físicos y canal de prueba cerrada antes de publicación.

### Criterios de aceptación

- APK/AAB firmado y distribuido solo en prueba interna/cerrada al inicio.
- Sin permisos no justificados; la app funciona si el usuario rechaza los opcionales.
- Cumple los requisitos vigentes de Google Play aplicables al momento de publicar.
- Los datos tratados en la ficha Data Safety coinciden con la política pública y la implementación real.

---

## Fase 4 — Landing pública

### Objetivo

Explicar con claridad qué es Aksis, para quién es, cómo se usa y cuáles son sus límites, transformando interés en una acción medible sin prometer resultados deportivos, atención clínica ni vigilancia humana.

### Arquitectura de contenido

- [ ] Hero: propuesta de valor breve, CTA principal y CTA secundario (solicitar acceso/lista de espera o ingresar).
- [ ] Explicación del proceso: perfil, conversación, bitácora, objetivos y continuidad.
- [ ] Sección de funcionalidades: coach IA, bitácora privada, agenda/hitos, centrado y resumen de proceso.
- [ ] Cómo funcionan los bloques de 15 minutos y las suscripciones, con precios solo cuando estén definidos y aprobados.
- [ ] Privacidad y límites: no es terapia, atención médica ni un servicio de emergencia; contenido privado y controles del usuario.
- [ ] FAQ: datos, fotos, IA, coach humano opcional, cancelación, soporte y requisitos de dispositivo.
- [ ] Prueba social solo con testimonios, nombres, imágenes y permisos documentados.
- [ ] Footer con privacidad, términos, contacto, soporte, accesibilidad y redes cuando existan.

### Diseño y material visual

- [ ] Reutilizar la identidad serena de Aksis: marfil, verde petróleo, salvia, verde agua, durazno y coral suave.
- [ ] Crear capturas sintéticas/demostrativas: nunca usar cuentas reales, bitácoras reales ni conversaciones privadas.
- [ ] Optimizar imágenes, formatos responsivos, texto alternativo y carga diferida.
- [ ] Implementar SEO técnico, Open Graph, sitemap, robots y medición consentida.

### Criterios de aceptación

- La landing comunica el producto en menos de un minuto y tiene una CTA funcional.
- No contiene afirmaciones clínicas, deportivas o de privacidad que no puedan demostrarse.
- Cumple accesibilidad básica, responsive y rendimiento móvil acordado.
- Legal, producto y marca aprueban el texto antes de publicación.

---

## Fase 5 — Video breve de presentación

### Objetivo

Crear una pieza breve, cálida y clara para landing y redes, centrada en el proceso del deportista y no en promesas de rendimiento.

### Especificación inicial

- Duración: 30–45 segundos.
- Formatos: horizontal 16:9, vertical 9:16 y recorte cuadrado 1:1.
- Idioma: español rioplatense.
- Audio: música con licencia verificable, voz opcional y subtítulos siempre incluidos.
- Recursos: UI demo con datos ficticios, ilustraciones o grabaciones autorizadas; no sesiones reales ni información personal.

### Guion de referencia

1. **0–5 s:** “Tu proceso también necesita un espacio.”
2. **5–13 s:** atleta registra lo que vive, sus objetivos y un hito relevante.
3. **13–25 s:** conversación con Aksis que escucha, pregunta y da continuidad al proceso.
4. **25–35 s:** bitácora, agenda y prácticas de centrado como recursos personales.
5. **35–45 s:** “Aksis. Un espacio para acompañar tu camino deportivo.” + CTA aprobado.

### Tareas

- [ ] Aprobar mensaje, CTA, claims permitidos y disclaimer.
- [ ] Preparar storyboard y capturas de interfaz ficticias.
- [ ] Definir voz, música, licencias, subtítulos y locución.
- [ ] Editar un primer corte y validar tono, accesibilidad y legibilidad móvil.
- [ ] Exportar variantes y comprimidos para landing/redes.
- [ ] Archivar fuentes, licencias y versiones aprobadas.

### Criterios de aceptación

- El video explica el propósito sin prometer diagnósticos, rendimiento ni atención de emergencia.
- Subtítulos sincronizados, contraste adecuado y CTA visible.
- Todas las imágenes, música, voz y marcas cuentan con licencia o autorización documentada.

---

## Próximo paso inmediato

Comenzar por la **Fase 0.1**: inventario de rutas, datos, roles, RLS, buckets y secretos expuestos. El resultado será la base de la auditoría, del cumplimiento y de las decisiones de PWA/Android/publicación.
