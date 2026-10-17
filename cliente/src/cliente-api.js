/**
 * CLIENTE DE LA API · el ÚNICO archivo del navegador que sabe que existe HTTP        (ya escrito)
 *
 * Esconde los detalles del cable: la dirección base, la versión (/v1, /v2), los encabezados, el JSON y
 * los errores en formato problem+json. Quien lo use pide cosas ("POST /evaluaciones") y recibe datos
 * o una excepción; no escribe `fetch` ni lee códigos de estado a mano.
 *
 * Si la API cambia de dirección o de versión, este es el lugar donde se nota. La Vista y el Controlador
 * ni se enteran (una prueba de arquitectura lo vigila).
 */

/** La API respondió, pero con un estado de error (4xx o 5xx). Trae el documento de problema (RFC 9457). */
export class ErrorApi extends Error {
  constructor(status, problema) {
    super(problema?.detail ?? `La API respondió ${status}.`);
    this.name = 'ErrorApi';
    this.status = status;
    this.problema = problema ?? null;
  }
}

/** Ni siquiera hubo respuesta: servidor apagado, sin red, tiempo agotado… */
export class ErrorDeRed extends Error {
  constructor(causa) {
    super('No se pudo conectar con el servidor.');
    this.name = 'ErrorDeRed';
    this.cause = causa;
  }
}

export class ClienteApi {
  #base;
  #version;
  #fetch;
  #avisar;
  #avisadas = new Set();

  /**
   * base     "" en el navegador (mismo origen); "http://127.0.0.1:3000" desde las pruebas de Node.
   * version  "v1" o "v2": cuál versión de la API se usa.
   */
  constructor({ base = '', version = 'v1', fetchFn = (...args) => fetch(...args), avisar = (...args) => console.warn(...args) } = {}) {
    this.#base = base;
    this.#version = version;
    this.#fetch = fetchFn;
    this.#avisar = avisar;
  }

  get version() {
    return this.#version;
  }

  /**
   * Una solicitud a la API. `recurso` va SIN la versión: "/evaluaciones/3".
   * Devuelve { status, cuerpo, cabeceras } si salió bien; lanza ErrorApi (4xx/5xx) o ErrorDeRed.
   */
  async solicitar(metodo, recurso, cuerpo) {
    const url = `${this.#base}/${this.#version}${recurso}`;
    const cabeceras = { Accept: 'application/json, application/problem+json' };
    const opciones = { method: metodo, headers: cabeceras };
    if (cuerpo !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }

    let respuesta;
    try {
      respuesta = await this.#fetch(url, opciones);
    } catch (causa) {
      throw new ErrorDeRed(causa);
    }

    this.#avisarSiEsObsoleta(metodo, `/${this.#version}${recurso}`, respuesta.headers);

    const texto = await respuesta.text();
    let datos;
    if (texto !== '') {
      try {
        datos = JSON.parse(texto);
      } catch {
        throw new ErrorApi(respuesta.status, { title: 'Respuesta no válida', detail: 'El servidor respondió algo que no es JSON.' });
      }
    }
    if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos);
    return { status: respuesta.status, cuerpo: datos, cabeceras: respuesta.headers };
  }

  /** La lista completa de evaluaciones, sin importar cómo la entregue cada versión. */
  async listarEvaluaciones() {
    if (this.#version === 'v1') return (await this.solicitar('GET', '/evaluaciones')).cuerpo; // v1: un arreglo
    return (await this.solicitar('GET', '/evaluaciones?porPagina=50')).cuerpo.datos; // v2: una página (máximo 50)
  }

  async obtenerResumen() {
    return (await this.solicitar('GET', '/resumen')).cuerpo;
  }

  /** Si la API avisa que lo que usamos está obsoleta (RFC 9745 + RFC 8594), lo decimos UNA vez por recurso. */
  #avisarSiEsObsoleta(metodo, recurso, cabeceras) {
    if (!cabeceras.has('deprecation')) return;
    const clave = `${metodo} ${recurso}`;
    if (this.#avisadas.has(clave)) return;
    this.#avisadas.add(clave);
    const retiro = cabeceras.get('sunset');
    const sucesora = /<([^>]+)>\s*;\s*rel="successor-version"/.exec(cabeceras.get('link') ?? '')?.[1];
    this.#avisar(
      `API obsoleta: ${clave}` + (retiro ? ` · se retira el ${retiro}` : '') + (sucesora ? ` · usa ${sucesora}` : ''),
    );
  }
}
