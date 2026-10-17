/**
 * MODELO · Notas del semestre                         (el de la clase de MVC, listo para un API)
 *
 * SABE: qué es una evaluación, las reglas (pesos, rangos, nota mínima) y cómo se calcula el resumen.
 * NO SABE: que existe HTTP, ni un navegador, ni un archivo. Tampoco sabe qué es un "404" o un "422":
 *          eso lo decide la API cuando traduce sus errores (servidor/rutas.mjs).
 *
 * Es el mismo Modelo de la clase pasada con solo cuatro cambios, todos pequeños y compatibles hacia atrás:
 *   1. ErrorDeReglas trae un `codigo` estable (la API lo traduce a un estado HTTP; el mensaje no sirve para eso).
 *   2. agregar() y calificar() devuelven una COPIA de la evaluación (la API necesita responder con ella).
 *   3. obtener(id) devuelve una evaluación o lanza NO_EXISTE.
 *   4. calificar() comprueba primero que la evaluación exista (un recurso inexistente es un 404 aunque el
 *      cuerpo de la solicitud también tenga errores).
 */

export const NOTA_MINIMA = 3.0; // para aprobar
export const NOTA_MAXIMA = 5.0;
export const UMBRAL_RIESGO = 4.0; // si necesitas más que esto en lo que falta, estás "en riesgo"
export const MAX_NOMBRE = 40;

const EPS = 1e-9; // tolerancia para comparar decimales

/** Códigos estables de las reglas: la API decide qué estado HTTP corresponde a cada uno. */
export const CODIGOS = Object.freeze({
  NOMBRE_OBLIGATORIO: 'NOMBRE_OBLIGATORIO',
  NOMBRE_LARGO: 'NOMBRE_LARGO',
  PESO_FUERA_DE_RANGO: 'PESO_FUERA_DE_RANGO',
  NOTA_FUERA_DE_RANGO: 'NOTA_FUERA_DE_RANGO',
  PESOS_EXCEDEN_100: 'PESOS_EXCEDEN_100',
  NOMBRE_DUPLICADO: 'NOMBRE_DUPLICADO',
  NO_EXISTE: 'NO_EXISTE',
});

/** Error de negocio: su mensaje se puede mostrar tal cual al usuario; su `codigo` es para las máquinas. */
export class ErrorDeReglas extends Error {
  constructor(mensaje, codigo = 'REGLA') {
    super(mensaje);
    this.name = 'ErrorDeReglas';
    this.codigo = codigo;
  }
}

/** Redondea hacia ARRIBA (la nota que "necesitas" nunca debe quedarse corta). */
const redondearArriba = (valor, decimales = 2) => {
  const f = 10 ** decimales;
  return Math.ceil(valor * f - EPS) / f;
};

export class NotasModelo {
  #almacen;
  #evaluaciones;
  #siguienteId;
  #suscriptores = new Set();

  constructor(almacen) {
    this.#almacen = almacen;
    this.#evaluaciones = almacen.cargar();
    this.#siguienteId = this.#evaluaciones.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  }

  /** Copias: quien las reciba no puede alterar el estado interno sin pasar por las reglas. */
  get evaluaciones() {
    return this.#evaluaciones.map((e) => ({ ...e }));
  }

  /** Cambio 3: una evaluación por id (copia) o ErrorDeReglas NO_EXISTE. */
  obtener(id) {
    return { ...this.#buscar(id) };
  }

  /** Cambio 2: devuelve la evaluación creada (con su id). */
  agregar({ nombre, peso, nota = null }) {
    const limpio = String(nombre ?? '').trim();
    if (limpio === '') throw new ErrorDeReglas('El nombre es obligatorio.', CODIGOS.NOMBRE_OBLIGATORIO);
    if (limpio.length > MAX_NOMBRE) {
      throw new ErrorDeReglas(`El nombre no puede superar ${MAX_NOMBRE} caracteres.`, CODIGOS.NOMBRE_LARGO);
    }
    if (!Number.isFinite(peso) || peso < 1 || peso > 100) {
      throw new ErrorDeReglas('El peso debe estar entre 1 y 100.', CODIGOS.PESO_FUERA_DE_RANGO);
    }
    this.#validarNota(nota);
    const disponible = 100 - this.#pesoRegistrado();
    if (peso > disponible + EPS) {
      throw new ErrorDeReglas(
        `Los pesos no pueden sumar más de 100 % (te quedan ${Math.round(disponible * 100) / 100} %).`,
        CODIGOS.PESOS_EXCEDEN_100,
      );
    }
    if (this.#evaluaciones.some((e) => e.nombre.toLowerCase() === limpio.toLowerCase())) {
      throw new ErrorDeReglas('Ya existe una evaluación con ese nombre.', CODIGOS.NOMBRE_DUPLICADO);
    }

    const nueva = { id: this.#siguienteId++, nombre: limpio, peso, nota };
    this.#evaluaciones.push(nueva);
    this.#cambio();
    return { ...nueva };
  }

  /** Cambios 2 y 4: primero comprueba que exista; devuelve la evaluación ya calificada. */
  calificar(id, nota) {
    const evaluacion = this.#buscar(id);
    this.#validarNota(nota);
    evaluacion.nota = nota;
    this.#cambio();
    return { ...evaluacion };
  }

  eliminar(id) {
    const evaluacion = this.#buscar(id);
    this.#evaluaciones.splice(this.#evaluaciones.indexOf(evaluacion), 1);
    this.#cambio();
  }

  resumen() {
    let acumulado = 0;
    let pesoCalificado = 0;
    for (const e of this.#evaluaciones) {
      if (e.nota !== null) {
        acumulado += (e.peso * e.nota) / 100;
        pesoCalificado += e.peso;
      }
    }
    const pesoPendiente = 100 - pesoCalificado;
    const notaNecesaria =
      pesoPendiente > 0 ? redondearArriba(Math.max(0, (NOTA_MINIMA - acumulado) / (pesoPendiente / 100))) : null;

    let estado;
    if (acumulado + EPS >= NOTA_MINIMA) estado = 'aprobado';
    else if (notaNecesaria === null || notaNecesaria > NOTA_MAXIMA) estado = 'imposible';
    else if (notaNecesaria > UMBRAL_RIESGO) estado = 'en-riesgo';
    else estado = 'en-camino';

    return { acumulado, pesoCalificado, pesoPendiente, notaNecesaria, estado };
  }

  /** Observer: registra una función que se llamará después de CADA cambio. Devuelve cómo cancelarla. */
  suscribir(suscriptor) {
    this.#suscriptores.add(suscriptor);
    return () => this.#suscriptores.delete(suscriptor);
  }

  // ---------- internos ----------

  #cambio() {
    this.#almacen.guardar(this.evaluaciones);
    for (const suscriptor of this.#suscriptores) suscriptor();
  }

  #buscar(id) {
    const evaluacion = this.#evaluaciones.find((e) => e.id === id);
    if (!evaluacion) throw new ErrorDeReglas('No existe la evaluación.', CODIGOS.NO_EXISTE);
    return evaluacion;
  }

  #pesoRegistrado() {
    return this.#evaluaciones.reduce((suma, e) => suma + e.peso, 0);
  }

  #validarNota(nota) {
    if (nota === null) return; // sin calificar todavía
    if (!Number.isFinite(nota) || nota < 0 || nota > NOTA_MAXIMA) {
      throw new ErrorDeReglas('La nota debe estar entre 0 y 5.', CODIGOS.NOTA_FUERA_DE_RANGO);
    }
  }
}
