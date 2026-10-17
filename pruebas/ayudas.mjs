// Ayudas para las pruebas de la API (no necesitas leerlo ni modificarlo).
//
// Cada prueba levanta SU PROPIO servidor, en memoria y en un puerto libre, y le habla por HTTP de verdad:
// así se prueba el contrato (lo que ve cualquier cliente), no los detalles internos.

import { AlmacenMemoria } from '../servidor/almacen.mjs';
import { crearAplicacion } from '../servidor/aplicacion.mjs';
import { FalloDePrueba, igual, verdadero } from './mini.js';

/** Datos iniciales de casi todas las pruebas: 50 % de los pesos ya está repartido. */
export const SEMILLA = [
  { id: 1, nombre: 'Parcial 1', peso: 30, nota: 4 },
  { id: 2, nombre: 'Taller', peso: 20, nota: null },
];

/** Una función para hacer solicitudes a `base` y leer lo esencial de la respuesta. */
export function crearLlamador(base) {
  return async function llamar(metodo, ruta, { json, texto, cabeceras = {} } = {}) {
    const opciones = { method: metodo, headers: { ...cabeceras } };
    if (json !== undefined) {
      opciones.headers['Content-Type'] ??= 'application/json';
      opciones.body = JSON.stringify(json);
    } else if (texto !== undefined) {
      opciones.body = texto;
    }
    const respuesta = await fetch(base + ruta, opciones);
    const cuerpo = await respuesta.text();
    let datos;
    try {
      datos = cuerpo === '' ? undefined : JSON.parse(cuerpo);
    } catch {
      datos = undefined;
    }
    return {
      status: respuesta.status,
      cabeceras: respuesta.headers,
      tipo: respuesta.headers.get('content-type') ?? '',
      json: datos,
      texto: cuerpo,
    };
  };
}

/**
 * Levanta un servidor limpio, ejecuta `cuerpo(llamar, base)` y lo apaga.
 *   datos    evaluaciones iniciales (por defecto, ninguna)
 *   almacen  un almacén propio (para probar fallos)
 */
export async function conServidor(cuerpo, { datos = [], almacen } = {}) {
  const servidor = crearAplicacion({ almacen: almacen ?? new AlmacenMemoria(datos) });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try {
    return await cuerpo(crearLlamador(base), base);
  } finally {
    await new Promise((resolver) => {
      servidor.close(resolver);
      servidor.closeAllConnections?.();
    });
  }
}

/** Una respuesta de error debe ser un documento de problema (RFC 9457) con el estado esperado. */
export function esProblema(respuesta, status, contexto = '') {
  const donde = contexto ? `${contexto}: ` : '';
  igual(respuesta.status, status, `${donde}se esperaba el estado ${status}`);
  verdadero(
    respuesta.tipo.toLowerCase().startsWith('application/problem+json'),
    `${donde}un error debe llevar Content-Type: application/problem+json (llegó "${respuesta.tipo}")`,
  );
  const problema = respuesta.json;
  verdadero(problema && typeof problema === 'object', `${donde}el cuerpo de un error debe ser un objeto JSON`);
  igual(problema.status, status, `${donde}el campo "status" del problema debe repetir el estado HTTP`);
  verdadero(typeof problema.title === 'string' && problema.title !== '', `${donde}el problema debe tener "title"`);
  verdadero(typeof problema.detail === 'string' && problema.detail !== '', `${donde}el problema debe tener "detail" (una explicación para una persona)`);
  verdadero(typeof problema.type === 'string' && problema.type !== '', `${donde}el problema debe tener "type"`);
}

/** Lee la cabecera Link (RFC 8288) como una lista de { url, rel }. */
export function leerLink(valor) {
  if (!valor) return [];
  return [...valor.matchAll(/<([^>]+)>\s*;\s*rel="([^"]+)"/g)].map(([, url, rel]) => ({ url, rel }));
}

/** Crea varias evaluaciones por la API (pesos de 1 en 1 para no pasarse de 100). Devuelve las respuestas. */
export async function crearVarias(llamar, cantidad, version = 'v1') {
  const creadas = [];
  for (let i = 1; i <= cantidad; i += 1) {
    const r = await llamar('POST', `/${version}/evaluaciones`, { json: { nombre: `Eval ${String(i).padStart(2, '0')}`, peso: 1, nota: i % 2 === 0 ? 3 : null } });
    if (r.status !== 201) throw new FalloDePrueba(`No se pudo crear la evaluación de prueba ${i}: llegó el estado ${r.status}`);
    creadas.push(r.json);
  }
  return creadas;
}
