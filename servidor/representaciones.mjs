/**
 * REPRESENTACIONES · cómo se VE un recurso desde afuera           (ya escrito)
 *
 * En MVC, la Vista decide cómo se muestra el Modelo. En una API REST el papel de "vista" lo juega la
 * REPRESENTACIÓN: el JSON que viaja por el cable. No es el objeto interno del Modelo; es un contrato
 * con los clientes, y por eso vive en su propio archivo: si el Modelo cambia por dentro, el contrato
 * puede seguir igual.
 */

import { NOTA_MAXIMA, NOTA_MINIMA } from './modelo.js';

/** Una evaluación hacia afuera. (Solo sale lo que el contrato promete: nada interno se filtra.) */
export const representarEvaluacion = ({ id, nombre, peso, nota }) => ({ id, nombre, peso, nota });

/**
 * El resumen viaja con las reglas que la pantalla necesita para dibujarse (la nota mínima y la máxima).
 * Así el navegador NO copia las reglas del negocio: se las pide al servidor, que es su único dueño.
 */
export const representarResumen = (resumen) => ({ ...resumen, notaMinima: NOTA_MINIMA, notaMaxima: NOTA_MAXIMA });

// Cada regla del Modelo es un "tipo de problema" (RFC 9457): un identificador estable que un programa
// puede reconocer sin leer el mensaje. Convención: https://notas.example/problemas/<codigo-en-minusculas>.
const BASE_PROBLEMAS = 'https://notas.example/problemas/';
const TITULOS = {
  NO_EXISTE: 'La evaluación no existe',
  NOMBRE_OBLIGATORIO: 'Nombre obligatorio',
  NOMBRE_LARGO: 'Nombre demasiado largo',
  PESO_FUERA_DE_RANGO: 'Peso fuera de rango',
  NOTA_FUERA_DE_RANGO: 'Nota fuera de rango',
  PESOS_EXCEDEN_100: 'Los pesos superan el 100 %',
  NOMBRE_DUPLICADO: 'Nombre duplicado',
};

/** { tipo, titulo } para el problema que corresponde a un código del Modelo ({} si no lo conoce). */
export function tipoDeProblema(codigo) {
  if (!(codigo in TITULOS)) return {};
  return { tipo: BASE_PROBLEMAS + codigo.toLowerCase().replaceAll('_', '-'), titulo: TITULOS[codigo] };
}
