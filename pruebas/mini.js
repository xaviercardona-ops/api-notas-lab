// Un mini marco de pruebas, a propósito sencillo (el mismo de la clase de MVC, ahora con pruebas asíncronas).
// No necesitas leerlo ni modificarlo: lo usan todos los archivos *.pruebas.js.

const grupos = [];
let grupoActual = null;

/** Agrupa pruebas relacionadas. Con { extension: true } el grupo es opcional (un reto). */
export function grupo(nombre, definir, opciones = {}) {
  grupoActual = { nombre, pruebas: [], extension: Boolean(opciones.extension), suite: opciones.suite ?? '' };
  grupos.push(grupoActual);
  definir();
  grupoActual = null;
}

/** Una prueba. El cuerpo puede ser asíncrono (async): el marco lo espera. */
export function prueba(nombre, cuerpo) {
  grupoActual.pruebas.push({ nombre, cuerpo });
}

export class FalloDePrueba extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'FalloDePrueba';
  }
}

const mostrar = (valor) => (typeof valor === 'string' ? JSON.stringify(valor) : JSON.stringify(valor) ?? String(valor));

export function verdadero(valor, mensaje = 'Se esperaba un valor verdadero') {
  if (!valor) throw new FalloDePrueba(mensaje);
}

export function igual(real, esperado, mensaje = 'Los valores no coinciden') {
  if (!Object.is(real, esperado)) {
    throw new FalloDePrueba(`${mensaje}\n      esperado: ${mostrar(esperado)}\n      recibido: ${mostrar(real)}`);
  }
}

// JSON con las claves ordenadas: {a:1,b:2} y {b:2,a:1} se consideran iguales.
const canonico = (valor) =>
  JSON.stringify(valor, (_clave, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)))
      : v,
  );

export function igualJSON(real, esperado, mensaje = 'Los objetos no coinciden') {
  const a = canonico(real);
  const b = canonico(esperado);
  if (a !== b) throw new FalloDePrueba(`${mensaje}\n      esperado: ${b}\n      recibido: ${a}`);
}

export function cercaDe(real, esperado, tolerancia = 1e-9, mensaje = 'Los números no son (casi) iguales') {
  if (typeof real !== 'number' || Number.isNaN(real) || Math.abs(real - esperado) > tolerancia) {
    throw new FalloDePrueba(`${mensaje}\n      esperado: ${esperado}\n      recibido: ${mostrar(real)}`);
  }
}

/** Comprueba que el cuerpo (síncrono) lance un ErrorDeReglas con ese código. */
export function lanzaReglas(cuerpo, codigoEsperado) {
  try {
    cuerpo();
  } catch (error) {
    if (error?.name !== 'ErrorDeReglas') {
      throw new FalloDePrueba(`Se esperaba un ErrorDeReglas y se lanzó: ${error?.name ?? 'algo'}: ${error?.message ?? error}`);
    }
    if (codigoEsperado !== undefined && error.codigo !== codigoEsperado) {
      throw new FalloDePrueba(`El código del error no coincide\n      esperado: "${codigoEsperado}"\n      recibido: "${error.codigo}"`);
    }
    return;
  }
  throw new FalloDePrueba('Se esperaba que lanzara un ErrorDeReglas, pero no lanzó nada');
}

/** Comprueba que una promesa se rechace con un error de ese nombre (y, si se indica, con ese mensaje exacto). */
export async function rechazaCon(promesa, nombreEsperado, mensajeEsperado) {
  try {
    await promesa;
  } catch (error) {
    if (error?.name !== nombreEsperado) {
      throw new FalloDePrueba(`Se esperaba un ${nombreEsperado} y se rechazó con: ${error?.name ?? 'algo'}: ${error?.message ?? error}`);
    }
    if (mensajeEsperado !== undefined && error.message !== mensajeEsperado) {
      throw new FalloDePrueba(`El mensaje del error no coincide\n      esperado: "${mensajeEsperado}"\n      recibido: "${error.message}"`);
    }
    return error;
  }
  throw new FalloDePrueba(`Se esperaba que se rechazara con ${nombreEsperado}, pero la promesa se cumplió`);
}

/** Lee el código fuente de un archivo del proyecto (ruta desde la raíz, ej. "servidor/rutas.mjs"). Devuelve null si no existe. */
export async function leerFuente(rutaDesdeRaiz) {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  try {
    return await readFile(fileURLToPath(new URL(`../${rutaDesdeRaiz}`, import.meta.url)), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Ejecuta todos los grupos registrados. Devuelve los resultados; no imprime nada. */
export async function ejecutar() {
  const resultado = { grupos: [], total: 0, pasan: 0, fallan: 0 };

  // Si el código olvida un `await`, una promesa rechazada queda sin dueño y Node cerraría el programa.
  // En vez de eso se la atribuimos a la prueba en curso, con un mensaje que explica qué pasó.
  let sinDueno = [];
  const alRechazarSinDueno = (razon) => sinDueno.push(razon);
  process.on('unhandledRejection', alRechazarSinDueno);

  try {
    for (const g of grupos) {
      const resultados = [];
      for (const p of g.pruebas) {
        sinDueno = [];
        try {
          await p.cuerpo();
          await new Promise((continuar) => setImmediate(continuar)); // deja que aflore alguna promesa sin dueño
          if (sinDueno.length > 0) {
            const razon = sinDueno[0];
            throw new FalloDePrueba(
              `Una promesa se rechazó y nadie la esperó (¿falta un await?)\n      ${razon?.name ?? 'Error'}: ${razon?.message ?? razon}`,
            );
          }
          resultados.push({ nombre: p.nombre, ok: true });
        } catch (error) {
          resultados.push({ nombre: p.nombre, ok: false, mensaje: error?.message ?? String(error) });
        }
      }
      const pasan = resultados.filter((r) => r.ok).length;
      resultado.grupos.push({ nombre: g.nombre, suite: g.suite, extension: g.extension, resultados, pasan });
      resultado.total += resultados.length;
      resultado.pasan += pasan;
      resultado.fallan += resultados.length - pasan;
    }
  } finally {
    process.off('unhandledRejection', alRechazarSinDueno);
  }
  return resultado;
}
