// RETO OPCIONAL · CONCURRENCIA (ETag, If-None-Match, If-Match)
//
// Dos aparatos leen la misma evaluación. El primero la califica; el segundo, que sigue viendo lo viejo,
// intenta calificarla también. Sin protección, el segundo pisa el trabajo del primero sin enterarse
// (la "actualización perdida"). Con un ETag el servidor puede decir "esa versión ya no existe".
//
//   npm run test:reto

import { conServidor, esProblema, SEMILLA } from './ayudas.mjs';
import { grupo, igual, igualJSON, prueba, verdadero } from './mini.js';

const SUITE = 'reto';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE, extension: true });

g('Reto · Que nadie pise el trabajo de otro', () => {
  prueba('GET /v1/evaluaciones/{id} trae un ETag que cambia cuando la evaluación cambia', () =>
    conServidor(async (llamar) => {
      const antes = (await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag');
      verdadero(antes !== null && /^"[^"]+"$/.test(antes), `falta el ETag, o no está entre comillas (llegó ${antes})`);
      igual((await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag'), antes, 'sin cambios, el ETag es el mismo');
      await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 4.4 } });
      verdadero((await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag') !== antes, 'después de un cambio, el ETag debe ser otro');
    }, { datos: SEMILLA }));

  prueba('If-None-Match con el ETag vigente responde 304 sin cuerpo', () =>
    conServidor(async (llamar) => {
      const etag = (await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag');
      const r = await llamar('GET', '/v1/evaluaciones/2', { cabeceras: { 'If-None-Match': etag } });
      igual(r.status, 304, 'si el cliente ya tiene esta versión, basta un 304 Not Modified');
      igual(r.texto, '', 'un 304 no lleva cuerpo');
      const otra = await llamar('GET', '/v1/evaluaciones/2', { cabeceras: { 'If-None-Match': '"otra-version"' } });
      igual(otra.status, 200, 'con un ETag distinto sí se manda completa');
    }, { datos: SEMILLA }));

  prueba('PATCH con If-Match vigente responde 200 y devuelve el ETag nuevo', () =>
    conServidor(async (llamar) => {
      const etag = (await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag');
      const r = await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 4.5 }, cabeceras: { 'If-Match': etag } });
      igual(r.status, 200);
      const nuevo = r.cabeceras.get('etag');
      verdadero(nuevo !== null && nuevo !== etag, 'el PATCH debe devolver el ETag de la versión nueva');
      igual((await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag'), nuevo);
    }, { datos: SEMILLA }));

  prueba('PATCH con un If-Match viejo responde 412 Precondition Failed y no cambia nada', () =>
    conServidor(async (llamar) => {
      const viejo = (await llamar('GET', '/v1/evaluaciones/2')).cabeceras.get('etag');
      await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 4 } }); // el otro aparato se adelantó
      const r = await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 1 }, cabeceras: { 'If-Match': viejo } });
      esProblema(r, 412, 'PATCH con If-Match viejo');
      igual((await llamar('GET', '/v1/evaluaciones/2')).json.nota, 4, 'la nota del primer aparato se conserva');
    }, { datos: SEMILLA }));

  prueba('sin If-Match el PATCH sigue funcionando como antes (la protección es opcional)', () =>
    conServidor(async (llamar) => {
      igual((await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 4 } })).status, 200);
    }, { datos: SEMILLA }));

  prueba('la documentación declara el 304 de GET y el 412 de PATCH', () =>
    conServidor(async (llamar) => {
      const { paths } = (await llamar('GET', '/openapi.json')).json;
      verdadero(paths['/v1/evaluaciones/{id}']?.get?.responses?.['304'], 'documenta el 304 en GET /v1/evaluaciones/{id}');
      verdadero(paths['/v1/evaluaciones/{id}']?.patch?.responses?.['412'], 'documenta el 412 en PATCH /v1/evaluaciones/{id}');
      igualJSON(Object.keys(paths['/v1/evaluaciones/{id}'].get.responses['200'].headers ?? {}), ['ETag'], 'la respuesta 200 declara la cabecera ETag');
    }));
});
