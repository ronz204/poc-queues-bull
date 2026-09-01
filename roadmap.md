# Cerve — Roadmap

Tracker personal de progreso. No forma parte de la knowledge base del harness (no lo toca `archivist`/`surveyor`/`sentinel`) — es solo para tener panorama de qué falta y qué ya está.

---

## Fase 0 — Scaffolding

- [x] Harness delta instalado (CLAUDE.md + docs + rules + skills)
- [x] Split de infra local por servicio (`docker/data/`, `docker/redis/`) creado
- [ ] `docker/data/compose.yml` con Postgres real
- [ ] `docker/redis/compose.yml` con Redis real
- [ ] Root `compose.yml` orquestando ambos
- [ ] Estructura de carpetas hexagonal bajo `services/<nombre>/`
- [ ] "Hello world": un `ReportDefinition` hardcodeado recalculándose cada minuto, sin lock ni cache

## Fase 1 — Dominio y persistencia

- [ ] Modelar `ReportDefinition` (aggregate root) con invariantes: cron válido, versión solo incrementa, no dos definiciones activas con el mismo nombre
- [ ] Modelar `ReportExecution`
- [ ] Setup de Drizzle + migraciones
- [ ] CRUD real vía API (Elysia) — sin locks, sin cache todavía

## Fase 2 — Scheduling real con BullMQ

- [ ] Repeatable job por `ReportDefinition` con `jobId` determinístico
- [ ] Reprogramación del job al editar el cron
- [ ] Verificar compatibilidad ioredis/BullMQ sobre Bun (riesgo señalado desde el enunciado)
- [ ] Probar con múltiples workers (`docker compose up --scale worker=3`)

## Fase 3 — Locks distribuidos + fencing tokens

- [ ] Lock distribuido en Redis (`lock:report:{reportId}`) con TTL
- [ ] Fencing token monotónico (`INCR` sobre `lock:report:{reportId}:token`)
- [ ] Rechazo de escritura de snapshot si el token entrante es menor al ya registrado
- [ ] Test/script que demuestre el escenario de worker zombie

## Fase 4 — Cache-aside versionado

- [ ] `ReportSnapshot` en Redis con key `report:snapshot:{reportId}:v{definitionVersion}`
- [ ] `GET /reports/:id/result` sirviendo desde cache
- [ ] Fallback a cálculo síncrono si no hay snapshot
- [ ] Medir que la lectura cacheada esté <10ms

## Fase 5 — Invalidación por Domain Events

- [ ] Event bus interno conectado a la escritura de agregados
- [ ] `ReportDefinitionUpdated` → nueva key de versión (invalidación pasiva, sin borrar la vieja)
- [ ] `ReportExecutionCompleted` → sobreescritura activa del snapshot actual (gateada por fencing token)
- [ ] `ReportExecutionFailed` emitido y manejado

## Fase 6 — Idempotencia + endurecimiento

- [ ] `executionId` determinístico por `(reportId, scheduledFor)`
- [ ] Verificar que reintentos/duplicados de BullMQ no generen `ReportExecution` duplicadas
- [ ] Generador de carga sintética de `SaleTransaction`s
- [ ] Logs/observabilidad básica: qué worker ejecutó qué, con qué token

## Fase 7 — Stretch (opcional, no bloquea el done)

- [ ] Dependencias entre reportes con invalidación en cascada
- [ ] Endpoint `/metrics` (locks adquiridos, cache hit/miss, duración de ejecuciones)
- [ ] Vista mínima de estado de reportes

---

## Criterios de "done" (fases 0–6)

- [ ] Puedo crear un reporte, verlo recalcularse solo según su cron, y consultar su resultado desde cache en <10ms
- [ ] 3 workers en paralelo, confirmado por logs que un mismo reporte nunca se calcula dos veces simultáneamente sin control
- [ ] Demo reproducible: worker zombie con lock expirado no puede sobreescribir un resultado más nuevo
- [ ] Editar una definición deja el cache viejo huérfano/expirando, sin intervención manual
- [ ] Reintentos/duplicados de BullMQ no generan `ReportExecution` duplicadas
