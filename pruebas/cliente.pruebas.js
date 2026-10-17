// PRUEBAS DEL CLIENTE MVC (PARTE 3)
//
// 3A: el Modelo remoto habla con la API REAL (el servidor se levanta dentro de la prueba).
// 3B: el Controlador se prueba con "dobles": una Vista y un Modelo falsos, sin navegador. Sirve para
//     comprobar que el Controlador ESPERA al Modelo antes de reaccionar (ahora las órdenes tardan).
//
//   npm run test:cliente

import { request } from 'node:http';
import { ClienteApi } from '../cliente/src/cliente-api.js';
import { NotasControlador } from '../cliente/src/controlador.js';
import { ErrorDeReglas, ErrorDeServicio, NotasModeloRemoto } from '../cliente/src/modelo-remoto.js';
import { conServidor, SEMILLA } from './ayudas.mjs';
import { cercaDe, grupo, igual, igualJSON, prueba, rechazaCon, verdadero } from './mini.js';

const SUITE = 'cliente';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE });

/** Levanta el servidor, crea un Modelo remoto ya sincronizado y se lo pasa a la prueba. */
const conModelo = (cuerpo, opciones = { datos: SEMILLA }) =>
  conServidor(async (llamar, base) => {
    const modelo = new NotasModeloRemoto(new ClienteApi({ base, avisar: () => {} }));
    await modelo.sincronizar();
    return cuerpo(modelo, llamar, base);
  }, opciones);

// ---------------------------------------------------------------------------------------------
g('3A · El Modelo remoto habla con la API', () => {
  prueba('el servidor entrega la pantalla y sus módulos (GET / y GET /src/main.js)', () =>
    conServidor(async (llamar) => {
      const pagina = await llamar('GET', '/');
      igual(pagina.status, 200, 'GET / debe entregar cliente/index.html');
      verdadero(pagina.tipo.startsWith('text/html'), `la página es text/html (llegó "${pagina.tipo}")`);
      const modulo = await llamar('GET', '/src/main.js');
      igual(modulo.status, 200, 'GET /src/main.js debe entregar el módulo');
      verdadero(modulo.tipo.startsWith('text/javascript'), `los módulos son text/javascript (llegó "${modulo.tipo}")`);
    }));

  prueba('no deja salir de la carpeta del navegador (nada de /../servidor/modelo.js)', () =>
    conServidor(async (_llamar, base) => {
      const { port } = new URL(base);
      // fetch() normalizaría los ".."; con http.request viaja tal cual
      const estado = await new Promise((resolver, rechazar) => {
        const solicitud = request({ host: '127.0.0.1', port, path: '/../servidor/modelo.js', method: 'GET' }, (res) => {
          res.resume();
          resolver(res.statusCode);
        });
        solicitud.on('error', rechazar);
        solicitud.end();
      });
      igual(estado, 404, 'una dirección con ".." no puede leer archivos fuera de cliente/');
    }));

  prueba('sincronizar() trae la lista y el resumen del servidor', () =>
    conModelo(async (modelo) => {
      igual(modelo.evaluaciones.length, 2, 'la lista debe traer las 2 evaluaciones del servidor');
      igual(modelo.evaluaciones[0].nombre, 'Parcial 1');
      igual(modelo.resumen().estado, 'en-camino', 'el resumen viene del servidor');
      igual(modelo.resumen().notaMaxima, 5, 'el resumen trae las reglas que la pantalla necesita');
    }));

  prueba('agregar() manda la orden al servidor y el Modelo se actualiza', () =>
    conModelo(async (modelo, llamar) => {
      await modelo.agregar({ nombre: 'Final', peso: 30, nota: null });
      igual(modelo.evaluaciones.length, 3);
      igual(modelo.evaluaciones.at(-1).nombre, 'Final');
      igual((await llamar('GET', '/v1/evaluaciones')).json.length, 3, 'el servidor debe tener la evaluación nueva');
    }));

  prueba('avisa a sus suscriptores después de cada cambio (Observer, como en la clase pasada)', () =>
    conModelo(async (modelo) => {
      let avisos = 0;
      const cancelar = modelo.suscribir(() => (avisos += 1));
      await modelo.agregar({ nombre: 'Final', peso: 30 });
      await modelo.calificar(1, 5);
      await modelo.eliminar(2);
      igual(avisos, 3, 'un aviso por cada cambio aceptado');
      cancelar();
      await modelo.eliminar(1);
      igual(avisos, 3, 'después de cancelar la suscripción ya no avisa');
    }));

  prueba('calificar() cambia la nota y el resumen se recalcula en el servidor', () =>
    conModelo(async (modelo) => {
      await modelo.calificar(2, 5);
      igual(modelo.evaluaciones[1].nota, 5);
      cercaDe(modelo.resumen().acumulado, 0.3 * 4 + 0.2 * 5);
    }));

  prueba('eliminar() quita la evaluación', () =>
    conModelo(async (modelo) => {
      await modelo.eliminar(1);
      igualJSON(modelo.evaluaciones.map((e) => e.id), [2]);
    }));

  prueba('una regla rota (422) llega como ErrorDeReglas con el mensaje del servidor', () =>
    conModelo(async (modelo) => {
      await rechazaCon(modelo.agregar({ nombre: '', peso: 10 }), 'ErrorDeReglas', 'El nombre es obligatorio.');
      await rechazaCon(modelo.calificar(1, 9), 'ErrorDeReglas', 'La nota debe estar entre 0 y 5.');
      igual(modelo.evaluaciones.length, 2, 'una orden rechazada no cambia el Modelo');
    }));

  prueba('un conflicto con el estado (409) también llega como ErrorDeReglas', () =>
    conModelo(async (modelo) => {
      const error = await rechazaCon(modelo.agregar({ nombre: 'taller', peso: 5 }), 'ErrorDeReglas');
      verdadero(error instanceof ErrorDeReglas, 'debe ser una instancia de ErrorDeReglas');
      igual(error.message, 'Ya existe una evaluación con ese nombre.');
    }));

  prueba('si la evaluación ya no existe (404), avisa y la pantalla se pone al día', () =>
    conModelo(async (modelo, llamar) => {
      await llamar('DELETE', '/v1/evaluaciones/1'); // alguien la borró desde otro aparato
      igual(modelo.evaluaciones.length, 2, 'este Modelo todavía no se enteró');
      await rechazaCon(modelo.calificar(1, 4), 'ErrorDeReglas', 'No existe la evaluación.');
      igual(modelo.evaluaciones.length, 1, 'después del 404 el Modelo se sincroniza solo');
    }));

  prueba('si el servidor no responde, lanza ErrorDeServicio (no es culpa del usuario)', async () => {
    let direccion;
    await conServidor(async (_llamar, base) => {
      direccion = base;
    });
    // el servidor ya se apagó: esa dirección ya no contesta
    const modelo = new NotasModeloRemoto(new ClienteApi({ base: direccion, avisar: () => {} }));
    const error = await rechazaCon(modelo.sincronizar(), 'ErrorDeServicio');
    verdadero(error instanceof ErrorDeServicio);
  });

  prueba('evaluaciones y resumen() devuelven copias: no se puede alterar el Modelo desde afuera', () =>
    conModelo(async (modelo) => {
      modelo.evaluaciones[0].nombre = 'HACKEADO';
      modelo.evaluaciones.pop();
      modelo.resumen().estado = 'aprobado';
      igual(modelo.evaluaciones.length, 2);
      igual(modelo.evaluaciones[0].nombre, 'Parcial 1');
      igual(modelo.resumen().estado, 'en-camino');
    }));

  prueba('el Modelo remoto NO valida reglas: manda todo al servidor, que es el dueño de las reglas', async () => {
    const llamadas = [];
    const apiFalsa = {
      solicitar: async (metodo, recurso, cuerpo) => {
        llamadas.push({ metodo, recurso, cuerpo });
        return { status: 201, cuerpo: {} };
      },
      listarEvaluaciones: async () => [],
      obtenerResumen: async () => ({ acumulado: 0, estado: 'en-camino', notaMinima: 3, notaMaxima: 5 }),
    };
    const modelo = new NotasModeloRemoto(apiFalsa);
    await modelo.agregar({ nombre: 'Peso imposible', peso: 500, nota: null });
    igual(llamadas.length, 1, 'la orden debe llegar al servidor aunque el peso sea absurdo');
    igual(llamadas[0].metodo, 'POST');
    igual(llamadas[0].recurso, '/evaluaciones');
    igualJSON(llamadas[0].cuerpo, { nombre: 'Peso imposible', peso: 500, nota: null });
  });

  prueba('calificar() usa PATCH y eliminar() usa DELETE sobre la evaluación indicada', async () => {
    const llamadas = [];
    const apiFalsa = {
      solicitar: async (metodo, recurso, cuerpo) => {
        llamadas.push([metodo, recurso, cuerpo]);
        return { status: 200, cuerpo: {} };
      },
      listarEvaluaciones: async () => [],
      obtenerResumen: async () => ({}),
    };
    const modelo = new NotasModeloRemoto(apiFalsa);
    await modelo.calificar(7, 4.5);
    await modelo.eliminar(7);
    igualJSON(llamadas, [
      ['PATCH', '/evaluaciones/7', { nota: 4.5 }],
      ['DELETE', '/evaluaciones/7', undefined],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Dobles de prueba: una Vista y un Modelo falsos, sin navegador ni red.

function vistaFalsa() {
  const manejadores = {};
  const registro = { errores: [], limpiezas: 0, formularioLimpio: 0, renders: 0 };
  return {
    manejadores,
    registro,
    alAgregar: (fn) => (manejadores.agregar = fn),
    alEliminar: (fn) => (manejadores.eliminar = fn),
    alCalificar: (fn) => (manejadores.calificar = fn),
    mostrarError: (mensaje) => registro.errores.push(mensaje),
    limpiarError: () => (registro.limpiezas += 1),
    limpiarFormulario: () => (registro.formularioLimpio += 1),
    render: () => (registro.renders += 1),
  };
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

g('3B · El Controlador espera al Modelo', () => {
  prueba('al agregar, convierte el texto del formulario y espera al Modelo antes de limpiarlo', async () => {
    const vista = vistaFalsa();
    const recibidas = [];
    const modelo = {
      agregar: async (datos) => {
        recibidas.push(datos);
        await esperar(20); // la red tarda
      },
    };
    new NotasControlador(modelo, vista);
    const pendiente = vista.manejadores.agregar({ nombre: 'Final', peso: '30', nota: '' });
    igual(vista.registro.formularioLimpio, 0, 'el formulario no debe limpiarse hasta que el servidor responda');
    await pendiente;
    igualJSON(recibidas, [{ nombre: 'Final', peso: 30, nota: null }]);
    igual(vista.registro.formularioLimpio, 1, 'ya respondió: ahora sí se limpia');
    igual(vista.registro.limpiezas, 1, 'y se borra el error anterior');
  });

  prueba('si el Modelo rechaza con ErrorDeReglas, muestra el mensaje y NO limpia el formulario', async () => {
    const vista = vistaFalsa();
    const modelo = { agregar: async () => Promise.reject(new ErrorDeReglas('El peso debe estar entre 1 y 100.')) };
    new NotasControlador(modelo, vista);
    await vista.manejadores.agregar({ nombre: 'Final', peso: '500', nota: '' });
    igualJSON(vista.registro.errores, ['El peso debe estar entre 1 y 100.']);
    igual(vista.registro.formularioLimpio, 0, 'lo que el usuario escribió se conserva para que lo corrija');
    verdadero(vista.registro.renders >= 1, 'la Vista se redibuja para deshacer lo que el servidor no aceptó');
  });

  prueba('si falla el servicio (sin red, 500), muestra un mensaje general en vez de reventar', async () => {
    const vista = vistaFalsa();
    const modelo = { eliminar: async () => Promise.reject(new ErrorDeServicio('No hay conexión con el servidor.')) };
    new NotasControlador(modelo, vista);
    await vista.manejadores.eliminar(3);
    igual(vista.registro.errores.length, 1, 'el usuario debe ver un aviso');
    verdadero(vista.registro.errores[0].length > 10, 'el aviso debe ser un mensaje comprensible');
  });

  prueba('un error inesperado no se esconde: la promesa se rechaza', async () => {
    const vista = vistaFalsa();
    const modelo = { calificar: async () => Promise.reject(new TypeError('bug de programación')) };
    new NotasControlador(modelo, vista);
    await rechazaCon(vista.manejadores.calificar(1, '4'), 'TypeError', 'bug de programación');
  });

  prueba('calificar convierte "" en null y el texto en número, y espera la respuesta', async () => {
    const vista = vistaFalsa();
    const ordenes = [];
    const modelo = {
      calificar: async (id, nota) => {
        await esperar(5);
        ordenes.push([id, nota]);
      },
    };
    new NotasControlador(modelo, vista);
    await vista.manejadores.calificar(2, '4.5');
    await vista.manejadores.calificar(2, '');
    igualJSON(ordenes, [[2, 4.5], [2, null]]);
    igual(vista.registro.limpiezas, 2);
  });
});
