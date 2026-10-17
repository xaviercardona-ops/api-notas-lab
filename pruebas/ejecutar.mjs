// Ejecuta las pruebas en la terminal.
//
//   npm test                   → todas
//   npm run test:api           → solo la Parte 2 (la API v1)
//   npm run test:cliente       → solo la Parte 3 (el MVC del navegador conectado a la API)
//   npm run test:versionado    → solo la Parte 4 (v2 y la obsolescencia de v1)
//   npm run test:docs          → solo la Parte 5 (OpenAPI)
//   npm run arquitectura       → solo las reglas de arquitectura
//   npm run test:reto          → el reto opcional (ETag y concurrencia)
//   npm test -- --todo         → muestra TODOS los fallos (por defecto solo el primer grupo con fallos)

import { ejecutar } from './mini.js';

const SUITES = [
  ['modelo', 'EL MODELO (viene terminado)', './modelo.pruebas.js'],
  ['api', 'PARTE 2 · LA API v1', './api.pruebas.js'],
  ['cliente', 'PARTE 3 · EL CLIENTE MVC', './cliente.pruebas.js'],
  ['versionado', 'PARTE 4 · VERSIONADO', './versionado.pruebas.js'],
  ['documentacion', 'PARTE 5 · DOCUMENTACIÓN', './documentacion.pruebas.js'],
  ['arquitectura', 'ARQUITECTURA', './arquitectura.pruebas.js'],
  ['reto', 'RETO OPCIONAL · CONCURRENCIA', './reto.pruebas.js'],
];

const argumentos = process.argv.slice(2);
const verTodo = argumentos.includes('--todo');
const pedida = argumentos.find((a) => !a.startsWith('--'));
if (pedida && !SUITES.some(([clave]) => clave === pedida)) {
  console.error(`No conozco la serie "${pedida}". Las series son: ${SUITES.map(([c]) => c).join(', ')}.`);
  process.exit(2);
}

for (const [clave, , archivo] of SUITES) {
  if (!pedida || pedida === clave) await import(archivo);
}

const resultado = await ejecutar();

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const pintar = (codigo, texto) => (color ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);
const verde = (t) => pintar('32', t);
const rojo = (t) => pintar('31', t);
const gris = (t) => pintar('90', t);
const negrita = (t) => pintar('1', t);

console.log('');
for (const [clave, titulo] of SUITES) {
  const grupos = resultado.grupos.filter((g) => g.suite === clave);
  if (grupos.length === 0) continue;
  console.log(negrita(titulo));
  for (const g of grupos) {
    const total = g.resultados.length;
    const ok = g.pasan === total;
    const marca = ok ? verde('✓') : g.pasan === 0 ? rojo('✗') : rojo('◐');
    const puntos = '.'.repeat(Math.max(2, 52 - g.nombre.length));
    console.log(`  ${marca} ${g.nombre} ${gris(puntos)} ${ok ? verde(`${g.pasan}/${total}`) : rojo(`${g.pasan}/${total}`)}`);
  }
  console.log('');
}

// Detalle: por defecto, solo el primer grupo con fallos que no sea un reto (si no hay otro, el reto).
const conFallos = resultado.grupos.filter((g) => g.pasan < g.resultados.length);
const principales = conFallos.filter((g) => !g.extension);
const mostrar = verTodo ? conFallos : [principales[0] ?? conFallos[0]].filter(Boolean);

for (const g of mostrar) {
  console.log(negrita(`Para arreglar ahora: ${g.nombre}`));
  for (const r of g.resultados.filter((x) => !x.ok)) {
    console.log(`  ${rojo('✗')} ${r.nombre}`);
    for (const linea of String(r.mensaje).split('\n')) console.log(gris(`      ${linea.trim() ? linea.trim() : ''}`));
  }
  console.log('');
}

const resumen = `${resultado.pasan} de ${resultado.total} pruebas pasan.`;
console.log(resultado.fallan === 0 ? verde(`✓ ${resumen}`) : rojo(`✗ ${resumen}`));
if (resultado.fallan > 0 && !verTodo && conFallos.length > mostrar.length) {
  console.log(gris('  (Se muestra un grupo a la vez. Con "npm test -- --todo" ves todos los fallos.)'));
}
console.log('');
process.exit(resultado.fallan === 0 ? 0 : 1);
