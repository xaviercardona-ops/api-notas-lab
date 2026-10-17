/**
 * APLICACIÓN · arma el servidor con todas sus piezas                          (ya escrito)
 *
 * Es la RAÍZ DE COMPOSICIÓN del servidor (igual que main.js lo es del navegador): el único lugar que
 * conoce todas las piezas y las conecta.
 *
 *     almacén ──► Modelo ──► rutas (Controlador) ──► núcleo HTTP ──► Node
 *                                  ▲
 *                     representaciones (la "Vista" de la API: el JSON)
 *
 * Recibe el almacén de afuera: con AlmacenArchivo guarda en datos/notas.json (npm start);
 * con AlmacenMemoria cada prueba tiene su propio servidor limpio.
 */

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { NotasModelo } from './modelo.js';
import { crearManejador } from './nucleo.mjs';
import { documento } from './openapi.mjs';
import { crearRutas, traducirError } from './rutas.mjs';

const CARPETA_CLIENTE = fileURLToPath(new URL('../cliente/', import.meta.url));

export function crearAplicacion({ almacen, registrar = false }) {
  const modelo = new NotasModelo(almacen);
  const rutas = [
    ...crearRutas(modelo),
    // La documentación también es un recurso: cualquier herramienta puede pedirla.
    { metodo: 'GET', ruta: '/openapi.json', manejador: () => ({ status: 200, cuerpo: documento() }) },
  ];
  return createServer(crearManejador({ rutas, traducirError, carpetaEstatica: CARPETA_CLIENTE, registrar }));
}
