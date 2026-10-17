// PRUEBAS DE ARQUITECTURA
//
// Verifican que cada pieza cumple SU papel, ahora a los DOS lados del cable: el Modelo no sabe de HTTP,
// las rutas no tienen reglas de negocio, las URI son sustantivos, la Vista y el Controlador del navegador
// no conocen la red y solo cliente-api.js habla HTTP. En la industria se llaman "fitness functions"
// (funciones de aptitud): reglas de arquitectura que una máquina revisa por ti.
//
//   npm run arquitectura
//
// Son revisiones sencillas sobre el texto del código (sin comentarios). Sirven de guía, no de juez:
// una arquitectura sana no se demuestra solo con que estas pruebas pasen.

import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AlmacenMemoria } from '../servidor/almacen.mjs';
import { NotasModelo } from '../servidor/modelo.js';
import { crearRutas } from '../servidor/rutas.mjs';
import { grupo, leerFuente, prueba, verdadero } from './mini.js';

const SUITE = 'arquitectura';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE });

/** Quita comentarios para no tropezar con palabras que solo aparecen explicando. */
const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

async function fuente(ruta) {
  const texto = await leerFuente(ruta);
  verdadero(texto !== null, `No encuentro ${ruta}`);
  return sinComentarios(texto);
}

/** Falla si el código contiene alguno de los patrones prohibidos. */
function sinPatrones(codigo, ruta, patrones) {
  for (const [patron, explicacion] of patrones) verdadero(!patron.test(codigo), `${ruta} no debería contener ${explicacion}`);
}

/** Falla si el código NO contiene el patrón esperado. */
function conPatron(codigo, ruta, patron, explicacion) {
  verdadero(patron.test(codigo), `${ruta} debería ${explicacion}`);
}

/** Los archivos .js de cliente/src (sin comentarios), como [ruta, código]. */
async function archivosDelCliente() {
  const carpeta = fileURLToPath(new URL('../cliente/src/', import.meta.url));
  const nombres = (await readdir(carpeta)).filter((n) => n.endsWith('.js')).sort();
  return Promise.all(nombres.map(async (n) => [`cliente/src/${n}`, await fuente(`cliente/src/${n}`)]));
}

const SIN_PENDIENTES = [[/throw\s+new\s+Error\(\s*['"`]TODO/, 'métodos sin implementar (throw new Error("TODO ..."))']];
const SIN_DOM = [
  [/\bdocument\b/, 'document (el DOM es de la Vista)'],
  [/\bwindow\b/, 'window (el navegador es de la Vista)'],
  [/\b(querySelector(All)?|getElementById|getElementsBy\w+|innerHTML|textContent|classList|addEventListener|createElement)\b/, 'manipulación del DOM'],
  [/\b(alert|confirm|prompt)\s*\(/, 'alert/confirm/prompt (mostrar cosas es de la Vista)'],
];
const SIN_RED = [
  [/\bfetch\b/, 'fetch (la red es de cliente-api.js)'],
  [/\b(XMLHttpRequest|WebSocket|EventSource)\b/, 'XMLHttpRequest, WebSocket o EventSource'],
  [/['"`]\/?v\d+\//, 'una dirección de la API ("/v1/...", "/v2/..."): eso es de cliente-api.js'],
  [/\.status\b/, 'códigos de estado HTTP (.status): eso es de cliente-api.js y del Modelo remoto'],
];
const SIN_REGLAS = [
  [/[<>]=?\s*100(?![\w.])/, 'el tope de 100 % escrito a mano: esa regla es del Modelo del servidor'],
  [/[<>]=?\s*3(\.0)?(?![\w.])/, 'la nota mínima escrita a mano (>= 3): esa regla es del Modelo del servidor'],
  [/[<>]=?\s*4(\.0)?(?![\w.])/, 'el umbral de riesgo escrito a mano (> 4): esa regla es del Modelo del servidor'],
  [/\b(NOTA_MINIMA|NOTA_MAXIMA|UMBRAL_RIESGO|MAX_NOMBRE)\b/, 'las constantes del negocio (viven en el servidor)'],
  [/\.length\s*[<>]=?\s*40\b/, 'el largo máximo del nombre escrito a mano'],
];

// ---------------------------------------------------------------------------------------------
g('El Modelo no sabe de HTTP', () => {
  prueba('servidor/modelo.js no usa HTTP, red, archivos ni imports', async () => {
    sinPatrones(await fuente('servidor/modelo.js'), 'modelo.js', [
      [/\b(http|https|fetch|XMLHttpRequest|statusCode|Request|Response)\b/, 'HTTP o red (el Modelo no sabe cómo le llegan las órdenes)'],
      [/\b(process|require)\b|^\s*import\b|\bnode:/m, 'imports, process o módulos de Node (debe poder correr en cualquier parte)'],
    ]);
  });

  prueba('servidor/modelo.js no conoce los números de los estados HTTP (404, 409, 422…)', async () => {
    sinPatrones(await fuente('servidor/modelo.js'), 'modelo.js', [
      [/\b(200|201|204|400|404|405|409|412|415|422|500)\b/, 'códigos de estado HTTP: traducirlos es trabajo de la API (rutas.mjs)'],
    ]);
  });

  prueba('servidor/modelo.js no usa el DOM ni el navegador', async () => {
    sinPatrones(await fuente('servidor/modelo.js'), 'modelo.js', SIN_DOM);
  });
});

// ---------------------------------------------------------------------------------------------
g('Las rutas son el Controlador de la API', () => {
  prueba('servidor/rutas.mjs no contiene reglas de negocio (esas son del Modelo)', async () => {
    sinPatrones(await fuente('servidor/rutas.mjs'), 'rutas.mjs', [
      ...SIN_REGLAS,
      [/\.trim\(\)\s*(===?|!==?)\s*['"]{2}/, 'validar que el nombre no esté vacío'],
      [/Number\.isFinite\(\s*(peso|nota)/, 'validar el peso o la nota'],
    ]);
  });

  prueba('servidor/rutas.mjs trabaja con solicitud y respuesta, no con req/res de Node', async () => {
    sinPatrones(await fuente('servidor/rutas.mjs'), 'rutas.mjs', [
      [/\b(req|res)\./, 'req. o res. (eso es del núcleo HTTP)'],
      [/node:http/, 'node:http'],
    ]);
  });

  prueba('servidor/rutas.mjs recibe el Modelo: no lo crea ni crea almacenes', async () => {
    sinPatrones(await fuente('servidor/rutas.mjs'), 'rutas.mjs', [
      [/new\s+(NotasModelo|Almacen\w*)\s*\(/, 'crear el Modelo o un almacén (eso es de aplicacion.mjs)'],
    ]);
  });

  prueba('servidor/rutas.mjs delega en el Modelo: agregar, calificar, eliminar, obtener y resumen', async () => {
    const codigo = await fuente('servidor/rutas.mjs');
    for (const orden of ['agregar', 'calificar', 'eliminar', 'obtener', 'resumen', 'evaluaciones']) {
      conPatron(codigo, 'rutas.mjs', new RegExp(`modelo\\.${orden}\\b`), `usar modelo.${orden}`);
    }
  });

  prueba('servidor/rutas.mjs no responde "200 OK" con el error adentro ({ ok: false })', async () => {
    sinPatrones(await fuente('servidor/rutas.mjs'), 'rutas.mjs', [
      [/\bok\s*:\s*(true|false)\b/, '{ ok: true/false }: el éxito o el fracaso lo dice el estado HTTP'],
      [/\b(success|exito|éxito)\s*:/i, 'una bandera de éxito en el cuerpo: eso lo dice el estado HTTP'],
      [/\berror\s*:\s*true\b/, '{ error: true }: usa el estado HTTP y un documento de problema'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
const VERBOS = [
  'crear', 'obtener', 'listar', 'buscar', 'borrar', 'eliminar', 'agregar', 'calificar', 'actualizar', 'modificar', 'guardar',
  'get', 'set', 'add', 'delete', 'remove', 'create', 'update', 'list', 'find', 'save', 'edit',
];

g('Las URI nombran recursos', () => {
  const rutasReales = () => {
    const rutas = crearRutas(new NotasModelo(new AlmacenMemoria()));
    verdadero(rutas.length >= 6, `Primero registra las rutas en crearRutas (TODO 2D): ahora hay ${rutas.length}`);
    return rutas;
  };

  prueba('cada URI es /vN/sustantivo[/{id}]: en minúsculas, sin extensión ni barra final', () => {
    for (const { ruta } of rutasReales()) {
      verdadero(/^\/v\d+(\/[a-z]+(-[a-z]+)*)+(\/\{id\})?$/.test(ruta), `La URI "${ruta}" no sigue el formato /vN/recurso[/{id}] en minúsculas (con guiones si hay varias palabras)`);
    }
  });

  prueba('ninguna URI contiene un verbo: la acción la pone el método HTTP', () => {
    for (const { ruta } of rutasReales()) {
      for (const palabra of ruta.split(/[/-]/)) {
        verdadero(!VERBOS.includes(palabra), `La URI "${ruta}" contiene el verbo "${palabra}": en REST la URI nombra el recurso y el método HTTP es la acción`);
      }
    }
  });

  prueba('las colecciones están en plural y los recursos individuales cuelgan de ellas con {id}', () => {
    const colecciones = rutasReales().map((r) => r.ruta.split('/')[2]);
    for (const nombre of colecciones) {
      verdadero(/s$/.test(nombre) || nombre === 'resumen', `"${nombre}" debería ser un sustantivo en plural (evaluaciones)`);
    }
  });

  prueba('solo se usan métodos HTTP con significado: GET, POST, PUT, PATCH y DELETE', () => {
    for (const { metodo, ruta } of rutasReales()) {
      verdadero(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo), `${metodo} ${ruta}: método no esperado`);
    }
  });
});

// ---------------------------------------------------------------------------------------------
g('La Vista y el Controlador del navegador respetan las capas', () => {
  prueba('ninguna vista conoce la red, es asíncrona ni cambia el Modelo', async () => {
    for (const ruta of ['cliente/src/vista.js', 'cliente/src/termometro-vista.js']) {
      sinPatrones(await fuente(ruta), ruta, [
        ...SIN_RED,
        [/\b(async|await|Promise)\b|\.then\s*\(/, 'código asíncrono: la Vista no sabe que el Modelo ahora es remoto'],
        [/\.(agregar|calificar|eliminar|sincronizar)\s*\(/, 'órdenes al Modelo (eso lo hace el Controlador)'],
      ]);
    }
  });

  prueba('ninguna vista decide reglas ni guarda datos', async () => {
    for (const ruta of ['cliente/src/vista.js', 'cliente/src/termometro-vista.js']) {
      sinPatrones(await fuente(ruta), ruta, [...SIN_REGLAS, [/\b(localStorage|sessionStorage|indexedDB)\b/, 'almacenamiento del navegador']]);
    }
  });

  prueba('controlador.js no toca el DOM, ni la red, ni decide reglas', async () => {
    sinPatrones(await fuente('cliente/src/controlador.js'), 'controlador.js', [...SIN_DOM, ...SIN_RED, ...SIN_REGLAS]);
  });

  prueba('controlador.js espera las órdenes del Modelo (async/await)', async () => {
    const codigo = await fuente('cliente/src/controlador.js');
    conPatron(codigo, 'controlador.js', /\basync\b/, 'declarar métodos async');
    conPatron(codigo, 'controlador.js', /\bawait\b/, 'esperar (await) la respuesta del Modelo');
  });

  prueba('controlador.js distingue ErrorDeReglas (culpa del usuario) de ErrorDeServicio (falla del cable)', async () => {
    const codigo = await fuente('cliente/src/controlador.js');
    conPatron(codigo, 'controlador.js', /instanceof\s+ErrorDeReglas/, 'distinguir ErrorDeReglas (error instanceof ErrorDeReglas)');
    conPatron(codigo, 'controlador.js', /instanceof\s+ErrorDeServicio/, 'distinguir ErrorDeServicio (error instanceof ErrorDeServicio)');
    conPatron(codigo, 'controlador.js', /\.mostrarError\s*\(/, 'pedirle a la Vista que muestre el error (mostrarError)');
  });
});

// ---------------------------------------------------------------------------------------------
g('Solo un archivo habla HTTP, y el navegador no tiene reglas', () => {
  prueba('solo cliente-api.js usa fetch', async () => {
    for (const [ruta, codigo] of await archivosDelCliente()) {
      if (ruta.endsWith('cliente-api.js')) conPatron(codigo, ruta, /\bfetch\b/, 'usar fetch (es el único que habla HTTP)');
      else sinPatrones(codigo, ruta, [[/\bfetch\b/, 'fetch: la red es de cliente-api.js']]);
    }
  });

  prueba('modelo-remoto.js no tiene reglas de negocio: el servidor es su único dueño', async () => {
    sinPatrones(await fuente('cliente/src/modelo-remoto.js'), 'modelo-remoto.js', SIN_REGLAS);
  });

  prueba('el navegador no importa nada del servidor ni guarda datos por su cuenta', async () => {
    for (const [ruta, codigo] of await archivosDelCliente()) {
      sinPatrones(codigo, ruta, [
        [/from\s+['"][^'"]*\bservidor\b/, 'imports del servidor: el único acoplamiento entre los dos lados es el contrato HTTP'],
        [/from\s+['"]\.\/modelo\.js['"]/, 'el Modelo de dominio (ya no vive en el navegador)'],
        [/\b(localStorage|sessionStorage|indexedDB)\b/, 'almacenamiento del navegador: el servidor es el dueño de los datos'],
      ]);
    }
  });

  prueba('main.js conecta el Modelo remoto, las Vistas y el Controlador', async () => {
    const codigo = await fuente('cliente/src/main.js');
    conPatron(codigo, 'main.js', /new\s+ClienteApi\s*\(/, 'crear el ClienteApi');
    conPatron(codigo, 'main.js', /new\s+NotasModeloRemoto\s*\(/, 'crear el Modelo remoto');
    conPatron(codigo, 'main.js', /new\s+NotasVista\s*\(/, 'crear la Vista');
    conPatron(codigo, 'main.js', /new\s+NotasControlador\s*\(/, 'crear el Controlador');
  });
});

// ---------------------------------------------------------------------------------------------
g('Sin pendientes', () => {
  prueba('ningún archivo que debías completar conserva un TODO sin resolver', async () => {
    for (const ruta of ['servidor/rutas.mjs', 'servidor/openapi.mjs', 'cliente/src/modelo-remoto.js', 'cliente/src/controlador.js']) {
      sinPatrones(await fuente(ruta), ruta, SIN_PENDIENTES);
    }
  });
});
