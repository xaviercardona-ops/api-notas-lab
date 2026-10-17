// PRUEBAS DE VERSIONADO (PARTE 4)
//
// El problema: la lista de la v1 devuelve un arreglo pelado, y un arreglo no tiene dónde poner "total" ni
// "página". Cambiarlo a un objeto ROMPERÍA a todos los clientes que ya existen. Solución: una versión nueva
// (v2) con la forma nueva, y la v1 intacta pero con avisos de que va a retirarse.
//
//   npm run test:versionado

import { conServidor, crearVarias, leerLink, SEMILLA } from './ayudas.mjs';
import { esProblema } from './ayudas.mjs';
import { grupo, igual, igualJSON, prueba, verdadero } from './mini.js';

const SUITE = 'versionado';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE });

const ids = (respuesta) => respuesta.json.datos.map((e) => e.id);

// ---------------------------------------------------------------------------------------------
g('4A · v2: lista con paginación, filtro y orden', () => {
  prueba('GET /v2/evaluaciones devuelve un objeto con "datos" y "paginacion"', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v2/evaluaciones');
      igual(r.status, 200, 'GET /v2/evaluaciones debe responder 200');
      verdadero(!Array.isArray(r.json), 'la v2 devuelve un objeto, no un arreglo');
      igual(r.json.datos.length, 2);
      igualJSON(r.json.datos[0], { id: 1, nombre: 'Parcial 1', peso: 30, nota: 4 });
      igualJSON(r.json.paginacion, { pagina: 1, porPagina: 10, total: 2, totalPaginas: 1 });
    }, { datos: SEMILLA }));

  prueba('?pagina y ?porPagina recortan la lista y la paginación cuenta bien', () =>
    conServidor(async (llamar) => {
      await crearVarias(llamar, 7);
      const r = await llamar('GET', '/v2/evaluaciones?porPagina=3&pagina=2');
      igualJSON(ids(r), [4, 5, 6], 'la página 2 de 3 debe traer las evaluaciones 4, 5 y 6');
      igualJSON(r.json.paginacion, { pagina: 2, porPagina: 3, total: 7, totalPaginas: 3 });
      igualJSON(ids(await llamar('GET', '/v2/evaluaciones?porPagina=3&pagina=3')), [7], 'la última página trae lo que sobra');
    }));

  prueba('una página después del final es válida: 200 con "datos" vacío', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v2/evaluaciones?pagina=9');
      igual(r.status, 200);
      igualJSON(r.json.datos, []);
      igual(r.json.paginacion.total, 2);
    }, { datos: SEMILLA }));

  prueba('Link (RFC 8288) dice dónde están la página anterior y la siguiente, conservando el filtro', () =>
    conServidor(async (llamar) => {
      await crearVarias(llamar, 7);
      const media = leerLink((await llamar('GET', '/v2/evaluaciones?porPagina=3&pagina=2&orden=-nombre')).cabeceras.get('link'));
      const siguiente = media.find((l) => l.rel === 'next');
      const anterior = media.find((l) => l.rel === 'prev');
      verdadero(siguiente && anterior, 'en una página del medio deben venir rel="prev" y rel="next"');
      const url = new URL(siguiente.url, 'http://x');
      igual(url.pathname, '/v2/evaluaciones');
      igual(url.searchParams.get('pagina'), '3');
      igual(url.searchParams.get('porPagina'), '3', 'el enlace conserva porPagina');
      igual(url.searchParams.get('orden'), '-nombre', 'el enlace conserva el orden');
      igual(new URL(anterior.url, 'http://x').searchParams.get('pagina'), '1');

      const primera = leerLink((await llamar('GET', '/v2/evaluaciones?porPagina=3')).cabeceras.get('link'));
      verdadero(primera.some((l) => l.rel === 'next') && !primera.some((l) => l.rel === 'prev'), 'la primera página solo tiene "next"');
      const ultima = leerLink((await llamar('GET', '/v2/evaluaciones?porPagina=3&pagina=3')).cabeceras.get('link'));
      verdadero(ultima.some((l) => l.rel === 'prev') && !ultima.some((l) => l.rel === 'next'), 'la última página solo tiene "prev"');
      igual((await llamar('GET', '/v2/evaluaciones')).cabeceras.get('link'), null, 'si todo cabe en una página no hay Link');
    }));

  prueba('?estado=pendiente y ?estado=calificada filtran por tener nota', () =>
    conServidor(async (llamar) => {
      const pendientes = await llamar('GET', '/v2/evaluaciones?estado=pendiente');
      igualJSON(ids(pendientes), [2]);
      igual(pendientes.json.paginacion.total, 1, 'el total cuenta solo lo que pasó el filtro');
      igualJSON(ids(await llamar('GET', '/v2/evaluaciones?estado=calificada')), [1]);
    }, { datos: SEMILLA }));

  prueba('?orden ordena por nombre o peso; el signo menos invierte', () =>
    conServidor(async (llamar) => {
      igualJSON(ids(await llamar('GET', '/v2/evaluaciones?orden=-peso')), [1, 2], 'de mayor a menor peso');
      igualJSON(ids(await llamar('GET', '/v2/evaluaciones?orden=peso')), [2, 1], 'de menor a mayor peso');
      igualJSON(ids(await llamar('GET', '/v2/evaluaciones?orden=nombre')), [1, 2], 'Parcial 1 antes que Taller');
      igualJSON(ids(await llamar('GET', '/v2/evaluaciones?orden=-nombre')), [2, 1]);
    }, { datos: SEMILLA }));

  prueba('un parámetro inválido responde 400 y el detalle nombra el parámetro', () =>
    conServidor(async (llamar) => {
      const malos = ['pagina=0', 'pagina=abc', 'porPagina=0', 'porPagina=51', 'porPagina=2.5', 'estado=otro', 'orden=peso;drop'];
      for (const consulta of malos) {
        const r = await llamar('GET', `/v2/evaluaciones?${consulta}`);
        esProblema(r, 400, `?${consulta}`);
        const nombre = consulta.split('=')[0];
        verdadero(r.json.detail.includes(`"${nombre}"`), `el detalle debe nombrar el parámetro "${nombre}" (llegó: ${r.json.detail})`);
      }
    }, { datos: SEMILLA }));
});

// ---------------------------------------------------------------------------------------------
g('4B · v1 sigue igual… y avisa que se retira', () => {
  prueba('la v1 sigue devolviendo un arreglo (no se rompe a nadie)', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v1/evaluaciones');
      verdadero(Array.isArray(r.json), 'GET /v1/evaluaciones debe seguir siendo un arreglo; la forma nueva es de la v2');
      igual(r.json.length, 2);
    }, { datos: SEMILLA }));

  prueba('Deprecation (RFC 9745): la v1 avisa desde cuándo está obsoleta, con una fecha como @segundos', () =>
    conServidor(async (llamar) => {
      const valor = (await llamar('GET', '/v1/evaluaciones')).cabeceras.get('deprecation');
      verdadero(valor !== null, 'falta la cabecera Deprecation en GET /v1/evaluaciones');
      verdadero(/^@\d{9,}$/.test(valor), `Deprecation debe ser una fecha estructurada: "@" y los segundos Unix (llegó "${valor}")`);
    }, { datos: SEMILLA }));

  prueba('Sunset (RFC 8594): avisa cuándo se retira, en fecha HTTP, y no antes de la obsolescencia', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v1/evaluaciones');
      const sunset = r.cabeceras.get('sunset');
      verdadero(sunset !== null, 'falta la cabecera Sunset en GET /v1/evaluaciones');
      verdadero(
        /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(sunset),
        `Sunset debe ser una fecha HTTP como "Fri, 31 Dec 2027 23:59:59 GMT" (llegó "${sunset}")`,
      );
      const desde = Number(r.cabeceras.get('deprecation')?.slice(1)) * 1000;
      verdadero(Date.parse(sunset) >= desde, 'la fecha de retiro no puede ser anterior a la de obsolescencia');
    }, { datos: SEMILLA }));

  prueba('Link rel="successor-version" (RFC 5829) apunta a la versión nueva', () =>
    conServidor(async (llamar) => {
      const enlaces = leerLink((await llamar('GET', '/v1/evaluaciones')).cabeceras.get('link'));
      const sucesora = enlaces.find((l) => l.rel === 'successor-version');
      verdadero(sucesora, 'falta Link: <...>; rel="successor-version" en GET /v1/evaluaciones');
      igual(sucesora.url, '/v2/evaluaciones');
    }, { datos: SEMILLA }));

  prueba('solo lo que cambió está obsoleto: el resto de la v1 no lleva avisos', () =>
    conServidor(async (llamar) => {
      for (const ruta of ['/v1/resumen', '/v1/evaluaciones/1']) {
        const r = await llamar('GET', ruta);
        igual(r.status, 200, `primero implementa GET ${ruta}`);
        igual(r.cabeceras.get('deprecation'), null, `${ruta} no está obsoleto`);
        igual(r.cabeceras.get('sunset'), null, `${ruta} no tiene fecha de retiro`);
      }
    }, { datos: SEMILLA }));

  prueba('la v2 no avisa de obsolescencia', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v2/evaluaciones');
      igual(r.status, 200, 'primero implementa GET /v2/evaluaciones');
      igual(r.cabeceras.get('deprecation'), null);
      igual(r.cabeceras.get('sunset'), null);
    }, { datos: SEMILLA }));
});

// ---------------------------------------------------------------------------------------------
g('4C · v2 completa', () => {
  prueba('POST /v2/evaluaciones crea, y Location apunta dentro de /v2/', () =>
    conServidor(async (llamar) => {
      const r = await llamar('POST', '/v2/evaluaciones', { json: { nombre: 'Final', peso: 30 } });
      igual(r.status, 201);
      igual(r.cabeceras.get('location'), '/v2/evaluaciones/3', 'Location debe conservar la versión que el cliente está usando');
    }, { datos: SEMILLA }));

  prueba('lo que no cambió se puede usar igual en la v2: GET, PATCH, DELETE y resumen', () =>
    conServidor(async (llamar) => {
      igual((await llamar('GET', '/v2/evaluaciones/1')).status, 200);
      igual((await llamar('PATCH', '/v2/evaluaciones/2', { json: { nota: 4 } })).json.nota, 4);
      igual((await llamar('GET', '/v2/resumen')).json.estado, 'en-camino');
      igual((await llamar('DELETE', '/v2/evaluaciones/2')).status, 204);
    }, { datos: SEMILLA }));

  prueba('las dos versiones comparten los datos: es el mismo recurso, con dos formas de verlo', () =>
    conServidor(async (llamar) => {
      await llamar('POST', '/v1/evaluaciones', { json: { nombre: 'Final', peso: 30 } });
      igual((await llamar('GET', '/v2/evaluaciones')).json.paginacion.total, 3);
      await llamar('DELETE', '/v2/evaluaciones/3');
      igual((await llamar('GET', '/v1/evaluaciones')).json.length, 2);
    }, { datos: SEMILLA }));

  prueba('una versión que no existe (/v9) responde 404 con un problema', () =>
    conServidor(async (llamar) => {
      igual((await llamar('GET', '/v2/evaluaciones')).status, 200, 'primero implementa la v2');
      esProblema(await llamar('GET', '/v9/evaluaciones'), 404, 'GET /v9/evaluaciones');
      esProblema(await llamar('GET', '/evaluaciones'), 404, 'GET /evaluaciones sin versión');
    }, { datos: SEMILLA }));
});
