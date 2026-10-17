# Entrega · Laboratorio API · Notas del semestre

**Equipo:** ______________________  
**Integrantes:** ______________________  
**Repositorio:** ______________________

> Completa este archivo a medida que avanzas (cada sección dice en qué parte de la guía se llena).
> Escribe con tus palabras: las respuestas copiadas de la guía o de otro equipo no cuentan.

---

## 1. El contrato que diseñé (Parte 1 · ANTES de programar)

La app de Notas necesita estas seis operaciones. Para cada una decide **el método HTTP, la URI y los estados** que
devolverá (el éxito y los errores posibles). Reglas del juego: la URI nombra un **recurso** (sustantivo, plural,
minúsculas, con versión `/v1`) y el **método** es la acción. No pongas verbos en la URI.

| Operación | Método | URI | Éxito (estado + qué devuelve) | Errores posibles (estado → cuándo) |
|---|---|---|---|---|
| Listar todas las evaluaciones | | | | |
| Ver una evaluación | | | | |
| Crear una evaluación | | | | |
| Poner o quitar la nota de una evaluación | | | | |
| Eliminar una evaluación | | | | |
| Ver el resumen (acumulado, nota necesaria, estado) | | | | |

### 1b. Critica estas direcciones

Alguien diseñó estas direcciones. Escribe qué está mal en cada una y cómo la reescribirías.

| Diseño original | Qué está mal | Cómo la reescribo |
|---|---|---|
| `POST /crearEvaluacion` | | |
| `GET /getAllEvaluaciones?format=json` | | |
| `GET /eliminar?id=3` | | |
| `POST /evaluacion/3/calificar` (responde `200 { "ok": false, "error": "..." }` si la nota es inválida) | | |
| `GET /v1/Evaluaciones/` | | |
| `PUT /evaluaciones` con **toda** la lista de evaluaciones en el cuerpo, cada vez que algo cambia | | |

## 2. Mis decisiones de estado (Parte 2)

Después de completar `ESTADO_POR_CODIGO`, responde con tus palabras.

| Situación | Estado que elegí | ¿Por qué ese y no otro? |
|---|---|---|
| El peso es 0, o la nota es 7 | | |
| El nombre ya existe, o los pesos pasarían de 100 | | |
| La evaluación no existe | | |
| El cuerpo no es JSON, o está roto | | |
| El cuerpo es JSON pero se envió como `text/plain` | | |
| Se pide `PUT /v1/evaluaciones` (no existe ese método ahí) | | |

1. ¿Por qué calificar usa `PATCH` y no `PUT`? ¿Y por qué crear usa `POST` y no `PUT`?
2. `DELETE` repetido: la primera vez responde 204 y la segunda 404. ¿Eso rompe la idempotencia? Explica qué significa en realidad «idempotente».
3. ¿Por qué el `type` de un problema es un identificador estable y no basta con el `detail`?

## 3. MVC a los dos lados del cable (Parte 3)

Dibuja (a mano y pega una foto, o con texto/Mermaid) el recorrido completo desde que el usuario presiona **Agregar**
hasta que ve la fila nueva. Marca en cada paso **el archivo y el método** que actúa, y dónde cruza el cable.

```text
(tu diagrama aquí)
```

1. ¿Qué archivos del navegador **no** tuviste que tocar al conectar la API? ¿Qué te dice eso de la arquitectura?
2. ¿Dónde viven ahora las reglas de negocio? ¿Por qué el navegador no debe validar «por su cuenta» el peso, si ya lo sabe?
3. Cuando el servidor se cae, ¿qué ve el usuario? ¿Qué pieza del MVC lo decide?

## 4. Versionado (Parte 4)

Clasifica cada cambio posible a la API como **compatible** (los clientes existentes siguen funcionando) o **rompe** a
los clientes existentes, y justifica en una frase.

| Cambio | ¿Compatible o rompe? | ¿Por qué? |
|---|---|---|
| Agregar el campo `aporte` a cada evaluación | | |
| Cambiar `peso` por `porcentaje` en cada evaluación | | |
| Devolver `nota` como texto (`"4.2"`) en vez de número | | |
| Agregar el endpoint `GET /v1/evaluaciones/{id}/historial` | | |
| Pasar la lista de un arreglo a un objeto `{ datos, paginacion }` | | |
| Exigir un campo nuevo, `profesor`, al crear una evaluación | | |
| Cambiar el `porPagina` por defecto de 10 a 20 | | |
| Aceptar también `peso` con decimales de coma (`"12,5"`) | | |

**Plan de retiro de la v1.** Fechas que usaron en `Deprecation` y `Sunset`: ______________________.
¿Cómo se enteraría un cliente real que nunca lee tu documentación? ¿Qué pondrías en tu plan para ayudarlos a migrar?

## 5. Evidencias (Partes 2 a 5)

**Salida de `npm test`** (pega el final, donde dice cuántas pruebas pasan):

```text

```

**Captura de pantalla** de la pestaña *Network* del navegador mostrando las cabeceras `Deprecation` y `Sunset` de `GET /v1/evaluaciones`: _(pega la imagen o su enlace)_

**Fragmento de `/openapi.json`** con la operación `GET /v2/evaluaciones`:

```json

```

## 6. Reflexión

1. En la clase pasada el Modelo guardaba en `localStorage`. ¿Qué problemas concretos resolvió llevarlo a un servidor? ¿Cuáles problemas **nuevos** aparecieron (piensa en tiempo, fallos, dos aparatos)?
2. ¿Qué parte de lo que hicieron hoy es **REST de verdad** y qué parte es solo «JSON sobre HTTP»? (Pista: recursos, representaciones, métodos con significado, estados, sin estado.)
3. Elijan un principio de diseño de endpoints que les costó respetar. ¿Cuál era la tentación y qué prueba o regla los detuvo?
4. La documentación OpenAPI y el código pueden contradecirse. ¿Cómo las pruebas de la Parte 5 lo evitan? ¿Qué otra forma conocen de mantenerlas de acuerdo?
5. Si esta API la usaran 50 aplicaciones de otras personas, ¿qué cambiaría en su manera de evolucionarla?
