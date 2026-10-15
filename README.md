# Dosis Vet · Unidad Veterinaria FCV

Calculadora de dosis para perros y gatos (app Android, funciona sin internet).

- Elegís especie y peso, el fármaco y la indicación.
- Cargás la presentación: líquido (`X mg en Y ml`, `UI/ml` o `%`) o comprimido (`mg por comprimido`).
- Te devuelve la dosis total, los **ml a administrar** o los **comprimidos** (redondeado a ¼), con advertencias de rango y dosis máximas.
- Para infusiones continuas calcula ml/h y cómo preparar la jeringa o bolsa.
- Incluye "Cálculo libre" para cualquier fármaco que no esté en la lista.

## Descargar el APK

Cada push compila el APK con GitHub Actions y lo publica en **Releases** (`DosisVet-FCV.apk`).
Abrí la página de Releases desde el celular, descargá el archivo e instalalo.

## Estructura

- `app/src/main/assets/drugs.js`: base de datos de fármacos y dosis (editable).
- `app/src/main/assets/app.js`: lógica de cálculo e interfaz.
- `app/src/main/java/.../MainActivity.java`: contenedor WebView.

> Herramienta de apoyo: verificar siempre las dosis con criterio clínico.

## Clave de firma (opcional, recomendado)

Para que cada APK nuevo se instale como actualización sin desinstalar el anterior,
cargá en *Settings → Secrets and variables → Actions* del repo:

- `KEYSTORE_BASE64`: el keystore codificado en base64.
- `KEYSTORE_PASSWORD`: su contraseña.

Sin esos secrets el APK se firma con una clave de depuración.
