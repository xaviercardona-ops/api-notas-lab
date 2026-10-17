// PRUEBAS DE DOCUMENTACIÓN (PARTE 5)
//
// Una documentación que no coincide con el código es peor que no tener ninguna. Estas pruebas comparan
// el documento OpenAPI (GET /openapi.json) con la API REAL en las dos direcciones:
//   · cada ruta del código debe estar documentada;
//   · cada operación documentada debe existir en el código;
//   · cada estado HTTP que la API devuelve debe estar declarado en la documentación.
//
//   npm run test:docs

import { AlmacenMemoria } from '../servidor/almacen.mjs';
import { NotasModelo } from '../servidor/modelo.js';
import { crearRutas } from '../servidor/rutas.mjs';
import { conServidor, SEMILLA } from './ayudas.mjs';
import { FalloDePrueba, grupo, igual, prueba, verdadero } from './mini.js';

const SUITE = 'documentacion';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE });

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

const pedirDocumento = (llamar) => llamar('GET', '/openapi.json');
const documentoVivo = () => conServidor(async (llamar) => (await pedirDocumento(llamar)).json);

/** Todas las operaciones del documento: [{ metodo, ruta, operacion }]. */
function operaciones(doc) {
  const lista = [];
  for (const [ruta, item] of Object.entries(doc.paths ?? {})) {
    for (const metodo of METODOS) if (item[metodo]) lista.push({ metodo, ruta, operacion: item[metodo] });
  }
  return lista;
}

function* referencias(nodo) {
  if (Array.isArray(nodo)) for (const hijo of nodo) yield* referencias(hijo);
  else if (nodo && typeof nodo === 'object') {
    if (typeof nodo.$ref === 'string') yield nodo.$ref;
    for (const hijo of Object.values(nodo)) yield* referencias(hijo);
  }
}

const resolver = (doc, ref) =>
  ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((nodo, parte) => nodo?.[parte], doc);

// ---------------------------------------------------------------------------------------------
g('5A · El documento', () => {
  prueba('GET /openapi.json responde 200 con un documento OpenAPI 3.1', () =>
    conServidor(async (llamar) => {
      const r = await pedirDocumento(llamar);
      igual(r.status, 200, 'la documentación también es un recurso: GET /openapi.json');
      verdadero(r.tipo.startsWith('application/json'), `Content-Type debe ser application/json (llegó "${r.tipo}")`);
      verdadero(String(r.json?.openapi).startsWith('3.1'), `el campo "openapi" debe ser 3.1.x (llegó "${r.json?.openapi}")`);
    }));

  prueba('describe la API: info.title, info.version, paths y components.schemas', async () => {
    const doc = await documentoVivo();
    verdadero(doc.info?.title, 'falta info.title');
    verdadero(doc.info?.version, 'falta info.version');
    verdadero(Object.keys(doc.paths ?? {}).length > 0, 'falta paths');
    for (const esquema of ['Evaluacion', 'NuevaEvaluacion', 'Calificacion', 'Resumen', 'Problema']) {
      verdadero(doc.components?.schemas?.[esquema], `falta el esquema components.schemas.${esquema}`);
    }
  });

  prueba('todas las referencias ($ref) apuntan a algo que existe', async () => {
    const doc = await documentoVivo();
    for (const ref of referencias(doc)) verdadero(resolver(doc, ref) !== undefined, `la referencia ${ref} no apunta a nada`);
  });

  prueba('cada operación tiene un operationId único y un resumen (summary)', async () => {
    const vistos = new Set();
    for (const { metodo, ruta, operacion } of operaciones(await documentoVivo())) {
      const nombre = `${metodo.toUpperCase()} ${ruta}`;
      verdadero(operacion.summary, `${nombre} no tiene summary`);
      verdadero(operacion.operationId, `${nombre} no tiene operationId`);
      verdadero(!vistos.has(operacion.operationId), `el operationId "${operacion.operationId}" está repetido`);
      vistos.add(operacion.operationId);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Solicitudes de prueba: cada una declara a qué operación de la documentación corresponde.
// [método, plantilla de la ruta, solicitud real, opciones]
function escenarios(v) {
  const ok = { json: { nombre: 'Final', peso: 30 } };
  const JSON_ROTO = { texto: '{"nombre": ', cabeceras: { 'Content-Type': 'application/json' } };
  const TEXTO = { texto: 'hola', cabeceras: { 'Content-Type': 'text/plain' } };
  return [
    ['POST', `/${v}/evaluaciones`, `/${v}/evaluaciones`, ok],
    ['POST', `/${v}/evaluaciones`, `/${v}/evaluaciones`, JSON_ROTO],
    ['POST', `/${v}/evaluaciones`, `/${v}/evaluaciones`, TEXTO],
    ['POST', `/${v}/evaluaciones`, `/${v}/evaluaciones`, { json: { nombre: '', peso: 10 } }],
    ['POST', `/${v}/evaluaciones`, `/${v}/evaluaciones`, { json: { nombre: 'Taller', peso: 10 } }],
    ['GET', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/1`],
    ['GET', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/99`],
    ['PATCH', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/1`, { json: { nota: 4.5 } }],
    ['PATCH', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/1`, { json: { nota: 9 } }],
    ['PATCH', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/99`, { json: { nota: 4 } }],
    ['PATCH', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/1`, JSON_ROTO],
    ['PATCH', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/1`, TEXTO],
    ['DELETE', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/2`],
    ['DELETE', `/${v}/evaluaciones/{id}`, `/${v}/evaluaciones/99`],
    ['GET', `/${v}/resumen`, `/${v}/resumen`],
    ...(v === 'v1'
      ? [['GET', '/v1/evaluaciones', '/v1/evaluaciones']]
      : [
          ['GET', '/v2/evaluaciones', '/v2/evaluaciones'],
          ['GET', '/v2/evaluaciones', '/v2/evaluaciones?pagina=0'],
        ]),
  ];
}

g('5B · La documentación no miente', () => {
  prueba('cada ruta del código está documentada (método y dirección)', async () => {
    const doc = await documentoVivo();
    const rutas = crearRutas(new NotasModelo(new AlmacenMemoria()));
    verdadero(rutas.length >= 6, `Primero registra las rutas en crearRutas: ahora hay ${rutas.length}`);
    for (const { metodo, ruta } of rutas) {
      verdadero(doc.paths?.[ruta]?.[metodo.toLowerCase()], `Falta documentar ${metodo} ${ruta} en servidor/openapi.mjs`);
    }
  });

  prueba('cada operación documentada existe en el código (no se documenta lo que no hay)', async () => {
    const doc = await documentoVivo();
    const reales = new Set(crearRutas(new NotasModelo(new AlmacenMemoria())).map((r) => `${r.metodo} ${r.ruta}`));
    for (const { metodo, ruta } of operaciones(doc)) {
      verdadero(reales.has(`${metodo.toUpperCase()} ${ruta}`), `La documentación habla de ${metodo.toUpperCase()} ${ruta}, pero el código no la tiene`);
    }
  });

  prueba('todo estado HTTP que la API devuelve está declarado en la documentación', async () => {
    const doc = await documentoVivo();
    for (const v of ['v1', 'v2']) {
      for (const [metodo, plantilla, ruta, opciones] of escenarios(v)) {
        const r = await conServidor((llamar) => llamar(metodo, ruta, opciones), { datos: SEMILLA });
        const operacion = doc.paths?.[plantilla]?.[metodo.toLowerCase()];
        if (!operacion) throw new FalloDePrueba(`Falta documentar ${metodo} ${plantilla}`);
        const declarada = operacion.responses?.[String(r.status)];
        verdadero(declarada, `${metodo} ${plantilla} respondió ${r.status} pero la documentación no declara ese estado`);
        if (r.status >= 400) {
          verdadero(
            declarada.content?.['application/problem+json'],
            `${metodo} ${plantilla}: el estado ${r.status} debe declarar el contenido application/problem+json`,
          );
        }
      }
    }
  });

  prueba('las operaciones con {id} declaran el parámetro de ruta "id"', async () => {
    for (const { metodo, ruta, operacion } of operaciones(await documentoVivo())) {
      if (!ruta.includes('{id}')) continue;
      const parametro = (operacion.parameters ?? []).find((p) => p.name === 'id' && p.in === 'path');
      verdadero(parametro?.required === true, `${metodo.toUpperCase()} ${ruta} debe declarar el parámetro de ruta "id" como obligatorio`);
    }
  });

  prueba('la lista v1 está marcada como obsoleta (deprecated) y la v2 no', async () => {
    const doc = await documentoVivo();
    igual(doc.paths?.['/v1/evaluaciones']?.get?.deprecated, true, 'GET /v1/evaluaciones debe llevar deprecated: true');
    verdadero(!doc.paths?.['/v2/evaluaciones']?.get?.deprecated, 'GET /v2/evaluaciones no está obsoleta');
  });

  prueba('la respuesta 200 de la lista v1 documenta Deprecation, Sunset y Link', async () => {
    const cabeceras = (await documentoVivo()).paths?.['/v1/evaluaciones']?.get?.responses?.['200']?.headers ?? {};
    for (const nombre of ['Deprecation', 'Sunset', 'Link']) verdadero(cabeceras[nombre], `falta documentar la cabecera ${nombre} en GET /v1/evaluaciones`);
  });

  prueba('la lista v2 documenta sus parámetros (pagina, porPagina, estado, orden) y la cabecera Link', async () => {
    const operacion = (await documentoVivo()).paths?.['/v2/evaluaciones']?.get;
    verdadero(operacion, 'falta documentar GET /v2/evaluaciones');
    for (const nombre of ['pagina', 'porPagina', 'estado', 'orden']) {
      verdadero((operacion.parameters ?? []).some((p) => p.name === nombre && p.in === 'query'), `GET /v2/evaluaciones debe documentar el parámetro de consulta "${nombre}"`);
    }
    verdadero(operacion.responses?.['200']?.headers?.Link, 'falta documentar la cabecera Link en la respuesta 200');
    verdadero(operacion.responses?.['200']?.content?.['application/json'], 'falta el contenido de la respuesta 200');
  });
});
