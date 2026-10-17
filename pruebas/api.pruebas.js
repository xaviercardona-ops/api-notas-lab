// PRUEBAS DE LA API v1 (PARTE 2)
//
// Verifican el CONTRATO: lo que ve cualquier cliente que le hable a tu servidor por HTTP. Cada prueba
// levanta su propio servidor limpio. Los nombres de las pruebas dicen qué se espera; los mensajes de
// fallo, qué llegó en su lugar.
//
//   npm run test:api

import { conServidor, esProblema, SEMILLA } from './ayudas.mjs';
import { cercaDe, grupo, igual, igualJSON, prueba, verdadero } from './mini.js';

const SUITE = 'api';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE });
const NUEVA = { nombre: 'Final', peso: 30 };

// ---------------------------------------------------------------------------------------------
g('2A · Leer (GET)', () => {
  prueba('GET /v1/evaluaciones responde 200 con un arreglo JSON', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v1/evaluaciones');
      igual(r.status, 200, 'GET /v1/evaluaciones debe responder 200 OK');
      verdadero(r.tipo.startsWith('application/json'), `Content-Type debe ser application/json (llegó "${r.tipo}")`);
      verdadero(Array.isArray(r.json), 'el cuerpo de la lista debe ser un arreglo JSON');
      igual(r.json.length, 2, 'deben venir las 2 evaluaciones de la semilla');
    }, { datos: SEMILLA }));

  prueba('cada evaluación se ve como { id, nombre, peso, nota } y nada más', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v1/evaluaciones');
      igualJSON(r.json[0], { id: 1, nombre: 'Parcial 1', peso: 30, nota: 4 });
      igualJSON(r.json[1], { id: 2, nombre: 'Taller', peso: 20, nota: null });
    }, { datos: SEMILLA }));

  prueba('GET /v1/evaluaciones/{id} responde 200 con esa evaluación', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v1/evaluaciones/2');
      igual(r.status, 200, 'GET de una evaluación que existe debe responder 200');
      igualJSON(r.json, { id: 2, nombre: 'Taller', peso: 20, nota: null });
    }, { datos: SEMILLA }));

  prueba('GET de una evaluación que no existe responde 404 con un problema legible', () =>
    conServidor(async (llamar) => {
      igual((await llamar('GET', '/v1/evaluaciones/1')).status, 200, 'primero implementa GET /v1/evaluaciones/{id} para una evaluación que sí existe');
      esProblema(await llamar('GET', '/v1/evaluaciones/99'), 404, 'GET /v1/evaluaciones/99');
    }, { datos: SEMILLA }));

  prueba('un id que no es un número positivo (abc, 0, 1e0, -1) tampoco identifica a nadie: 404', () =>
    conServidor(async (llamar) => {
      igual((await llamar('GET', '/v1/evaluaciones/1')).status, 200, 'primero implementa GET /v1/evaluaciones/{id} para una evaluación que sí existe');
      for (const id of ['abc', '0', '1e0', '-1', '01']) {
        esProblema(await llamar('GET', `/v1/evaluaciones/${id}`), 404, `GET /v1/evaluaciones/${id}`);
      }
    }, { datos: SEMILLA }));

  prueba('GET /v1/resumen responde 200 con el resumen calculado por el Modelo', () =>
    conServidor(async (llamar) => {
      const r = await llamar('GET', '/v1/resumen');
      igual(r.status, 200, 'GET /v1/resumen debe responder 200');
      cercaDe(r.json.acumulado, 1.2, 1e-9, 'acumulado');
      igual(r.json.pesoCalificado, 30, 'pesoCalificado');
      igual(r.json.pesoPendiente, 70, 'pesoPendiente');
      igual(r.json.notaNecesaria, 2.58, 'notaNecesaria');
      igual(r.json.estado, 'en-camino', 'estado');
      igual(r.json.notaMinima, 3, 'el resumen trae la nota mínima (la pantalla no copia las reglas)');
      igual(r.json.notaMaxima, 5, 'el resumen trae la nota máxima');
    }, { datos: SEMILLA }));

  prueba('GET es seguro: leer una y otra vez no cambia nada', () =>
    conServidor(async (llamar) => {
      igual((await llamar('GET', '/v1/evaluaciones')).status, 200, 'primero implementa las lecturas');
      const antes = (await llamar('GET', '/v1/evaluaciones')).texto;
      for (let i = 0; i < 3; i += 1) {
        await llamar('GET', '/v1/evaluaciones');
        await llamar('GET', '/v1/evaluaciones/1');
        await llamar('GET', '/v1/resumen');
      }
      igual((await llamar('GET', '/v1/evaluaciones')).texto, antes, 'las lecturas no deben modificar el estado del servidor');
    }, { datos: SEMILLA }));
});

// ---------------------------------------------------------------------------------------------
g('2B · Crear (POST)', () => {
  prueba('POST válido responde 201 Created con la evaluación creada', () =>
    conServidor(async (llamar) => {
      const r = await llamar('POST', '/v1/evaluaciones', { json: NUEVA });
      igual(r.status, 201, 'crear un recurso debe responder 201 Created (no 200)');
      igualJSON(r.json, { id: 3, nombre: 'Final', peso: 30, nota: null });
    }, { datos: SEMILLA }));

  prueba('POST responde con Location: la dirección del recurso recién creado', () =>
    conServidor(async (llamar) => {
      const r = await llamar('POST', '/v1/evaluaciones', { json: NUEVA });
      igual(r.cabeceras.get('location'), '/v1/evaluaciones/3', 'falta la cabecera Location o no apunta a la evaluación nueva');
      const siguiente = await llamar('GET', r.cabeceras.get('location'));
      igual(siguiente.status, 200, 'la dirección de Location debe llevar a la evaluación creada');
      igualJSON(siguiente.json, r.json);
    }, { datos: SEMILLA }));

  prueba('el id lo decide el servidor, aunque el cliente mande uno', () =>
    conServidor(async (llamar) => {
      const r = await llamar('POST', '/v1/evaluaciones', { json: { id: 99, ...NUEVA } });
      igual(r.json.id, 3, 'el cliente no puede elegir el id de un recurso nuevo');
    }, { datos: SEMILLA }));

  prueba('un valor que incumple una regla responde 422 con el mensaje del Modelo', () =>
    conServidor(async (llamar) => {
      const casos = [
        [{ nombre: '', peso: 10 }, 'El nombre es obligatorio.'],
        [{ nombre: 'x'.repeat(41), peso: 10 }, 'El nombre no puede superar 40 caracteres.'],
        [{ nombre: 'A', peso: 0 }, 'El peso debe estar entre 1 y 100.'],
        [{ nombre: 'A', peso: 101 }, 'El peso debe estar entre 1 y 100.'],
        [{ nombre: 'A', peso: '30' }, 'El peso debe estar entre 1 y 100.'],
        [{ nombre: 'A', peso: 10, nota: 6 }, 'La nota debe estar entre 0 y 5.'],
      ];
      for (const [cuerpo, mensaje] of casos) {
        const r = await llamar('POST', '/v1/evaluaciones', { json: cuerpo });
        esProblema(r, 422, `POST ${JSON.stringify(cuerpo)}`);
        igual(r.json.detail, mensaje, 'el detalle debe ser el mensaje que dio el Modelo');
      }
    }, { datos: SEMILLA }));

  prueba('un valor que choca con el ESTADO actual (nombre repetido, pesos que pasan de 100) responde 409', () =>
    conServidor(async (llamar) => {
      const repetido = await llamar('POST', '/v1/evaluaciones', { json: { nombre: 'parcial 1', peso: 10 } });
      esProblema(repetido, 409, 'nombre repetido');
      igual(repetido.json.detail, 'Ya existe una evaluación con ese nombre.');
      const pesado = await llamar('POST', '/v1/evaluaciones', { json: { nombre: 'Enorme', peso: 60 } });
      esProblema(pesado, 409, 'pesos que pasan de 100');
      verdadero(pesado.json.detail.includes('100'), 'el detalle debe explicar el tope de 100 %');
    }, { datos: SEMILLA }));

  prueba('un POST rechazado no cambia nada', () =>
    conServidor(async (llamar) => {
      await llamar('POST', '/v1/evaluaciones', { json: { nombre: '', peso: 10 } });
      await llamar('POST', '/v1/evaluaciones', { json: { nombre: 'Taller', peso: 10 } });
      igual((await llamar('GET', '/v1/evaluaciones')).json.length, 2, 'las solicitudes rechazadas no deben crear nada');
    }, { datos: SEMILLA }));

  prueba('un cuerpo que no se envía como application/json responde 415', () =>
    conServidor(async (llamar) => {
      const r = await llamar('POST', '/v1/evaluaciones', { texto: 'nombre=Final&peso=30', cabeceras: { 'Content-Type': 'text/plain' } });
      esProblema(r, 415, 'POST con text/plain');
    }, { datos: SEMILLA }));

  prueba('un JSON roto, vacío o que no es un objeto responde 400', () =>
    conServidor(async (llamar) => {
      const roto = await llamar('POST', '/v1/evaluaciones', { texto: '{"nombre": "Final", ', cabeceras: { 'Content-Type': 'application/json' } });
      esProblema(roto, 400, 'JSON roto');
      const arreglo = await llamar('POST', '/v1/evaluaciones', { json: [1, 2, 3] });
      esProblema(arreglo, 400, 'un arreglo en vez de un objeto');
      const vacio = await llamar('POST', '/v1/evaluaciones', { texto: '', cabeceras: { 'Content-Type': 'application/json' } });
      esProblema(vacio, 400, 'cuerpo vacío');
    }, { datos: SEMILLA }));
});

// ---------------------------------------------------------------------------------------------
g('2C · Modificar y borrar (PATCH, DELETE)', () => {
  prueba('PATCH { nota } responde 200 con la evaluación actualizada', () =>
    conServidor(async (llamar) => {
      const r = await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 4.5 } });
      igual(r.status, 200, 'PATCH debe responder 200 con la evaluación modificada');
      igualJSON(r.json, { id: 2, nombre: 'Taller', peso: 20, nota: 4.5 });
      igual((await llamar('GET', '/v1/evaluaciones/2')).json.nota, 4.5, 'el cambio debe quedar guardado');
    }, { datos: SEMILLA }));

  prueba('PATCH { nota: null } quita la nota', () =>
    conServidor(async (llamar) => {
      const r = await llamar('PATCH', '/v1/evaluaciones/1', { json: { nota: null } });
      igual(r.status, 200);
      igual(r.json.nota, null);
    }, { datos: SEMILLA }));

  prueba('PATCH es idempotente: repetir la misma orden deja el mismo resultado', () =>
    conServidor(async (llamar) => {
      const primera = await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 3.5 } });
      igual(primera.status, 200, 'primero implementa PATCH para una evaluación que sí existe');
      const segunda = await llamar('PATCH', '/v1/evaluaciones/2', { json: { nota: 3.5 } });
      igual(segunda.status, primera.status);
      igualJSON(segunda.json, primera.json);
    }, { datos: SEMILLA }));

  prueba('PATCH con una nota inválida, o sin nota, responde 422', () =>
    conServidor(async (llamar) => {
      for (const cuerpo of [{ nota: 7 }, { nota: -1 }, { nota: 'cuatro' }, {}]) {
        const r = await llamar('PATCH', '/v1/evaluaciones/2', { json: cuerpo });
        esProblema(r, 422, `PATCH ${JSON.stringify(cuerpo)}`);
        igual(r.json.detail, 'La nota debe estar entre 0 y 5.');
      }
      igual((await llamar('GET', '/v1/evaluaciones/2')).json.nota, null, 'un PATCH rechazado no debe cambiar la nota');
    }, { datos: SEMILLA }));

  prueba('PATCH a una evaluación inexistente responde 404 (aunque el cuerpo también esté mal)', () =>
    conServidor(async (llamar) => {
      igual((await llamar('PATCH', '/v1/evaluaciones/1', { json: { nota: 4 } })).status, 200, 'primero implementa PATCH para una evaluación que sí existe');
      esProblema(await llamar('PATCH', '/v1/evaluaciones/99', { json: { nota: 4 } }), 404, 'PATCH inexistente');
      esProblema(await llamar('PATCH', '/v1/evaluaciones/99', { json: { nota: 99 } }), 404, 'PATCH inexistente con nota inválida');
    }, { datos: SEMILLA }));

  prueba('PATCH con texto plano responde 415 y con JSON roto, 400', () =>
    conServidor(async (llamar) => {
      esProblema(await llamar('PATCH', '/v1/evaluaciones/2', { texto: 'nota=4', cabeceras: { 'Content-Type': 'text/plain' } }), 415, 'text/plain');
      esProblema(await llamar('PATCH', '/v1/evaluaciones/2', { texto: '{"nota": ', cabeceras: { 'Content-Type': 'application/json' } }), 400, 'JSON roto');
    }, { datos: SEMILLA }));

  prueba('DELETE responde 204 No Content, sin cuerpo, y la evaluación desaparece', () =>
    conServidor(async (llamar) => {
      const r = await llamar('DELETE', '/v1/evaluaciones/2');
      igual(r.status, 204, 'borrar con éxito debe responder 204 No Content');
      igual(r.texto, '', 'un 204 no lleva cuerpo');
      esProblema(await llamar('GET', '/v1/evaluaciones/2'), 404, 'GET después de DELETE');
    }, { datos: SEMILLA }));

  prueba('DELETE repetido: la segunda vez es 404, pero el estado del servidor es el mismo (idempotente)', () =>
    conServidor(async (llamar) => {
      igual((await llamar('DELETE', '/v1/evaluaciones/2')).status, 204);
      const antes = (await llamar('GET', '/v1/evaluaciones')).texto;
      esProblema(await llamar('DELETE', '/v1/evaluaciones/2'), 404, 'segundo DELETE');
      igual((await llamar('GET', '/v1/evaluaciones')).texto, antes, 'repetir un DELETE no debe cambiar nada más');
    }, { datos: SEMILLA }));

  prueba('DELETE de una evaluación que nunca existió responde 404', () =>
    conServidor(async (llamar) => {
      igual((await llamar('DELETE', '/v1/evaluaciones/1')).status, 204, 'primero implementa DELETE para una evaluación que sí existe');
      esProblema(await llamar('DELETE', '/v1/evaluaciones/99'), 404, 'DELETE inexistente');
    }, { datos: SEMILLA }));
});

// ---------------------------------------------------------------------------------------------
g('2D · Errores que se pueden leer', () => {
  prueba('una ruta que no existe responde 404 con un problema (no una página en HTML)', () =>
    conServidor(async (llamar) => {
      esProblema(await llamar('GET', '/v1/nada'), 404, 'GET /v1/nada');
      esProblema(await llamar('POST', '/v1/nada', { json: {} }), 404, 'POST /v1/nada');
    }));

  prueba('un método no permitido responde 405 y dice cuáles sí (cabecera Allow)', () =>
    conServidor(async (llamar) => {
      const coleccion = await llamar('PUT', '/v1/evaluaciones', { json: NUEVA });
      esProblema(coleccion, 405, 'PUT /v1/evaluaciones');
      igual(coleccion.cabeceras.get('allow'), 'GET, POST', 'Allow debe listar los métodos permitidos en /v1/evaluaciones');
      const item = await llamar('POST', '/v1/evaluaciones/1', { json: NUEVA });
      esProblema(item, 405, 'POST /v1/evaluaciones/1');
      igual(item.cabeceras.get('allow'), 'DELETE, GET, PATCH', 'Allow debe listar los métodos permitidos en /v1/evaluaciones/{id}');
      igual((await llamar('DELETE', '/v1/resumen')).cabeceras.get('allow'), 'GET');
    }, { datos: SEMILLA }));

  prueba('cada problema identifica su regla con "type" (un identificador estable, no el mensaje)', () =>
    conServidor(async (llamar) => {
      const casos = [
        [await llamar('POST', '/v1/evaluaciones', { json: { nombre: 'A', peso: 0 } }), 'peso-fuera-de-rango'],
        [await llamar('POST', '/v1/evaluaciones', { json: { nombre: 'Taller', peso: 5 } }), 'nombre-duplicado'],
        [await llamar('GET', '/v1/evaluaciones/99'), 'no-existe'],
      ];
      for (const [r, final] of casos) {
        verdadero(r.json.type.endsWith(`/${final}`), `el type de este error debe terminar en "/${final}" (llegó "${r.json.type}")`);
        verdadero(/^https?:\/\//.test(r.json.type), 'el type es un URI');
      }
    }, { datos: SEMILLA }));

  prueba('un error inesperado responde 500 SIN filtrar detalles internos', () => {
    const almacenQueFalla = {
      cargar: () => [],
      guardar() {
        throw new Error('secreto-interno-del-disco /var/datos/notas.json');
      },
    };
    return conServidor(async (llamar) => {
      const r = await llamar('POST', '/v1/evaluaciones', { json: NUEVA });
      esProblema(r, 500, 'POST con un almacén roto');
      verdadero(!r.texto.includes('secreto-interno'), 'el mensaje interno del error no debe llegar al cliente');
      verdadero(!/\bat .*\(.*:\d+:\d+\)/.test(r.texto), 'la traza de la pila no debe llegar al cliente');
    }, { almacen: almacenQueFalla });
  });
});
