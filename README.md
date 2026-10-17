# Laboratorio API · Notas del semestre

Laboratorio del curso de **Arquitectura de Software** (Tema 2.4: diseño de soluciones basadas en APIs). Partes
de la aplicación MVC de la clase pasada, cuyo Modelo vivía en el navegador, y le pones un **servidor con una
API REST**: diseñas los endpoints, eliges los códigos de estado, versionas la API sin romper a nadie y la
documentas con **OpenAPI**. Unas pruebas te dicen si vas bien.

- **Duración:** ≈ 2 h 20 min (7 partes) · en parejas o equipos de 3, un repositorio por equipo
- **Qué necesitas:** un navegador, un editor (VS Code recomendado), Git y [Node.js](https://nodejs.org) 18.2 o superior (mejor 20 o 22)
- **Sin dependencias:** no hay `npm install`; no se descarga nada más

## Empieza aquí

1. Lee la **guía del laboratorio** (pasos, tiempos, rúbrica): https://api-notas-lab.vercel.app/guia.html
2. Revisa la **presentación** del tema: https://api-notas-lab.vercel.app/presentacion.html
3. Crea el repositorio de tu equipo con **Use this template** (botón verde de esta página) y clónalo.
4. Ejecuta `npm run dev` y abre <http://localhost:3000>. Al principio la aplicación **no carga**: la API todavía no existe. Ese es tu trabajo.

```bash
npm start               # servidor + aplicación en http://localhost:3000 (cada solicitud aparece en la terminal)
npm test                # todas las pruebas (muestra un grupo con fallos a la vez)
npm test -- --todo      # todas las pruebas, con todos los fallos
npm run test:api        # Parte 2 · la API v1
npm run test:cliente    # Parte 3 · el MVC del navegador conectado a la API
npm run test:versionado # Parte 4 · la v2 y los avisos de obsolescencia
npm run test:docs       # Parte 5 · el documento OpenAPI
npm run arquitectura    # reglas de arquitectura a los dos lados del cable
npm run test:reto       # reto opcional: que nadie pise el trabajo de otro (ETag)
```

## Qué hay en cada carpeta

```text
servidor/
  modelo.js             El Modelo de la clase pasada (terminado, con 4 cambios pequeños): reglas, sin saber de HTTP
  almacen.mjs           Dónde guarda el servidor las evaluaciones (memoria o archivo datos/notas.json)
  nucleo.mjs            La "plomería" HTTP (ya escrita): rutas, 404/405, cuerpo JSON, errores problem+json
  representaciones.mjs  Cómo se ve un recurso por fuera (el JSON): la "Vista" de la API
  rutas.mjs             PARTES 2 y 4 · tu trabajo: los endpoints (esqueleto con TODO)
  openapi.mjs           PARTE 5 · tu trabajo: la documentación como datos (esqueleto con TODO)
  aplicacion.mjs        Arma el servidor con todas sus piezas
  main.mjs              Arranque (npm start)
cliente/                Lo que corre en el navegador (el servidor lo sirve en /)
  index.html            El HTML estático de la pantalla (sin lógica)
  estilos.css           Estilos (no hace falta tocarlos)
  src/
    vista.js            La Vista de la clase pasada: NO cambia
    termometro-vista.js La segunda vista: casi igual (ya no importa las reglas del Modelo)
    controlador.js      PARTE 3 · tu trabajo: volverlo asíncrono (esqueleto con TODO)
    modelo-remoto.js    PARTE 3 · tu trabajo: el Modelo que habla con la API (esqueleto con TODO)
    cliente-api.js      El único archivo del navegador que sabe de HTTP (ya escrito)
    main.js             Ensambla las piezas (en la Parte 4 vuelves aquí)
pruebas/                Especificación ejecutable: contrato de la API, cliente, versionado, documentación, arquitectura
ENTREGA.md              Lo que entregas: contrato, decisiones, MVC a ambos lados, versionado, evidencias, reflexión
```

## Comandos útiles de Git

```bash
git add -A
git commit -m "Parte 2: la API v1 (lectura, creación y errores)"
git pull && git push
```

Haz un **commit por parte**: te sirven de evidencia de qué archivos tocó cada paso.

## Probar la API a mano

Con el servidor corriendo (`npm start`), en otra terminal:

```bash
curl -i http://localhost:3000/v1/resumen
curl -i -X POST http://localhost:3000/v1/evaluaciones -H 'Content-Type: application/json' -d '{"nombre":"Parcial 1","peso":30,"nota":4.2}'
curl -i http://localhost:3000/v1/evaluaciones
```

En Windows PowerShell usa `curl.exe` (sin la `.exe`, `curl` es otra cosa) y comillas dobles escapadas para el JSON; o prueba con
la extensión *REST Client* de VS Code, o con el navegador para los `GET`.
