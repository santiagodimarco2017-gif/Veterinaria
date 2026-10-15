# Dosis Vet · Unidad Veterinaria FCV

App Android para la clínica diaria de perros y gatos. Funciona sin internet y
reúne tres herramientas, con una barra inferior para pasar de una a otra:

- 💊 **Dosis**: calculadora de dosis (detalle abajo).
- 📋 **Fichas**: historia clínica (pacientes, tutores, consultas, examen,
  diagnóstico, tratamiento, recordatorios, PDF y resumen por WhatsApp).
  Basada en la app [Fichas](https://github.com/santiagodimarco2017-gif/Fichas).
- 🩺 **Anestesia**: ficha anestésica intraoperatoria con exportación a PDF.

Desde una consulta, "Calcular dosis" y "Ficha anestésica" abren esas
secciones con la especie, el peso y los datos del paciente ya cargados.

### Calculadora de dosis

- Elegís especie y peso, el fármaco y la indicación.
- Cargás la presentación: líquido (`X mg en Y ml`, `UI/ml` o `%`) o comprimido (`mg por comprimido`).
- Te devuelve la dosis total, los **ml a administrar** o los **comprimidos** (redondeado a ¼), con advertencias de rango y dosis máximas.
- Para infusiones continuas calcula ml/h y cómo preparar la jeringa o bolsa.
- Incluye "Cálculo libre" para cualquier fármaco que no esté en la lista.

## Descargar el APK

Cada push compila el APK con GitHub Actions y lo publica en **Releases** (`DosisVet-FCV.apk`).
Abrí la página de Releases desde el celular, descargá el archivo e instalalo.

## Datos y copia de seguridad

Todo se guarda solo en el celular. En **Fichas → ⚙️ Ajustes → Copia de
seguridad** se exporta un `.json` (a Descargas) con todos los pacientes,
consultas y la ficha anestésica en curso, y se puede importar en otro
celular o después de reinstalar.

## Estructura

- `app/src/main/assets/drugs.js`: base de datos de fármacos y dosis (editable).
- `app/src/main/assets/app.js`: lógica de cálculo e interfaz.
- `app/src/main/assets/fichas/`: historia clínica (`css/tailwind.css` es
  Tailwind precompilado para funcionar sin internet).
- `app/src/main/assets/anestesia.html`: ficha anestésica.
- `app/src/main/assets/nav.js` y `apk.js`: barra inferior y puente con Android.
- `app/src/main/java/.../MainActivity.java`: contenedor WebView (sirve los
  assets bajo `https://appassets.androidplatform.net/`, guarda archivos en
  Descargas, selector de archivos y calendario del celular).

> Herramienta de apoyo: verificar siempre las dosis con criterio clínico.

## Clave de firma (opcional, recomendado)

Para que cada APK nuevo se instale como actualización sin desinstalar el anterior,
cargá en *Settings → Secrets and variables → Actions* del repo:

- `KEYSTORE_BASE64`: el keystore codificado en base64.
- `KEYSTORE_PASSWORD`: su contraseña.

Sin esos secrets el APK se firma con una clave de depuración.
