# SIGEVAN: Sistema para Administración del Asilo de Ancianos "Cabeza de Algodón"

Proyecto del curso **Análisis de Sistemas II**. Aplicación web para llevar la ficha médica de cada interno, las solicitudes a especialistas de la fundación, las visitas médicas con sus exámenes de laboratorio y medicamentos de farmacia, y el manejo de caja del asilo (cargos al familiar con el descuento de la fundación, cuotas, donaciones, gastos y deuda con la fundación).

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 (React 19) |
| Backend | Node.js + Express (API REST) |
| Base de datos | Microsoft SQL Server 2019 / 2022 |
| Seguridad | JWT, contraseñas cifradas con bcrypt, control de acceso por roles |
| Pruebas | Jest + Supertest |

## Estructura del repositorio

```
asilo-cabeza-de-algodon/
├── database/
│   └── script.sql        Script de la base de datos (borra y crea, con datos de ejemplo)
├── backend/              API REST (puerto 4000)
│   ├── src/              Código fuente (rutas, middleware, validaciones)
│   ├── scripts/seed.js   Crea los usuarios de prueba
│   └── tests/            Pruebas automatizadas
└── frontend/             Interfaz web (puerto 3000)
```

## Avance actual

| Módulo | Estado |
|--------|--------|
| Base de datos completa según el enunciado (v2.0) | Implementado |
| Inicio de sesión, 8 roles, expiración de sesión y auditoría | Implementado |
| Gestión de usuarios (solo Administrador) | Implementado |
| Ficha del interno (psicopatologías, medicamentos de cajón, egreso) | Implementado |
| Familiares, solicitudes, fundación, visitas, laboratorio, farmacia | En desarrollo |
| Caja (cargos, pagos, cuotas, donaciones, gastos), reportes y correo | En desarrollo |

---

## Requisitos previos

- **Node.js 20 LTS** o superior: https://nodejs.org (verificar con `node -v`)
- **SQL Server 2019 o 2022** (Express o Developer) y **SQL Server Management Studio (SSMS)**
- **Git** (o GitHub Desktop)

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/<usuario>/asilo-cabeza-de-algodon.git
cd asilo-cabeza-de-algodon
```

### 2. Preparar SQL Server (solo la primera vez)

El backend se conecta por TCP/IP con un usuario de SQL Server, así que hay que habilitar dos cosas:

1. **Autenticación mixta:** en SSMS, clic derecho sobre el servidor → *Properties* → *Security* → marcar **SQL Server and Windows Authentication mode**.
2. **TCP/IP:** abrir **SQL Server Configuration Manager** → *SQL Server Network Configuration* → *Protocols for MSSQLSERVER* (o *SQLEXPRESS*) → clic derecho en **TCP/IP** → *Enable*. En *Properties* → *IP Addresses* → *IPAll*, escribir **1433** en *TCP Port*.
3. **Reiniciar** el servicio de SQL Server (en Configuration Manager → *SQL Server Services* → clic derecho → *Restart*).

### 3. Crear la base de datos

1. Crear (una sola vez) el login que usará la aplicación, cambiando la contraseña por una propia:

```sql
CREATE LOGIN asilo_app WITH PASSWORD = 'Una_Contraseña_Segura_1';
```

2. Abrir `database/script.sql` en SSMS y ejecutarlo completo (**F5**). Crea la base `AsiloCabezaAlgodon` con sus tablas, vistas, catálogos y datos de ejemplo, y da permisos al usuario `asilo_app`.

> **Atención:** si la base ya existe, el script la borra y la crea de nuevo. Sirve para instalar desde cero o reiniciar el ambiente de pruebas. Después de ejecutarlo hay que correr `npm run seed` otra vez.

### 4. Configurar y levantar el backend

```bash
cd backend
npm install
copy .env.example .env      # en Mac/Linux: cp .env.example .env
```

Abrir `backend/.env` y completar como mínimo `DB_PASSWORD` (la del paso 3), `JWT_SECRET` (cualquier texto largo) y `SEED_PASSWORD` (contraseña de los usuarios de prueba). Si SQL Server es una instancia con nombre (por ejemplo `SQLEXPRESS`), escribir `DB_INSTANCE=SQLEXPRESS`.

```bash
npm run seed    # crea los usuarios de prueba (uno por rol)
npm run dev     # inicia la API en http://localhost:4000/api
```

Debe aparecer: `Conectado a SQL Server.` y `API lista en http://localhost:4000/api`.

### 5. Configurar y levantar el frontend

En **otra terminal**:

```bash
cd frontend
npm install
copy .env.example .env.local   # en Mac/Linux: cp .env.example .env.local
npm run dev
```

Abrir **http://localhost:3000** e iniciar sesión.

## Credenciales de prueba

Por seguridad, **las contraseñas no se guardan en este repositorio**. El comando `npm run seed` crea estos usuarios con la contraseña definida en `SEED_PASSWORD` del archivo `.env`:

| Rol | Correo |
|-----|--------|
| Administrador | admin@cabezadealgodon.com |
| Médico general | medico.general@cabezadealgodon.com |
| Médico especialista | especialista@cabezadealgodon.com |
| Enfermería | enfermeria@cabezadealgodon.com |
| Fundación | fundacion@cabezadealgodon.com |
| Laboratorio | laboratorio@cabezadealgodon.com |
| Farmacia | farmacia@cabezadealgodon.com |
| Familiar responsable | familiar@cabezadealgodon.com |

La contraseña de prueba se entrega al auditor SQA por un canal privado.

## Ejecutar las pruebas automatizadas

Las pruebas simulan la base de datos, por lo que **no necesitan SQL Server**:

```bash
cd backend
npm install
npm test
```

Resultado esperado: `Tests: 51 passed`.

## Permisos por rol

Los ocho roles salen del enunciado y del análisis (se agregó Enfermería, que acompaña al interno a la cita).

| Acción | Admin | Méd. general | Especialista | Enfermería | Fundación | Laboratorio | Farmacia | Familiar |
|--------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| Gestionar usuarios | ✔ | | | | | | | |
| Ver ficha del interno (incluye psicopatologías) | ✔ | ✔ | ✔ | ✔ | | | | |
| Registrar / editar internos, egreso | ✔ | ✔ | | | | | | |

No existe registro público: solo el Administrador crea cuentas. Los permisos se validan en el backend (`backend/src/config/roles.js`), no solo ocultando botones. La Fundación, el Laboratorio y la Farmacia no tienen acceso a la ficha clínica.

## Endpoints principales de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/salud` | Verifica que la API esté encendida |
| POST | `/api/auth/login` | Inicia sesión y devuelve el token |
| GET | `/api/auth/perfil` | Datos del usuario con sesión |
| GET / POST | `/api/usuarios` | Listar / crear usuarios (Administrador) |
| PATCH | `/api/usuarios/:id/estado` | Activar o desactivar un usuario |
| GET / POST | `/api/residentes` | Listar (con `?buscar=` y `?estado=`) / registrar |
| GET / PUT | `/api/residentes/:id` | Ver / editar expediente |
| PATCH | `/api/residentes/:id/estado` | Cambiar estado (Activo, Egresado, Fallecido) |

Una petición con datos inválidos, un cuerpo que no es JSON o un identificador no numérico responde **400** con un mensaje, y el servidor sigue activo.

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `Failed to connect to localhost:1433` | TCP/IP no está habilitado o el servicio no se reinició (paso 2). |
| `Login failed for user 'asilo_app'` | Falta la autenticación mixta o la contraseña de `.env` no coincide. |
| El frontend dice "No hay conexión con el servidor" | El backend no está encendido o `NEXT_PUBLIC_API_URL` es incorrecta. |
| Instancia SQLEXPRESS no conecta | Escribir `DB_INSTANCE=SQLEXPRESS` en `.env` e iniciar el servicio *SQL Server Browser*. |

## Autor

Héctor — Análisis de Sistemas II
