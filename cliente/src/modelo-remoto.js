/**
 * MODELO REMOTO · Notas del semestre                                       (PARTE 3A de la guía)
 *
 * SABE: pedirle el estado a la API, ordenarle cambios y avisar a sus suscriptores cuando algo cambió.
 *       Es el Modelo "visto desde el navegador": tiene la misma cara que el de la clase pasada
 *       (evaluaciones, resumen(), agregar, calificar, eliminar, suscribir), pero ya no decide nada.
 * NO SABE: ninguna regla de negocio (cuánto puede pesar una evaluación, cuándo se aprueba…). Esas viven
 *          en el servidor, que es su único dueño. Si el servidor dice que no, aquí se avisa; no se discute.
 *
 * Idea clave: la Vista y el Controlador siguen hablando con "un Modelo". Que ahora ese Modelo hable
 * HTTP por dentro es un detalle que solo este archivo (y cliente-api.js) conoce.
 *
 * Tu trabajo: reemplazar cada "TODO" hasta que `npm run test:cliente` (grupo 3A) quede en verde.
 */

import { ErrorApi, ErrorDeRed } from './cliente-api.js';

/** El servidor rechazó la orden por una regla del negocio. Su mensaje se puede mostrar tal cual. */
export class ErrorDeReglas extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDeReglas';
  }
}

/** Algo falló en el cable o en el servidor (no es culpa del usuario): sin red, 500… */
export class ErrorDeServicio extends Error {
  constructor(mensaje, causa) {
    super(mensaje);
    this.name = 'ErrorDeServicio';
    this.cause = causa;
  }
}

/** De un fallo de HTTP a un error que el Controlador entienda. */
function traducir(error) {
  // TODO 3A (errores): decide qué es cada cosa.
  //   · ErrorApi con estado 404, 409 o 422 → son decisiones del negocio → new ErrorDeReglas(<el "detail" del problema>)
  //     (error.problema?.detail trae el mensaje legible que mandó el servidor).
  //   · cualquier otro ErrorApi (400, 415, 500…) → new ErrorDeServicio('El servidor no pudo completar la operación.', error)
  //   · ErrorDeRed (no hubo respuesta) → new ErrorDeServicio('No hay conexión con el servidor.', error)
  //   · lo demás es un fallo de programación: se devuelve igual, no se esconde.
  return error;
}

export class NotasModeloRemoto {
  #api;
  #evaluaciones = [];
  #resumen = null;
  #suscriptores = new Set();

  constructor(api) {
    this.#api = api;
  }

  // EJEMPLO RESUELTO: pide al servidor el estado actual (la lista y el resumen), lo guarda y avisa a los suscriptores.
  // Fíjate en que el servidor es "la verdad": después de cada orden, el Modelo vuelve a preguntar.
  async sincronizar() {
    let evaluaciones;
    let resumen;
    try {
      [evaluaciones, resumen] = await Promise.all([this.#api.listarEvaluaciones(), this.#api.obtenerResumen()]);
    } catch (error) {
      throw traducir(error);
    }
    this.#evaluaciones = evaluaciones;
    this.#resumen = resumen;
    for (const suscriptor of this.#suscriptores) suscriptor();
  }

  /** Ya escrito. Copias, como en el Modelo de la clase pasada. */
  get evaluaciones() {
    return this.#evaluaciones.map((e) => ({ ...e }));
  }

  resumen() {
    return { ...this.#resumen };
  }

  suscribir(suscriptor) {
    this.#suscriptores.add(suscriptor);
    return () => this.#suscriptores.delete(suscriptor);
  }

  // ---------------------------------------------------------------- 3A · Las órdenes viajan por la API
  // this.#api.solicitar(metodo, recurso, cuerpo) hace la solicitud (el recurso va SIN la versión: '/evaluaciones/3')
  // y lanza ErrorApi o ErrorDeRed si algo sale mal. Cada orden es una sola solicitud a la API que diseñaste.

  async agregar({ nombre, peso, nota = null }) {
    // TODO 3A: una solicitud para crear (método y recurso de tu diseño) con { nombre, peso, nota }. Usa #ordenar.
    throw new Error('TODO 3A · agregar()');
  }

  async calificar(id, nota) {
    // TODO 3A: una solicitud para cambiar solo la nota de la evaluación `id`. Usa #ordenar.
    throw new Error('TODO 3A · calificar()');
  }

  async eliminar(id) {
    // TODO 3A: una solicitud para borrar la evaluación `id`. Usa #ordenar.
    throw new Error('TODO 3A · eliminar()');
  }

  /** Manda una orden al servidor y, si la aceptó, vuelve a pedirle el estado (el servidor es la verdad). */
  async #ordenar(orden) {
    // TODO 3A: ejecuta `orden()`. Si lanza un error: (1) si es un ErrorApi con estado 404 la evaluación ya no existe
    //          (alguien la borró desde otro aparato), así que pon la pantalla al día con
    //          `await this.sincronizar().catch(() => {})`; (2) en todos los casos lanza traducir(error).
    //          Si todo salió bien: `await this.sincronizar()`.
    await orden();
  }
}
