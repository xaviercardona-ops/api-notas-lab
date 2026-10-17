// ARRANQUE: elige el almacén, crea la aplicación y la pone a escuchar.
//
//   npm start                 → http://localhost:3000       (datos en datos/notas.json)
//   PORT=4000 npm start       → otro puerto (en Windows PowerShell: $env:PORT=4000; npm start)
//   DATOS=otro.json npm start → otro archivo de datos

import { fileURLToPath } from 'node:url';
import { AlmacenArchivo } from './almacen.mjs';
import { crearAplicacion } from './aplicacion.mjs';

const PUERTO = Number(process.env.PORT) || 3000;
const ARCHIVO = process.env.DATOS || fileURLToPath(new URL('../datos/notas.json', import.meta.url));

const servidor = crearAplicacion({ almacen: new AlmacenArchivo(ARCHIVO), registrar: true });

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PUERTO} está ocupado. Prueba con otro: PORT=${PUERTO + 1} npm start`);
    process.exit(1);
  }
  throw error;
});

servidor.listen(PUERTO, () => {
  console.log('Servidor listo. Abre estas direcciones en el navegador:');
  console.log(`  La aplicación ....... http://localhost:${PUERTO}/`);
  console.log(`  La API (lista) ...... http://localhost:${PUERTO}/v1/evaluaciones`);
  console.log(`  La documentación .... http://localhost:${PUERTO}/openapi.json`);
  console.log('Cada solicitud aparece abajo con su estado HTTP. Para detenerlo: Ctrl + C');
  console.log('');
});
