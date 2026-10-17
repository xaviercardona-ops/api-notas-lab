/**
 * VISTA · Notas del semestre
 *
 * SABE: dibujar el estado del Modelo en el DOM y avisar qué hizo el usuario (clics, formularios).
 * NO SABE: ninguna regla de negocio, ni cambiar el Modelo, ni guardar datos.
 *
 * Lee del Modelo (solo lectura) y se suscribe a sus cambios para redibujarse sola.
 *
 * Es EXACTAMENTE la Vista de la clase pasada (solo se agregó este párrafo). Que el Modelo ahora sea remoto
 * (modelo-remoto.js) no le importa: sigue leyendo `evaluaciones` y `resumen()` y suscribiéndose, como antes.
 */

const TEXTO_ESTADO = {
  aprobado: () => '¡Aprobado! Ya aseguraste la nota mínima.',
  imposible: () => 'Imposible aprobar con las notas actuales.',
  'en-riesgo': (r) => `En riesgo: necesitas ${r.notaNecesaria.toFixed(2)} en lo que falta.`,
  'en-camino': (r) => `En camino: necesitas ${r.notaNecesaria.toFixed(2)} en lo que falta.`,
};
const CLASE_ESTADO = { aprobado: 'ok', imposible: 'imposible', 'en-riesgo': 'riesgo', 'en-camino': 'en-camino' };

const porcentaje = (n) => `${Math.round(n * 100) / 100} %`;

export class NotasVista {
  #modelo;
  #el;

  constructor(raiz, modelo) {
    this.#modelo = modelo;
    const q = (selector) => raiz.querySelector(selector);
    this.#el = {
      form: q('#form'),
      nombre: q('#nombre'),
      peso: q('#peso'),
      nota: q('#nota'),
      error: q('#error'),
      tabla: q('#tabla'),
      vacio: q('#vacio'),
      acumulado: q('#acumulado'),
      pesoCalificado: q('#pesoCalificado'),
      pesoPendiente: q('#pesoPendiente'),
      necesaria: q('#necesaria'),
      estado: q('#estado'),
    };
    modelo.suscribir(() => this.render());
    this.render();
  }

  // ---- Eventos que la Vista ofrece: el Controlador se registra aquí ----

  alAgregar(manejador) {
    this.#el.form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      manejador(this.leerFormulario());
    });
  }

  alEliminar(manejador) {
    this.#el.tabla.addEventListener('click', (evento) => {
      const boton = evento.target.closest('button[data-eliminar]');
      if (boton) manejador(Number(boton.dataset.eliminar));
    });
  }

  alCalificar(manejador) {
    this.#el.tabla.addEventListener('change', (evento) => {
      const campo = evento.target.closest('input[data-nota]');
      if (campo) manejador(Number(campo.dataset.nota), campo.value);
    });
  }

  // ---- Órdenes que recibe de quien la use ----

  leerFormulario() {
    return { nombre: this.#el.nombre.value, peso: this.#el.peso.value, nota: this.#el.nota.value };
  }

  limpiarFormulario() {
    this.#el.nombre.value = '';
    this.#el.peso.value = '';
    this.#el.nota.value = '';
    this.#el.nombre.focus();
  }

  mostrarError(mensaje) {
    this.#el.error.textContent = mensaje;
  }

  limpiarError() {
    this.#el.error.textContent = '';
  }

  /** Dibuja TODO a partir del Modelo. No decide nada: solo presenta. */
  render() {
    const evaluaciones = this.#modelo.evaluaciones;
    const resumen = this.#modelo.resumen();

    // Tabla (con textContent/DOM: el nombre lo escribió el usuario y nunca se interpreta como HTML)
    const filas = evaluaciones.map((e) => {
      const fila = document.createElement('tr');
      fila.append(
        celda(e.nombre),
        celda(`${e.peso} %`),
        celdaNota(e),
        celda(e.nota === null ? '—' : ((e.peso * e.nota) / 100).toFixed(2)),
        celdaEliminar(e),
      );
      return fila;
    });
    this.#el.tabla.replaceChildren(...filas);
    this.#el.vacio.hidden = evaluaciones.length > 0;

    // Resumen
    this.#el.acumulado.textContent = resumen.acumulado.toFixed(2);
    this.#el.pesoCalificado.textContent = porcentaje(resumen.pesoCalificado);
    this.#el.pesoPendiente.textContent = porcentaje(resumen.pesoPendiente);
    this.#el.necesaria.textContent = resumen.notaNecesaria === null ? '—' : resumen.notaNecesaria.toFixed(2);
    this.#el.estado.textContent = TEXTO_ESTADO[resumen.estado](resumen);
    this.#el.estado.className = `estado ${CLASE_ESTADO[resumen.estado]}`;
  }
}

function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  return td;
}

function celdaNota(evaluacion) {
  const td = document.createElement('td');
  const campo = document.createElement('input');
  campo.type = 'number';
  campo.step = 'any';
  campo.value = evaluacion.nota === null ? '' : String(evaluacion.nota);
  campo.dataset.nota = String(evaluacion.id);
  campo.setAttribute('aria-label', `Nota de ${evaluacion.nombre}`);
  td.append(campo);
  return td;
}

function celdaEliminar(evaluacion) {
  const td = document.createElement('td');
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = 'Eliminar';
  boton.dataset.eliminar = String(evaluacion.id);
  boton.setAttribute('aria-label', `Eliminar ${evaluacion.nombre}`);
  td.append(boton);
  return td;
}
