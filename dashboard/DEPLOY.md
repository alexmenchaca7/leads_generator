# Dashboard online — guía de instalación paso a paso

Esta guía te lleva de cero a tener el dashboard en línea, compartido con tu socio,
sincronizado con el scraper y protegido con login. Todo con planes **gratuitos**.

Resumen del flujo:

```
Scraper local (Python)  ──push──►  Supabase (Postgres + Auth + Realtime)  ◄──►  Dashboard (Vercel)
```

---

## Parte 1 — Crear el proyecto Supabase (la base de datos)

1. Entra a **https://supabase.com** → *Start your project* → inicia sesión con GitHub.
2. **New project**:
   - *Name*: `leads-generator`
   - *Database Password*: genera una y **guárdala**.
   - *Region*: la más cercana (ej. `East US` o `West US`).
   - *Create new project* (tarda ~2 min en aprovisionar).
3. Cuando esté listo, ve a **SQL Editor** (icono `</>` en la barra izquierda) → **New query**.
4. Abre el archivo [`supabase/schema.sql`](../supabase/schema.sql) de este repo, **copia todo**,
   pégalo y dale **Run**. Debe decir *Success*. Esto crea las tablas `leads`, `contacts`
   y `blocklist` (leads vetados), la seguridad y el Realtime.

   > **Si ya habías corrido una versión anterior del esquema**, no vuelvas a correr
   > `schema.sql` completo: corre en el SQL Editor, en orden, solo las migraciones
   > que te falten:
   > [`02_blocklist.sql`](../supabase/02_blocklist.sql) (leads vetados),
   > [`03_activity.sql`](../supabase/03_activity.sql) (historial de cambios),
   > [`04_scrape.sql`](../supabase/04_scrape.sql) (búsquedas desde el dashboard),
   > [`05_job_detail.sql`](../supabase/05_job_detail.sql) (detalle de cada búsqueda),
   > [`06_app_config.sql`](../supabase/06_app_config.sql) (configuración editable) y
   > [`07_presencia_web.sql`](../supabase/07_presencia_web.sql) (presencia web + giro).
   >
   > Después de correr la 07, entra al dashboard → **⚙ Configurar** → **Recalcular
   > leads** (con el motor de búsquedas encendido) para que tus leads existentes se
   > reclasifiquen bien.

### Obtener las llaves
Ve a **Project Settings** (engrane) → **API**. Copia estos 3 valores:

| Valor en Supabase            | Para qué          |
|------------------------------|-------------------|
| **Project URL**              | scraper + dashboard |
| **anon / public** key        | dashboard         |
| **service_role** key (secreta) | scraper (subir datos) |

> ⚠️ La `service_role` es secreta y da acceso total. **Nunca** la subas a GitHub ni la pongas en el dashboard.

---

## Parte 2 — Crear el primer usuario

En Supabase: **Authentication** → **Users** → **Add user** → *Create new user*:

- Email y contraseña para ti.
- Marca **Auto Confirm User** (para que no necesites verificar correo).

Ese será tu login del dashboard. **De aquí en adelante ya no necesitas Supabase para
esto**: dentro del dashboard hay una pantalla **Usuarios** donde das de alta a tu equipo,
reseteas contraseñas y quitas accesos. (Requiere la `SUPABASE_SERVICE_ROLE_KEY` de la
Parte 4.)

---

## Parte 3 — Conectar el scraper local

1. Instala las nuevas dependencias:
   ```powershell
   pip install -r requirements.txt
   ```
2. En la raíz del proyecto, copia `.env.example` como `.env` y rellénalo:
   ```
   SUPABASE_URL=https://TU-PROYECTO.supabase.co
   SUPABASE_SERVICE_KEY=la-service-role-key-secreta
   ```
   (`.env` ya está en `.gitignore`, no se sube.)
3. **Migración inicial** — sube tus 124 leads actuales del Excel a la nube:
   ```powershell
   python -m src.db --migrate
   ```
4. De aquí en adelante, **cada vez que corras `python main.py`** los leads nuevos
   se subirán solos a Supabase al terminar el scrapeo. Si no hay `.env`, el scraper
   sigue funcionando solo con Excel (el sync se omite).

---

## Parte 4 — Desplegar el dashboard en Vercel

1. Sube este repo a GitHub (ya lo tienes en `alexmenchaca7/leads_generator`):
   ```powershell
   git add -A
   git commit -m "Agregar dashboard y sync con Supabase"
   git push
   ```
2. Entra a **https://vercel.com** → inicia sesión con GitHub → **Add New… → Project**.
3. Importa el repo `leads_generator`.
4. **IMPORTANTE — Root Directory**: dale *Edit* y selecciona la carpeta **`dashboard`**
   (el dashboard vive ahí, no en la raíz). Framework: *Next.js* (se detecta solo).
5. En **Environment Variables** agrega estas tres:
   | Name                            | Value                              |
   |---------------------------------|------------------------------------|
   | `NEXT_PUBLIC_SUPABASE_URL`      | tu Project URL                     |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu **anon / public** key           |
   | `SUPABASE_SERVICE_ROLE_KEY`     | tu **service_role** key (secreta)  |

   > La `service_role` va **sin** el prefijo `NEXT_PUBLIC_` a propósito: así nunca llega
   > al navegador. Solo la usan dos rutas de servidor: la pantalla **Usuarios**
   > (dar de alta/baja al equipo) y el botón que genera el archivo `conexion.env`
   > del motor de búsquedas. Sin ella el dashboard carga, pero esas dos fallan.
6. **Deploy**. En ~1 min tendrás una URL tipo `https://leads-generator-xxx.vercel.app`.
7. Abre la URL → te manda a `/login` → entra con el usuario que creaste. ✅

**Comparte esa URL con tu socio.** Cada quien entra con su propio usuario/contraseña.

---

## Buscar negocios desde el dashboard (motor de búsquedas)

Puedes lanzar búsquedas desde el dashboard (incluso desde el celular) en vez de
correr `python main.py` a mano. Para eso, deja corriendo el **motor de búsquedas**
(el *worker*) en tu PC:

```powershell
python -m src.worker
```

> Para alguien no técnico hay una versión de un clic: el dashboard, en **+ Buscar**,
> trae una guía paso a paso con el programa descargable (`instalar.bat` /
> `start_worker.bat`) y un botón que genera el archivo de conexión ya configurado.
> Ver también [`INSTALACION_WORKER.md`](../INSTALACION_WORKER.md).

- Déjalo abierto: queda escuchando. Cuando creas una búsqueda en la página
  **"+ Buscar negocios"** del dashboard, el worker la ejecuta **sin abrir navegador**
  y sube los resultados (se ven solos en el Dashboard).
- La página de búsqueda muestra si el worker está **conectado** y el estado de cada
  búsqueda (en cola → buscando → listo).
- Tu PC debe estar encendida con el worker corriendo (ahí vive el navegador del scraper).

## Cómo funciona el día a día

- **Buscar**: lanza búsquedas desde el dashboard (con el motor encendido) o corre
  `python main.py` en tu PC → los leads nuevos aparecen en el dashboard **en vivo**.
- **Filtrar prospectos**: en el tablero, los botones **Sin web** y **Solo redes** te
  dejan solo a quien no tiene sitio propio. Los *Solo redes* (su "web" es un Facebook
  o una página gratis) suelen ser la venta más fácil: ya saben que necesitan estar en línea.
- **Trabajar leads**: tú y tu equipo editan desde el dashboard (estado, contactado,
  seguimiento, notas) y llaman o mandan WhatsApp con un clic. Los cambios se guardan
  al instante y los ve el otro en vivo.
- **Ajustar el sistema**: en **⚙ Configurar** cambias las búsquedas, los giros objetivo,
  qué cuenta como "sitio propio" y cómo se calcula el score. Con **Recalcular leads**
  reordenas los que ya tienes.
- **El scraper nunca pisa sus ediciones**: al sincronizar solo inserta leads nuevos;
  los existentes quedan intactos.

---

## Desarrollo local del dashboard (opcional)

Si quieres correr el dashboard en tu PC para probar cambios:

```powershell
cd dashboard
copy .env.local.example .env.local   # y rellena URL + anon key
npm install
npm run dev
```

Abre http://localhost:3000.

---

## Solución de problemas

| Síntoma | Causa probable / arreglo |
|---|---|
| Build de Vercel falla con "URL and API key required" | Faltan las env vars en Vercel (Parte 4, paso 5). |
| El dashboard carga pero sin datos | ¿Corriste la migración (`python -m src.db --migrate`)? ¿RLS bien? Reejecuta `schema.sql`. |
| Login dice "incorrectos" | El usuario no existe o no está *confirmado*. Créalo en Authentication → Users con *Auto Confirm*, o desde la pantalla **Usuarios** del dashboard. |
| La pantalla **Usuarios** dice "Faltan… SUPABASE_SERVICE_ROLE_KEY" | Falta esa env var en Vercel (Parte 4, paso 5) o en `dashboard/.env.local` en local. Agrégala y vuelve a desplegar. |
| Los leads viejos no muestran presencia web / industria | Falta correr `supabase/07_presencia_web.sql`, o falta el **Recalcular leads** de ⚙ Configurar (con el motor encendido). |
| Cambié la config y no pasa nada | Los cambios aplican en la **siguiente búsqueda**. Para los leads que ya tienes, usa **Recalcular leads**. |
| Los leads nuevos no aparecen en vivo | Realtime no activado: vuelve a correr la sección Realtime de `schema.sql`. |
| `python main.py` no sube nada | Falta `.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, o falta `pip install -r requirements.txt`. |
