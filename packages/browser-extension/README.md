# Code to Figma: 3D Browser Inspector

Extensión de navegador (Manifest V3) que permite inspeccionar cualquier página web (incluyendo plataformas con autenticación o entornos locales), seleccionar componentes con un efecto **3D Pop-out / Spotlight** y enviarlos directamente a **Figma con Auto Layout nativo**.

---

## Instalación en Chrome / Edge / Brave (1 minuto)

1. Abre tu navegador y ve a:
   ```
   chrome://extensions
   ```
2. Activa el interruptor de **Modo de desarrollador** (esquina superior derecha).
3. Haz clic en el botón **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta:
   ```
   packages/browser-extension
   ```
5. *(Opcional)* Haz clic en el icono de la pieza de rompecabezas en la barra de herramientas y fija el icono de **Code to Figma AI**.

---

## Modo de Uso

### 1. Inicia tu servidor local y abre Figma
- En tu terminal, corre el Hub de WebSocket:
  ```bash
  npm run start:hub
  ```
- En Figma, abre el plugin (**Code to Figma AI Bridge**). La primera vez pide el **código de vinculación** que muestra la terminal del hub; después conecta solo. Verás el estado `● En línea`.
- La extensión no necesita código: el hub la reconoce por su origen (`chrome-extension://…`). Todo el envío pasa por su service worker, nunca por un WebSocket abierto desde la página.

### 2. Inspecciona cualquier web
1. Ve a cualquier página web (por ejemplo, una plataforma con login, un dashboard o `http://localhost:3000`).
2. Presiona el atajo **`Alt + Shift + F`** (o haz clic en el icono de la extensión).
3. Verás una notificación de activación en pantalla.

### 3. Selector estilizado & Detección de Contenedor Padre
- Pasa el cursor sobre cualquier sección. Verás un **borde con gradiente y resplandor estilo Figma** (`#A259FF` a `#0D99FF`).
- El inspector detecta automáticamente el **contenedor padre semántico** (tarjeta, barra de navegación, formulario o sección) para que no selecciones textos o iconos aislados por error.
- **Navegación rápida de jerarquía:**
  - Presiona **`↑` (Flecha Arriba)** para subir al contenedor padre superior.
  - Presiona **`↓` (Flecha Abajo)** para bajar a un hijo específico.

### 4. Efecto 3D Pop-out (Spotlight)
- Haz **clic** sobre el componente que deseas capturar.
- El fondo de la página se atenúa con un desenfoque oscuro (`backdrop-blur`).
- El componente **salta hacia el frente en 3D**, proyectando una sombra profunda y permitiéndote revisar con total claridad todo lo que se va a enviar.
- Aparece la barra flotante de control con iconos vectoriales:
  - **`Enviar a Figma [Enter]`**: Extrae todo el árbol del componente y lo envía a Figma.
  - **`Copiar JSON`**: Copia la estructura `UINode` al portapapeles.
  - **`Cancelar [Esc]`**: Regresa el componente suavemente a su lugar.

---

## Atajos de Teclado

| Atajo | Acción |
| --- | --- |
| **`Alt + Shift + F`** | Activar / Desactivar el Inspector en la pestaña actual |
| **`Clic`** | Seleccionar componente y elevarlo en 3D Pop-out |
| **`Ctrl + Clic`** (`⌘ + Clic` en Mac) | Sumar / quitar componentes a la selección múltiple |
| **`Enter`** | Enviar el componente elevado a Figma |
| **`Esc`** | Cancelar elevación 3D / Salir del inspector |
| **`↑`** | Expandir selección al contenedor padre |
| **`↓`** | Reducir selección al elemento hijo |
