/**
 * RUTAS · los endpoints de la API                                         (PARTES 2 y 4 de la guía)
 *
 * Aquí está el DISEÑO de la API: qué recursos hay, qué método y qué URI usa cada operación y qué estado HTTP
 * devuelve cada resultado. En términos de MVC, estos manejadores son el CONTROLADOR del servidor:
 *   · traducen una solicitud HTTP en una orden para el Modelo;
 *   · traducen el resultado (o el error) del Modelo en una respuesta HTTP.
 * No contienen reglas de negocio: esas son del Modelo (servidor/modelo.js). Si te descubres escribiendo
 * "if (peso > 100)" aquí, detente: la pregunta ya la sabe contestar el Modelo.
 *
 * Tu trabajo: reemplazar cada "TODO" hasta que `npm run test:api` (Parte 2) y `npm run test:versionado`
 * (Parte 4) queden en verde. Lee antes servidor/nucleo.mjs (arriba del todo explica qué recibe y qué
 * devuelve un manejador) y tu diseño de la Parte 1 (ENTREGA.md, sección 1).
 *
 * Orden de trabajo sugerido:  2A leer → 2B crear (y la tabla de estados) → 2C modificar y borrar → 4A, 4B y 4C.
 */

import { ErrorDeReglas } from './modelo.js';
import { ErrorHttp, leerEntero, paraVersiones } from './nucleo.mjs';
import { representarEvaluacion, representarResumen, tipoDeProblema } from './representaciones.mjs';

// ---------------------------------------------------------------- 2B · De regla del Modelo a estado HTTP
// El Modelo no sabe qué es un 404. Cada error suyo trae un `codigo` (mira CODIGOS en servidor/modelo.js);
// esta tabla decide qué estado HTTP le corresponde a cada uno.
const ESTADO_POR_CODIGO = {
  // TODO 2B: asigna un estado a cada código. Piensa en tres grupos:
  //   · el recurso no existe ............................................... ¿404?
  //   · el CONTENIDO enviado incumple una regla (un valor inválido) ........ ¿400, 409 o 422?
  //   · el contenido choca con el ESTADO actual (duplicado, tope de pesos) . ¿400, 409 o 422?
  // Escribe también tu decisión, y su porqué, en ENTREGA.md (sección 2).
  //   NO_EXISTE: ...,
};

/** El núcleo la llama con cada error que no es un ErrorHttp. Lo que no es del Modelo se devuelve igual (→ 500). */
export function traducirError(error) {
  // TODO 2B: si NO es un ErrorDeReglas, devuélvelo tal cual (el núcleo lo convertirá en un 500 sin filtrar detalles).
  //          Si lo es, devuelve new ErrorHttp(estado, error.message, tipoDeProblema(error.codigo)),
  //          donde `estado` sale de tu tabla ESTADO_POR_CODIGO (y si el código no está, usa 422).
  return error;
}

// ---------------------------------------------------------------- Fechas del ciclo de vida de la v1 (Parte 4B)
const DEPRECIADA_DESDE = new Date('2026-10-01T00:00:00Z'); // RFC 9745: cabecera Deprecation
const SE_RETIRA_EN = new Date('2027-12-31T23:59:59Z'); // RFC 8594: cabecera Sunset

// Valores permitidos de ?orden= y ?estado= en la v2 (Parte 4A)
const ORDENES = ['id', 'nombre', '-nombre', 'peso', '-peso'];
const ESTADOS = ['pendiente', 'calificada'];

/** Ordena una lista de evaluaciones por 'id', 'nombre' o 'peso'; un guion delante invierte el orden. (Ya escrito.) */
function ordenar(lista, orden) {
  const campo = orden.replace('-', '');
  const sentido = orden.startsWith('-') ? -1 : 1;
  return [...lista].sort((a, b) => sentido * (typeof a[campo] === 'string' ? a[campo].localeCompare(b[campo], 'es') : a[campo] - b[campo]));
}

export function crearRutas(modelo) {
  /** Ya escrito: el id de la URI. Solo dígitos y sin ceros a la izquierda; cualquier otra cosa no identifica a nadie (→ NaN → 404). */
  const idDe = (solicitud) => (/^[1-9]\d*$/.test(solicitud.params.id) ? Number(solicitud.params.id) : NaN);

  // -------------------------------------------------------------- 2A · Leer
  const listarV1 = () => {
    // TODO 2A: responde 200 con un ARREGLO de representaciones (usa modelo.evaluaciones y representarEvaluacion).
    //          Parte 4B: aquí volverás para agregar los avisos de que la v1 está obsoleta.
    throw new Error('TODO 2A · listarV1()');
  };

  const obtener = (solicitud) => {
    // TODO 2A: responde 200 con la representación de UNA evaluación. Usa modelo.obtener(idDe(solicitud)):
    //          si no existe, el Modelo lanza un error con código NO_EXISTE y tu tabla de estados (2B) lo vuelve 404.
    throw new Error('TODO 2A · obtener()');
  };

  // EJEMPLO RESUELTO (así se ve un manejador completo): el resumen es un recurso CALCULADO, de solo lectura.
  const resumen = () => ({ status: 200, cuerpo: representarResumen(modelo.resumen()) });

  // -------------------------------------------------------------- 2B · Crear   y   2C · Modificar y borrar
  const crear = ({ cuerpo, base }) => {
    // TODO 2B: crea la evaluación con modelo.agregar({ nombre, peso, nota }) usando SOLO esos tres campos
    //          (el id lo decide el servidor, aunque el cliente mande uno).
    //          Responde 201 (no 200), con la cabecera Location apuntando a la evaluación nueva
    //          (`${base}/evaluaciones/${id}`) y con su representación en el cuerpo.
    throw new Error('TODO 2B · crear()');
  };

  const calificar = (solicitud) => {
    // TODO 2C: modelo.calificar(idDe(solicitud), solicitud.cuerpo.nota) y responde 200 con la evaluación actualizada.
    //          La nota puede ser un número entre 0 y 5, o null para quitarla.
    throw new Error('TODO 2C · calificar()');
  };

  const eliminar = (solicitud) => {
    // TODO 2C: modelo.eliminar(...) y responde 204 (sin cuerpo): hecho, y no hay nada que devolver.
    throw new Error('TODO 2C · eliminar()');
  };

  // -------------------------------------------------------------- 4A · v2: lista paginada, filtrada y ordenada
  const listarV2 = ({ query, ruta }) => {
    // TODO 4A: pasos sugeridos.
    //   1. pagina = leerEntero(query, 'pagina', { porDefecto: 1, min: 1 })
    //      porPagina = leerEntero(query, 'porPagina', { porDefecto: 10, min: 1, max: 50 })   (lanzan 400 si no son válidos)
    //   2. estado = query.get('estado'): si no es null y no está en ESTADOS → throw new ErrorHttp(400, '...')
    //      orden = query.get('orden') ?? 'id': si no está en ORDENES → 400. Los mensajes deben nombrar el parámetro entre comillas.
    //   3. lista = modelo.evaluaciones; filtra por estado (pendiente = sin nota, calificada = con nota); ordena con ordenar().
    //   4. total, totalPaginas = Math.max(1, Math.ceil(total / porPagina)); recorta con slice y representa cada una.
    //   5. Cabecera Link (RFC 8288) con rel="prev" y rel="next" cuando existan esas páginas, conservando estado, orden y porPagina:
    //        </v2/evaluaciones?pagina=3&porPagina=3>; rel="next"        (ayuda: new URLSearchParams({...}))
    //   6. Responde 200 con { datos: [...], paginacion: { pagina, porPagina, total, totalPaginas } }.
    throw new Error('TODO 4A · listarV2()');
  };

  // -------------------------------------------------------------- La tabla de rutas
  // Cada entrada es { metodo, ruta, manejador }. La ruta usa plantillas: '/v1/evaluaciones/{id}'.
  // Mira primero tu diseño de la Parte 1: una URI nombra un recurso (sustantivo), el método HTTP es la acción.
  return [
    // TODO 2A: registra aquí las lecturas: GET de la lista, GET de una evaluación y GET del resumen.
    // TODO 2B: registra aquí la creación.
    // TODO 2C: registra aquí la modificación de la nota y el borrado.
    //
    // TODO 4C: cuando termines la v2 (4A) y los avisos (4B), agrupa lo que no cambió con
    //          ...paraVersiones(['v1', 'v2'], [ ...las entradas sin el prefijo /v1... ]) y registra aparte la lista de cada versión:
    //          GET /v1/evaluaciones → listarV1 y GET /v2/evaluaciones → listarV2.
  ];
}
