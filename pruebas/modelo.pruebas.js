// PRUEBAS DEL MODELO (ya deben pasar: el Modelo viene terminado)
//
// Son pocas: las reglas ya las probaste en la clase de MVC. Aquí solo se vigila lo que la API necesita
// de él: errores con código estable, que agregar/calificar devuelvan la evaluación y que obtener() exista.
//
//   npm run test:modelo

import { AlmacenMemoria } from '../servidor/almacen.mjs';
import { CODIGOS, NotasModelo } from '../servidor/modelo.js';
import { cercaDe, grupo, igual, igualJSON, lanzaReglas, prueba, verdadero } from './mini.js';

const SUITE = 'modelo';
const g = (nombre, definir) => grupo(nombre, definir, { suite: SUITE });
const nuevo = (datos = []) => new NotasModelo(new AlmacenMemoria(datos));

g('Reglas con código estable', () => {
  prueba('cada regla rota trae su código (la API lo traduce a un estado HTTP)', () => {
    const m = nuevo([{ id: 1, nombre: 'Parcial', peso: 90, nota: null }]);
    lanzaReglas(() => m.agregar({ nombre: '  ', peso: 5 }), CODIGOS.NOMBRE_OBLIGATORIO);
    lanzaReglas(() => m.agregar({ nombre: 'x'.repeat(41), peso: 5 }), CODIGOS.NOMBRE_LARGO);
    lanzaReglas(() => m.agregar({ nombre: 'A', peso: 0 }), CODIGOS.PESO_FUERA_DE_RANGO);
    lanzaReglas(() => m.agregar({ nombre: 'A', peso: 5, nota: 6 }), CODIGOS.NOTA_FUERA_DE_RANGO);
    lanzaReglas(() => m.agregar({ nombre: 'A', peso: 20 }), CODIGOS.PESOS_EXCEDEN_100);
    lanzaReglas(() => m.agregar({ nombre: 'parcial', peso: 5 }), CODIGOS.NOMBRE_DUPLICADO);
    lanzaReglas(() => m.calificar(99, 4), CODIGOS.NO_EXISTE);
    lanzaReglas(() => m.eliminar(99), CODIGOS.NO_EXISTE);
  });

  prueba('calificar comprueba primero que la evaluación exista', () => {
    lanzaReglas(() => nuevo().calificar(1, 99), CODIGOS.NO_EXISTE);
  });
});

g('Lo que la API necesita del Modelo', () => {
  prueba('agregar() devuelve la evaluación creada, con su id', () => {
    const m = nuevo([{ id: 4, nombre: 'Taller', peso: 10, nota: null }]);
    const creada = m.agregar({ nombre: ' Final ', peso: 30 });
    igualJSON(creada, { id: 5, nombre: 'Final', peso: 30, nota: null });
  });

  prueba('calificar() devuelve la evaluación ya calificada', () => {
    const m = nuevo([{ id: 1, nombre: 'Taller', peso: 10, nota: null }]);
    igualJSON(m.calificar(1, 4.5), { id: 1, nombre: 'Taller', peso: 10, nota: 4.5 });
  });

  prueba('obtener(id) devuelve una copia; con un id que no existe lanza NO_EXISTE', () => {
    const m = nuevo([{ id: 1, nombre: 'Taller', peso: 10, nota: null }]);
    const copia = m.obtener(1);
    copia.nota = 5; // no debe alterar el Modelo
    igual(m.obtener(1).nota, null);
    lanzaReglas(() => m.obtener(2), CODIGOS.NO_EXISTE);
  });

  prueba('el resumen sigue calculándose igual que en la clase pasada', () => {
    const m = nuevo([
      { id: 1, nombre: 'Parcial', peso: 30, nota: 4 },
      { id: 2, nombre: 'Taller', peso: 20, nota: null },
    ]);
    const r = m.resumen();
    cercaDe(r.acumulado, 1.2);
    igual(r.notaNecesaria, 2.58);
    igual(r.estado, 'en-camino');
  });

  prueba('el Modelo sigue avisando a sus suscriptores (Observer)', () => {
    const m = nuevo();
    let avisos = 0;
    m.suscribir(() => (avisos += 1));
    m.agregar({ nombre: 'A', peso: 10 });
    verdadero(avisos === 1, 'se esperaba un aviso por cada cambio');
  });
});
