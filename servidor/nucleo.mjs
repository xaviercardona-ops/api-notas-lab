/**
 * NÚCLEO HTTP · la "plomería" de la API                   (ya escrito: léelo, pero no hace falta modificarlo)
 *
 * Hace lo que NO es tu negocio ni tu diseño:
 *   · busca la ruta que corresponde a cada solicitud (y responde 404 o 405 con "Allow" si no hay);
 *   · lee y valida el cuerpo JSON de POST/PUT/PATCH (415 si no es JSON, 400 si está roto, 413 si es enorme);
 *   · convierte cualquier error en un problema legible (RFC 9457: application/problem+json);
 *   · si algo inesperado revienta, responde 500 SIN filtrar detalles internos;
 *   · sirve los archivos del navegador (la carpeta cliente/) para que todo viva en un solo origen.
 *
 * Tus manejadores (servidor/rutas.mjs) reciben una SOLICITUD y devuelven una RESPUESTA, sin tocar req/res:
 *
 *   solicitud = { metodo, ruta, base, params, query, cabeceras, cuerpo }
 *       ruta     "/v1/evaluaciones/3"            base    "/v1"
 *       params   { id: "3" }  (siempre texto)    query   URLSearchParams  (?pagina=2 → query.get('pagina'))
 *       cuerpo   el JSON ya validado (solo en POST/PUT/PATCH)
 *   respuesta = { status, cuerpo?, cabeceras? }
 *
 * Para fallar: lanza `new ErrorHttp(status, 'detalle para humanos')`. Los errores del Modelo
 * (ErrorDeReglas) pasan por `traducirError` (tu tabla en rutas.mjs).
 */

import { STATUS_CODES } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Las frases oficiales de RFC 9110 (Node todavía llama 422 "Unprocessable Entity" y 413 "Payload Too Large").
const FRASES = {
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  412: 'Precondition Failed',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  500: 'Internal Server Error',
};
export const frase = (status) => FRASES[status] ?? STATUS_CODES[status] ?? 'Error';

const LIMITE_CUERPO = 100 * 1024; // 100 KB: de sobra para una evaluación

/** Un fallo con estado HTTP. `tipo` y `titulo` (opcionales) identifican el problema; `cabeceras` se añaden a la respuesta. */
export class ErrorHttp extends Error {
  constructor(status, detalle, { tipo, titulo, cabeceras } = {}) {
    super(detalle);
    this.name = 'ErrorHttp';
    this.status = status;
    this.tipo = tipo;
    this.titulo = titulo;
    this.cabeceras = cabeceras ?? {};
  }
}

/** El documento de problema de RFC 9457: type, title, status, detail e instance. */
export function documentoProblema({ status, detalle, instancia, tipo = 'about:blank', titulo }) {
  return { type: tipo, title: titulo ?? frase(status), status, detail: detalle, instance: instancia };
}

/** Registra las mismas definiciones bajo varias versiones: paraVersiones(['v1','v2'], [...]) → /v1/... y /v2/... */
export function paraVersiones(versiones, definiciones) {
  return versiones.flatMap((version) => definiciones.map((d) => ({ ...d, ruta: `/${version}${d.ruta}` })));
}

/** Lee un parámetro entero de la query (?pagina=2). Si no viene → porDefecto; si no es válido → 400. */
export function leerEntero(query, nombre, { porDefecto, min = -Infinity, max = Infinity }) {
  const texto = query.get(nombre);
  if (texto === null) return porDefecto;
  const valor = Number(texto);
  if (texto.trim() === '' || !Number.isInteger(valor) || valor < min || valor > max) {
    const rango = max === Infinity ? `mayor o igual que ${min}` : `entre ${min} y ${max}`;
    throw new ErrorHttp(400, `El parámetro "${nombre}" debe ser un entero ${rango}.`);
  }
  return valor;
}

// ---------------------------------------------------------------------------------------------
// Rutas: "/v1/evaluaciones/{id}" se compila a una expresión regular con el parámetro "id".

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compilar(plantilla) {
  const nombres = [];
  const patron = plantilla
    .split('/')
    .map((segmento) => {
      const parametro = /^\{(\w+)\}$/.exec(segmento);
      if (!parametro) return escapar(segmento);
      nombres.push(parametro[1]);
      return '([^/]+)';
    })
    .join('/');
  return { regex: new RegExp(`^${patron}$`), nombres };
}

// ---------------------------------------------------------------------------------------------
// Cuerpo JSON

async function leerCuerpoJson(req) {
  const tipo = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (tipo !== 'application/json') {
    throw new ErrorHttp(415, 'El cuerpo debe enviarse como application/json (cabecera Content-Type).');
  }
  const partes = [];
  let tamano = 0;
  for await (const parte of req) {
    tamano += parte.length;
    if (tamano <= LIMITE_CUERPO) partes.push(parte);
  }
  if (tamano > LIMITE_CUERPO) throw new ErrorHttp(413, `El cuerpo no puede superar ${LIMITE_CUERPO / 1024} KB.`);
  const texto = Buffer.concat(partes).toString('utf8');
  if (texto.trim() === '') throw new ErrorHttp(400, 'El cuerpo de la solicitud es obligatorio.');
  let valor;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw new ErrorHttp(400, 'El cuerpo no es JSON válido.');
  }
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON.');
  }
  return valor;
}

// ---------------------------------------------------------------------------------------------
// Archivos del navegador

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function servirArchivo(carpeta, ruta) {
  let relativa;
  try {
    relativa = normalize(decodeURIComponent(ruta));
  } catch {
    return null;
  }
  if (/[\\/]$/.test(relativa) || relativa === '.') relativa = join(relativa, 'index.html'); // "/" (o "\\" en Windows) → la página
  const archivo = join(carpeta, relativa);
  if (!archivo.startsWith(carpeta)) return null; // intento de salir de la carpeta
  try {
    const contenido = await readFile(archivo);
    return { status: 200, archivo: contenido, cabeceras: { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' } };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// El manejador de Node

function enviar(res, { status, cuerpo, archivo, cabeceras = {} }) {
  const comunes = { 'Cache-Control': 'no-cache', ...cabeceras };
  if (archivo !== undefined) {
    res.writeHead(status, { 'Content-Length': archivo.length, ...comunes });
    res.end(archivo);
  } else if (cuerpo === undefined) {
    res.writeHead(status, comunes); // 204, 304: sin cuerpo
    res.end();
  } else {
    const texto = JSON.stringify(cuerpo);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(texto), ...comunes });
    res.end(texto);
  }
}

/**
 * Crea la función que atiende cada solicitud de Node.
 *   rutas          [{ metodo, ruta, manejador }]  (ruta con plantillas: "/v1/evaluaciones/{id}")
 *   traducirError  (error) → ErrorHttp | el mismo error  (aquí se traducen los ErrorDeReglas)
 *   carpetaEstatica carpeta con los archivos del navegador
 *   registrar      true → escribe una línea por solicitud (y los errores inesperados) en la terminal
 */
export function crearManejador({ rutas, traducirError = (error) => error, carpetaEstatica, registrar = false }) {
  const tabla = rutas.map((definicion) => ({ ...definicion, ...compilar(definicion.ruta) }));

  async function resolver(req, ruta, query) {
    const candidatas = [];
    for (const definicion of tabla) {
      const coincidencia = definicion.regex.exec(ruta);
      if (coincidencia) candidatas.push({ definicion, coincidencia });
    }

    if (candidatas.length === 0) {
      if (req.method === 'GET' && carpetaEstatica) {
        const archivo = await servirArchivo(carpetaEstatica, ruta);
        if (archivo) return archivo;
      }
      throw new ErrorHttp(404, `No existe ${ruta}.`);
    }

    const elegida = candidatas.find((c) => c.definicion.metodo === req.method);
    if (!elegida) {
      const permitidos = [...new Set(candidatas.map((c) => c.definicion.metodo))].sort().join(', ');
      throw new ErrorHttp(405, `El método ${req.method} no está permitido en ${ruta}.`, { cabeceras: { Allow: permitidos } });
    }

    let params;
    try {
      params = Object.fromEntries(elegida.definicion.nombres.map((nombre, i) => [nombre, decodeURIComponent(elegida.coincidencia[i + 1])]));
    } catch {
      throw new ErrorHttp(400, 'La dirección contiene una codificación inválida.');
    }
    const cuerpo = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await leerCuerpoJson(req) : undefined;
    const base = /^\/v\d+(?=\/)/.exec(ruta)?.[0] ?? '';
    return elegida.definicion.manejador({ metodo: req.method, ruta, base, params, query, cabeceras: req.headers, cuerpo });
  }

  function respuestaDeError(error, instancia) {
    let http = error;
    if (!(http instanceof ErrorHttp)) {
      try {
        http = traducirError(error);
      } catch (otro) {
        http = otro;
      }
    }
    if (!(http instanceof ErrorHttp)) {
      if (registrar) console.error(error);
      http = new ErrorHttp(500, 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.'); // nada interno sale al cliente
    }
    return {
      status: http.status,
      cabeceras: { 'Content-Type': 'application/problem+json; charset=utf-8', ...http.cabeceras },
      cuerpo: documentoProblema({ status: http.status, detalle: http.message, instancia, tipo: http.tipo, titulo: http.titulo }),
    };
  }

  return async function manejar(req, res) {
    const inicio = performance.now();
    const [ruta, ...resto] = String(req.url).split('?');
    const query = new URLSearchParams(resto.join('?'));
    let respuesta;
    try {
      if (!ruta.startsWith('/')) throw new ErrorHttp(400, 'La dirección de la solicitud no es válida.');
      respuesta = await resolver(req, ruta, query);
    } catch (error) {
      respuesta = respuestaDeError(error, ruta);
    }
    enviar(res, respuesta);
    if (registrar) {
      const ms = Math.round(performance.now() - inicio);
      console.log(`${req.method.padEnd(6)} ${req.url}  →  ${respuesta.status}  (${ms} ms)`);
    }
  };
}
