# Guía de Instalación y Uso — Code to Figma

Esta guía explica cómo instalar y utilizar **Code to Figma** sin necesidad de conocimientos técnicos avanzados ni de mantener consolas abiertas.

---

## Requisitos Previos

1. **Navegador web**: Google Chrome, Brave, Microsoft Edge o cualquier navegador basado en Chromium.
2. **Figma**: Aplicación de escritorio (**Figma Desktop**, recomendada) o Figma en el navegador Web.

---

## Paso 1: Instalar la Extensión de Chrome

1. Abre tu navegador y accede a:
   ```text
   chrome://extensions
   ```
2. Activa el interruptor **Modo de desarrollador** (esquina superior derecha).
3. Haz clic en **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta:
   ```text
   packages/browser-extension
   ```
5. *(Recomendado)* Haz clic en el ícono de rompecabezas de la barra de extensiones y **fija** el ícono de Code to Figma.

---

## Paso 2: Abrir el Hub Local Autónomo

El Hub es un programa local ligero que comunica la extensión del navegador con el plugin de Figma. **No envía datos a servidores externos; todo se procesa en tu equipo.**

1. Puedes generar el ejecutable autónomo ejecutando una vez:
   ```bash
   npm run build:hub-exe
   ```
2. Ejecuta el archivo generado:
   ```text
   packages/mcp-server/dist/code-to-figma-hub.exe
   ```
3. El programa se mantendrá activo en segundo plano escuchando en `127.0.0.1:8080`.
   * Si ya hay una instancia abierta, la nueva se cerrará de forma automática y silenciosa.
   * Su archivo de registro se guarda en `~/.code-to-figma/hub.log`.
   * El código de vinculación queda guardado en `~/.code-to-figma/pairing-code`.

> **💡 Inicio automático en Windows**: Puedes crear un acceso directo a `code-to-figma-hub.exe` y colocarlo en tu carpeta de Inicio de Windows (`Win + R` → `shell:startup`) para que arranque solo al iniciar sesión.

---

## Paso 3: Cargar y Vincular el Plugin en Figma

1. Abre **Figma** (en la app de escritorio o en el navegador).
2. Abre cualquier archivo de diseño o lienzo en blanco.
3. Haz clic derecho en el lienzo → **Plugins** → **Development** → **Import plugin from manifest...**
4. Selecciona el archivo:
   ```text
   packages/figma-plugin/manifest.json
   ```
5. Ejecuta el plugin recién importado: **Code to Figma AI Bridge**.
6. **Vinculación inicial (solo la primera vez)**:
   * Aparecerá una ventana solicitando el **Código de vinculación**.
   * Copia el código que aparece en tu archivo `~/.code-to-figma/pairing-code` (formato `XXXX-XXXX`) y pulsa **Vincular**.
   * Figma lo almacena de forma segura; en las siguientes sesiones conectará automáticamente.
7. El indicador del plugin mostrará el estado verde: `● En línea`.

---

## Paso 4: ¡A extraer componentes!

1. Navega a cualquier página web (incluyendo plataformas privadas con inicio de sesión o desarrollos locales).
2. Presiona el atajo:
   ```text
   Alt + Shift + F
   ```
3. Pasa el cursor sobre la interfaz: verás el recuadro con gradiente detectando contenedores padre inteligentes (tarjetas, menús, secciones).
   * Usa `↑` (Flecha arriba) para expandir la selección al contenedor padre.
   * Usa `↓` (Flecha abajo) para descender a un elemento hijo.
4. Haz **clic** sobre el bloque deseado para elevarlo en **3D Pop-out**.
5. Presiona **Enter** o pulsa **Enviar a Figma**.
6. ¡Listo! En segundos aparecerá en tu lienzo de Figma reproducido con **Auto Layout nativo, textos reales, variantes y variables de color**.

### Móvil, tablet y modo oscuro en un solo envío

Antes de enviar, marca en el panel:

* **Breakpoints**: además del tamaño de escritorio, el bloque llega como se ve en móvil (375 px) y tablet (768 px), como variantes `Breakpoint=…` de un mismo componente.
* **Claro/Oscuro**: los colores llegan como Variables con modos `Light` y `Dark`. En Figma, cambia el modo del frame (panel derecho → Variables) y todo el componente cambia de tema. Al lado aparece una copia ya en modo Dark.

Si la página no tiene modo oscuro, se avisa y se envía solo el tema actual.

### Revisar si la web respeta el diseño

Sirve para comprobar si lo que se programó coincide con lo que se diseñó, sin medir a mano.

1. En Figma, con el plugin abierto, selecciona el frame del diseño (el original).
2. En el navegador, selecciona el mismo componente en la web y pulsa **Comparar con Figma**.
3. La extensión captura el componente de la web, con sus imágenes, y lo envía a Figma. Tu diseño no se modifica. Al lado aparecen tres cosas:
   * **"Producción · …"**: el componente tal como está en la web, dibujado para verlo junto al diseño.
   * **"QA · …"**: un informe con cada diferencia, de la más grave a la menos grave. Por ejemplo: "Padding: 20 px en producción, 24 px en el diseño" o "Imagen distinta: proporción 16:9 en producción, 4:3 en el diseño".
   * **Anotaciones en Dev Mode** sobre las capas del diseño que tienen diferencias. Si vuelves a comparar, se reemplazan.

Se comparan tamaños, espaciados, radios, colores, bordes, sombras, tipografía, los textos que faltan o sobran y las imágenes:
* que falte o sobre una imagen;
* que sea otra imagen;
* que se ajuste distinto, por ejemplo cubrir frente a contener.

Las capas no tienen que llamarse igual que las clases CSS.

### Exportar como HTML + CSS + JS

Con el bloque seleccionado, pulsa **Exportar HTML**. La extensión copia las reglas CSS reales de la página que usa ese bloque (incluidas las de móvil y los efectos al pasar el ratón), comprueba que la copia se vea igual y te deja elegir:

* **ZIP (HTML + CSS + JS)**: `index.html`, `styles.css` y, si hay pestañas o desplegables, `script.js`.
* **HTML único**: un solo archivo con todo dentro.
* **Copiar HTML**: al portapapeles, para pegarlo donde quieras.

El diálogo indica qué porcentaje de los elementos quedó exactamente en su sitio. El JavaScript propio del sitio (carruseles a medida, datos del servidor…) no se copia; las pestañas, acordeones y menús estándar sí funcionan.

---

## Solución de Problemas Frecuentes

### 1. El plugin indica "Desconectado" en Figma Web
* **Causa**: Desde Chrome 142+, Chrome bloquea por defecto la conexión desde páginas web hacia la red local (`localhost`).
* **Solución**: En la barra de direcciones de Figma en Chrome, haz clic en el ícono de ajustes del sitio (a la izquierda de la URL) y activa el permiso **"Apps en el dispositivo"** (*Local network access*). Alternativamente, usa la **app de escritorio de Figma**, la cual no tiene esta restricción.

### 2. Las imágenes llegan vacías a Figma
* **Causa**: La extensión necesita permiso para descargar imágenes alojadas en otros dominios (CDN). Chrome solo deja concederlo con un clic en una página de la propia extensión.
* **Solución**: Al instalar o recargar la extensión se abre la pestaña **"Code to Figma — Permisos"**: pulsa **Permitir** y acepta el aviso de Chrome. Si la cerraste, se vuelve a abrir sola (en segundo plano) la primera vez que una imagen no se pueda descargar. Luego vuelve a enviar el componente.

### 3. "Hub no detectado en puerto 8080"
* **Solución**: Comprueba que `code-to-figma-hub.exe` esté abierto. Si lo estás usando en modo desarrollo, puedes iniciarlo con `npm run start:hub`.

### 4. "Es de una versión anterior" tras actualizar
* **Causa**: el hub o el plugin siguen abiertos desde antes de la actualización y no conocen las funciones nuevas (breakpoints, claro/oscuro, Comparar con Figma).
* **Solución**: el aviso dice cuál de los dos es.
  * **Hub**: ciérralo y vuelve a abrirlo. Si usas el ejecutable, regenéralo antes con `npm run build:hub-exe`.
  * **Plugin**: ciérralo en Figma y vuelve a ejecutarlo.
  * **Extensión**: recárgala en `chrome://extensions` y refresca la pestaña.

### 5. Código de vinculación olvidado o cambiado
* Si necesitas volver a vincularte, abre el archivo `~/.code-to-figma/pairing-code` con el Bloc de notas para ver tu código actual. Si borras ese archivo, el hub generará uno nuevo en su próximo inicio.
