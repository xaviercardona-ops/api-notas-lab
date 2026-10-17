/**
 * CONTROLADOR · Notas del semestre                                      (PARTE 3B de la guía)
 *
 * SABE: traducir lo que hace el usuario (eventos de la Vista) en órdenes para el Modelo,
 *       y qué mostrar cuando el Modelo rechaza una orden o no se puede completar.
 * NO SABE: HTML ni DOM (eso es de la Vista), ni las reglas del negocio (eso es del servidor),
 *          ni HTTP (eso es de cliente-api.js).
 *
 * Es "delgado": cada método hace tres cosas como máximo (leer → ordenar → reaccionar).
 *
 * Este es el Controlador de la clase pasada. Lo único que debe cambiar es esto: las órdenes al Modelo ahora
 * viajan por la red y TARDAN, así que devuelven promesas y el Controlador tiene que ESPERARLAS.
 * Tu trabajo: reemplazar cada "TODO" hasta que `npm run test:cliente` (grupo 3B) quede en verde.
 */

import { ErrorDeReglas, ErrorDeServicio } from './modelo-remoto.js';

const MENSAJE_SERVICIO = 'No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.';

// "" → sin nota (null); "4.2" → 4.2
const aNota = (texto) => (String(texto).trim() === '' ? null : Number(texto));

export class NotasControlador {
  #modelo;
  #vista;

  constructor(modelo, vista) {
    this.#modelo = modelo;
    this.#vista = vista;

    vista.alAgregar((datos) => this.#agregar(datos));
    vista.alEliminar((id) => this.#intentar(() => modelo.eliminar(id)));
    vista.alCalificar((id, texto) => this.#intentar(() => modelo.calificar(id, aNota(texto))));
  }

  #agregar(datos) {
    // TODO 3B (1): el formulario solo debe limpiarse cuando el servidor ACEPTÓ la orden. Ahora #intentar
    //              devolverá una promesa: hay que esperarla antes de preguntar si fue aceptada.
    const acepto = this.#intentar(() =>
      this.#modelo.agregar({ nombre: datos.nombre, peso: Number(datos.peso), nota: aNota(datos.nota) }),
    );
    if (acepto) this.#vista.limpiarFormulario();
  }

  /** Ejecuta una orden al Modelo; si no se puede cumplir, muestra el motivo y refresca la Vista. */
  #intentar(orden) {
    // TODO 3B (2): la orden devuelve una promesa. Si no la esperas (await), el try/catch no atrapa su rechazo
    //              y el error se pierde. Convierte este método en async y espera la orden.
    // TODO 3B (3): además de ErrorDeReglas (culpa del usuario: se muestra su mensaje), puede llegar un
    //              ErrorDeServicio (falló el cable o el servidor: se muestra MENSAJE_SERVICIO). Cualquier otro
    //              error es un fallo de programación: NO se esconde (se vuelve a lanzar).
    try {
      orden();
      this.#vista.limpiarError();
      return true;
    } catch (error) {
      if (!(error instanceof ErrorDeReglas)) throw error; // un error inesperado no se esconde
      this.#vista.mostrarError(error.message);
      this.#vista.render(); // revierte lo que el usuario escribió y el servidor no aceptó
      return false;
    }
  }
}
