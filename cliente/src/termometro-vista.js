/**
 * SEGUNDA VISTA · Termómetro de aprobación
 *
 * Otra forma de mostrar el MISMO Modelo. En la clase pasada importaba NOTA_MINIMA y NOTA_MAXIMA del Modelo;
 * ahora el Modelo vive en el servidor y el navegador NO copia sus reglas: la nota mínima y la máxima llegan
 * dentro del resumen (GET /v1/resumen), así que si el negocio las cambia, esta vista no se entera ni se rompe.
 */

export class TermometroVista {
  #modelo;
  #relleno;
  #linea;
  #leyenda;

  constructor(raiz, modelo) {
    this.#modelo = modelo;

    const barra = document.createElement('div');
    barra.className = 'termometro';
    this.#relleno = document.createElement('div');
    this.#relleno.className = 'relleno';
    this.#linea = document.createElement('div');
    this.#linea.className = 'linea';
    this.#linea.title = 'Nota mínima para aprobar';
    barra.append(this.#relleno, this.#linea);

    this.#leyenda = document.createElement('p');
    this.#leyenda.className = 'leyenda';

    raiz.replaceChildren(barra, this.#leyenda);
    modelo.suscribir(() => this.render());
    this.render();
  }

  render() {
    const { acumulado, notaMinima, notaMaxima } = this.#modelo.resumen();
    this.#relleno.style.width = `${Math.min(100, (acumulado / notaMaxima) * 100)}%`;
    this.#linea.style.left = `${(notaMinima / notaMaxima) * 100}%`;
    this.#leyenda.textContent = `${acumulado.toFixed(2)} de ${notaMaxima.toFixed(1)} · la línea marca el mínimo para aprobar (${notaMinima.toFixed(1)})`;
  }
}
