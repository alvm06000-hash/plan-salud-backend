# Mi Plan de Salud — proyecto base para Android

Este es el proyecto ya armado (React + Vite + Capacitor) a partir de la app que probamos
en el chat. Te falta correrlo en tu máquina porque necesita `npm install` y Android Studio,
que no están disponibles acá.

## 0. Qué cambié respecto al artifact de Claude

- `window.storage` → reemplazado por `@capacitor/preferences` (guarda el plan en el propio
  dispositivo).
- La llamada a la API de Anthropic ya **no** va directo desde la app (eso solo funciona
  dentro de Claude.ai). Ahora la app llama a tu propio backend (`server/index.js`), que es
  el que realmente tiene la API key. **Nunca pongas tu API key dentro del código de la app**:
  cualquiera podría extraerla del .apk y usarla a tu costa.

## 1. Instalar dependencias

```bash
npm install
cd server && npm install && cd ..
```

## 2. Levantar el backend (localmente para probar)

```bash
export ANTHROPIC_API_KEY=sk-ant-tu-clave
node server/index.js
```

Para producción, desplegá esta carpeta `server/` en Render, Railway, Fly.io o Cloud Run
(cualquiera con un plan gratuito sirve para arrancar), y guardá la API key como variable
de entorno secreta ahí, no en tu repositorio.

## 3. Configurar la URL del backend en la app

Creá un archivo `.env` en la raíz del proyecto:

```
VITE_API_URL=https://tu-backend-desplegado.com/api/leer-receta
```

## 4. Compilar el frontend y agregar Android

```bash
npm run build
npx cap add android
npx cap sync android
```

## 5. Abrir en Android Studio y generar el AAB

```bash
npx cap open android
```

Dentro de Android Studio: **Build → Generate Signed App Bundle**, creás tu keystore
(guardala en un lugar seguro, la necesitás para todas las actualizaciones futuras) y
generás el `.aab`.

## 6. Antes de subir a Play Console

- Cambiá `appId` en `capacitor.config.json` (ej. `com.tunombre.plansalud`) — tiene que ser
  único y no lo podés cambiar después de publicar.
- Reemplazá los íconos por defecto (`android/app/src/main/res/`) con los tuyos.
- Escribí una **política de privacidad** (obligatoria: la app procesa datos de salud) y
  subila a una URL pública para pegarla en la ficha de Play Console.
- Creá la cuenta de desarrollador en https://play.google.com/console (pago único de USD 25).
- Si tu cuenta es nueva, preparate para la prueba cerrada obligatoria de 12 testers
  durante 14 días antes de poder publicar en producción.

## 7. Aviso médico

Esta app transcribe recetas con IA, que puede cometer errores de lectura. En la ficha de
Play Store y dentro de la propia app conviene dejar claro que no reemplaza la indicación
del médico o farmacéutico, y que el usuario debe verificar los datos antes de tomar
cualquier medicamento.
