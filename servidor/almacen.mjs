// ALMACÉN: dónde guarda el SERVIDOR las evaluaciones (ya no está en el navegador).
//
// Es el mismo contrato de la clase pasada: el Modelo solo exige estos dos métodos.
//
//     cargar()              → devuelve la lista de evaluaciones guardadas
//     guardar(evaluaciones) → reemplaza lo guardado por esta lista
//
// El Modelo no cambió: lo que cambió es QUIÉN lo usa (ahora el servidor, no el navegador).

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Guarda en memoria: se pierde al apagar el servidor. Es el que usan las pruebas. */
export class AlmacenMemoria {
  #datos;

  constructor(datosIniciales = []) {
    this.#datos = structuredClone(datosIniciales);
  }

  cargar() {
    return structuredClone(this.#datos);
  }

  guardar(evaluaciones) {
    this.#datos = structuredClone(evaluaciones);
  }
}

/** Guarda en un archivo JSON: sobrevive a reiniciar el servidor (npm start lo usa en datos/notas.json). */
export class AlmacenArchivo {
  #ruta;

  constructor(ruta) {
    this.#ruta = ruta;
  }

  cargar() {
    try {
      const datos = JSON.parse(readFileSync(this.#ruta, 'utf8'));
      return Array.isArray(datos) ? datos : [];
    } catch {
      return []; // el archivo aún no existe o está dañado: se parte de cero
    }
  }

  guardar(evaluaciones) {
    mkdirSync(dirname(this.#ruta), { recursive: true });
    const temporal = `${this.#ruta}.tmp`;
    writeFileSync(temporal, JSON.stringify(evaluaciones, null, 2));
    renameSync(temporal, this.#ruta); // escritura atómica: nunca queda un archivo a medias
  }
}
