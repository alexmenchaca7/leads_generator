# Guía para encender el "motor de búsquedas" (sin conocimientos técnicos)

El **motor de búsquedas** (técnicamente, el *worker*) es un programa que vive en
una PC con Windows y es el que realmente hace las búsquedas que pides desde el
dashboard. **Mientras esté encendido**, el dashboard puede buscar negocios; si lo
apagas, el dashboard dirá "Motor de búsquedas apagado" y las búsquedas quedan en cola.

Solo tienes que hacer la **Parte 1 una vez**. Después, el día a día es la Parte 2.

---

## Parte 1 — Instalación (solo la primera vez)

### Paso 1: Instalar Python
1. Entra a **https://www.python.org/downloads/** y baja Python (botón amarillo grande).
2. Abre el archivo descargado.
3. **MUY IMPORTANTE:** antes de darle *Install*, marca la casilla de abajo que dice
   **“Add python.exe to PATH”**. (Si no la marcas, no va a funcionar.)
4. Dale **Install Now** y espera a que termine. Cierra la ventana.

### Paso 2: Poner el archivo de conexión (`conexion.env`)
> Lo descargas desde el dashboard; ya viene configurado, no escribes nada.

1. Entra al dashboard → **+ Buscar** → abre la guía **“Instalar y usar el sistema”**
   → botón **“Descargar archivo de conexión”**. Se baja un archivo llamado **`conexion.env`**.
2. **Mueve** ese `conexion.env` a la carpeta del programa (donde está `start_worker.bat`).
   (Sin este archivo el motor no puede conectarse. Contiene una llave privada: no lo compartas.)

### Paso 3: Instalar los componentes
1. En la carpeta del proyecto, busca el archivo **`instalar.bat`**.
2. Haz **doble clic**. Se abre una ventana negra que instala todo solo.
3. Cuando diga **“LISTO”**, cierra esa ventana.

✅ Listo. La instalación se terminó.

---

## Parte 2 — Encender el motor (el día a día)

1. En la carpeta del proyecto, haz **doble clic en `start_worker.bat`**.
2. Se abre una ventana negra que dice **“Motor de búsquedas ENCENDIDO”**. **Déjala abierta.**
3. ¡Ya está! Ahora puedes ir al dashboard y hacer búsquedas. La barra se pondrá
   **verde**: *“Motor de búsquedas conectado”*.

> Para **apagarlo**, simplemente cierra esa ventana negra.
> Si la PC se reinicia o se cae la luz, solo vuelve a hacer doble clic en
> `start_worker.bat`.

---

## Parte 3 — Crear el acceso directo y que arranque solo

> Esto lo hace quien instala el sistema. Deja el acceso directo en el escritorio
> para que el usuario del dashboard solo tenga que darle doble clic.

1. Haz **clic derecho** sobre `start_worker.bat` → **Mostrar más opciones** →
   **Crear acceso directo**.
2. **Renombra** ese acceso directo a **`Iniciar búsquedas`** y muévelo al
   **Escritorio** (así el dashboard y la guía coinciden con ese nombre).
3. Para que arranque solo al prender la PC: presiona **Windows + R**, escribe
   **`shell:startup`**, Enter (se abre la carpeta *Inicio*) y **copia ahí** ese mismo
   acceso directo.

Desde ahora, cada vez que enciendas la PC el motor arranca solo, y el usuario también
puede encenderlo a mano con el acceso directo **«Iniciar búsquedas»** del escritorio.

---

## Preguntas frecuentes

**¿Tengo que dejar la PC prendida?**
Sí. El motor solo trabaja mientras la PC está encendida y la ventana abierta.
Si la apagas, las búsquedas quedan "en cola" y se ejecutan cuando lo vuelvas a encender.

**Se cerró la ventana sola / dice un error rojo.**
Vuelve a abrir `start_worker.bat`. Se reinicia solo cada 10 segundos. Si el error
sigue, avísale a quien instaló el sistema.

**¿Esto gasta muchos datos o hace lento internet?**
No. Es ligero. Solo trabaja cuando pides una búsqueda desde el dashboard.

**El dashboard dice "Motor de búsquedas apagado".**
Significa que esa PC no tiene el motor abierto. Haz doble clic en `start_worker.bat`.

**Cambié la configuración y los leads viejos siguen con el score anterior.**
Entra a **⚙ Configurar** → botón **Recalcular leads**. El motor (encendido) vuelve
a puntuar y reclasificar todos los leads que ya tienes.
