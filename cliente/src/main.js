// RAÍZ DE COMPOSICIÓN del navegador: el único lugar que conoce las piezas y las conecta.
// (Ya viene escrito; en la Parte 4 vuelves aquí para pasar de la v1 a la v2.)

import { ClienteApi } from './cliente-api.js';
import { NotasModeloRemoto } from './modelo-remoto.js';
import { NotasVista } from './vista.js';
import { TermometroVista } from './termometro-vista.js';
import { NotasControlador } from './controlador.js';

// 1. El cable: habla con la API. Parte 4: cambia 'v1' por 'v2' y mira la consola del navegador.
const api = new ClienteApi({ version: 'v1' });

// 2. El Modelo, ahora remoto: pregunta todo a la API. Lo primero es traer el estado actual.
const modelo = new NotasModeloRemoto(api);
try {
  await modelo.sincronizar();
} catch (error) {
  document.getElementById('error').textContent = `${error.message} Revisa la terminal donde corre el servidor (npm start).`;
  throw error;
}

// 3. Las Vistas: reciben el Modelo para LEERLO y suscribirse a sus cambios. Son las mismas de la clase pasada.
const vista = new NotasVista(document.getElementById('app'), modelo);
new TermometroVista(document.getElementById('termometro'), modelo);

// 4. El Controlador: conecta los eventos de la Vista con las acciones del Modelo.
new NotasControlador(modelo, vista);
