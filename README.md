# Dosis Vet · Unidad Veterinaria FCV

App Android para la clínica diaria de perros y gatos. Funciona sin internet y
reúne cinco herramientas, con una barra inferior para pasar de una a otra:

- 💊 **Dosis**: calculadora de dosis (detalle abajo).
- 💧 **Infusión**: infusiones continuas de uno o varios fármacos (por ejemplo
  FLK), mezclados en una bolsa/jeringa o cada uno aparte, con bomba o a
  goteo (macro 20 / micro 60). Indica los ml a cargar de cada frasco, el
  diluyente, la duración, los ml/kg/h de fluido y las gotas por minuto.
- 🧮 **Cálculos**:
  - *Fluidoterapia*: déficit (% deshidratación) + mantenimiento (AAHA o
    ml/kg/día) + pérdidas, repartido en las horas elegidas; ml/h, ml/kg/h y
    gotas/min (macro 20 / micro 60).
  - *Transfusión*: volumen = peso × volemia × (Hto deseado − Hto actual) /
    Hto donante (volemia perro 90, gato 60 ml/kg), con fase de prueba,
    velocidad (máx. 10 ml/kg/h o 4 en cardiópatas), tiempo y goteo.
  - *Nutrición*: RER = 70 × peso^0,75, MER = RER × factor por etapa, y
    ración en g/día a partir del análisis garantizado con Atwater (4/9/4) y
    Atwater modificado (3,5/8,5/3,5), o de las kcal/kg declaradas.
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
