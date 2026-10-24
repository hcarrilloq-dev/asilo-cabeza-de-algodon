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
│   ├── script.sql        Script de la base de datos (borra y crea, con datos de ejemplo)
│   ├── respaldo.sql      Respaldo completo (.bak)
│   └── restaurar.sql     Restauración desde el respaldo
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
| Ficha del interno (psicopatologías, medicamentos de cajón, historial médico) | Implementado |
| Familiares y familiar responsable de pagos | Implementado |
| Solicitudes del médico general con enfermero(a) acompañante | Implementado |
| Asignación de médico y horario por la fundación | Implementado |
| Visita médica (diagnóstico, exámenes, medicamentos, cierre) | Implementado |
| Laboratorio (resultados) y farmacia (entregas) | Implementado |
| Enfermería (aplicación de medicamentos) | Implementado |
| Caja: cargos con descuento, pagos, cuotas, donaciones, gastos, deuda con la fundación | Implementado |
| Correo al familiar al crear la solicitud (con reintento si falla) | Implementado |
| Portal del familiar (estado de cuenta y citas) | Implementado |
| Siete reportes del enunciado (con impresión o PDF) | Implementado |
| Respaldo y restauración de la base de datos | Implementado |

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

2. Abrir `database/script.sql` en SSMS y ejecutarlo completo (**F5**). Desde la línea de comandos: `sqlcmd -S localhost\SQLEXPRESS -E -I -f 65001 -i database\script.sql` (`-I` es obligatorio por los índices filtrados; `-f 65001` respeta las tildes). Crea la base `AsiloCabezaAlgodon` con sus tablas, vistas, catálogos y datos de ejemplo, y da permisos al usuario `asilo_app`.

> **Atención:** si la base ya existe, el script la borra y la crea de nuevo. Sirve para instalar desde cero o reiniciar el ambiente de pruebas. Después de ejecutarlo hay que correr `npm run seed` otra vez.

### 4. Configurar y levantar el backend

```bash
cd backend
npm install
copy .env.example .env      # en Mac/Linux: cp .env.example .env
```

Abrir `backend/.env` y completar como mínimo `DB_PASSWORD` (la del paso 3), `JWT_SECRET` (cualquier texto largo) y `SEED_PASSWORD` (contraseña de los usuarios de prueba). Si SQL Server es una instancia con nombre (por ejemplo `SQLEXPRESS`), escribir `DB_INSTANCE=SQLEXPRESS`.

Opcional: para que el sistema envíe los correos al familiar, completar las variables `SMTP_*` (con Gmail se usa `smtp.gmail.com`, puerto 587 y una *contraseña de aplicación*). Si se dejan vacías, los correos quedan como **Pendiente** y se pueden reintentar desde el menú *Correos a familiares*.

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

## Respaldo y restauración

1. **Respaldar:** abrir `database/respaldo.sql` en SSMS y ejecutarlo (**F5**). Crea `AsiloCabezaAlgodon.bak` en la carpeta de respaldos de SQL Server y muestra la ruta exacta, por ejemplo `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\AsiloCabezaAlgodon.bak`.
2. **Restaurar:** detener el backend, abrir `database/restaurar.sql` y ejecutarlo (**F5**). Reemplaza los datos actuales por los del respaldo. Luego encender el backend otra vez.

Prueba de recuperación: respaldar, borrar o cambiar un dato de prueba, restaurar y comprobar que el dato vuelve.

## Reportes

Menú **Reportes** (Administrador; el Médico general ve los tres reportes médicos). Cada reporte se filtra por rango de fechas y, opcionalmente, por interno, y se puede imprimir o guardar como PDF desde el botón del reporte.

| Reporte | Contenido |
|---------|-----------|
| Costos de cada cita por paciente | Consulta, exámenes y medicamentos de cada cita, con estadísticas por paciente y por especialidad |
| Análisis médicos por paciente | Ficha médica, motivo de cada atención, exámenes, diagnóstico y medicamentos |
| Cobros por paciente | Cargos (con los gastos médicos como detalle y el descuento de la fundación) y pagos recibidos |
| Pagos a la fundación | Pagos realizados y deuda pendiente |
| Entradas | Donaciones (por tipo de donante) y cobros |
| Exámenes realizados por paciente | Exámenes con resultado y costo |
| Medicamentos aplicados por paciente | Indicados, entregados y aplicaciones de enfermería |

## Ejecutar las pruebas automatizadas

Las pruebas simulan la base de datos, por lo que **no necesitan SQL Server**:

```bash
cd backend
npm install
npm test
```

Resultado esperado: `Tests: 96 passed`.

### Pruebas de integración contra la base real

Además de las pruebas con la base simulada, hay pruebas que se ejecutan **contra SQL Server** (fechas opcionales vacías y altas simultáneas de internos). Requieren la base creada, `npm run seed` y el `.env` configurado:

```bash
cd backend
npm run test:integracion
```

Crean registros marcados con `PRUEBA-INT` y los borran al terminar.

## Permisos por rol

Los ocho roles salen del enunciado y del análisis (se agregó Enfermería, que acompaña al interno a la cita).

| Rol | Qué hace en el sistema |
|-----|------------------------|
| Administrador | Usuarios, internos, familiares, caja completa, correos y configuración (descuentos y catálogos) |
| Médico general | Fichas de internos, historial médico y solicitudes a especialistas con enfermero(a) acompañante |
| Médico especialista | Sus citas; abre la visita desde la cita, ve la ficha, registra diagnóstico, exámenes y medicamentos |
| Enfermería | Fichas, citas que acompaña y registro de aplicación de medicamentos |
| Fundación | Solicitudes por asignar (sin ficha clínica) y cuenta del asilo con la fundación |
| Laboratorio | Exámenes asignados en las visitas: registra resultado y precio (sin diagnóstico ni ficha) |
| Farmacia | Medicamentos indicados en las visitas: registra la entrega (sin diagnóstico ni ficha) |
| Familiar responsable | Estado de cuenta y citas de su familiar |

No existe registro público: solo el Administrador crea cuentas. El inicio de sesión de una cuenta se bloquea 15 minutos después de **10 intentos fallidos con esa cuenta**; el resto del personal puede seguir entrando aunque comparta la conexión. Como protección adicional, una conexión se bloquea tras 50 intentos fallidos con cuentas distintas. Los ingresos correctos no cuentan. Los permisos se validan en el backend (`backend/src/config/roles.js`), no solo ocultando botones.

## Reglas de negocio implementadas

- No hay visita sin cita: la visita se abre desde la cita que asignó la fundación, y la cita solo desde una solicitud del médico general.
- Una visita no se puede cerrar sin diagnóstico, y una vez cerrada no se modifica.
- Una receta exige medicamento, cantidad entera mayor que cero, dosis, frecuencia y tiempo de aplicación.
- La consulta, cada examen y cada medicamento entregado generan un cargo a la cuenta del familiar responsable **con el descuento de la fundación** (configurable). Lo mismo se registra como deuda con la fundación por cita.
- Los pagos no aceptan montos negativos, cero, con más de 2 decimales ni mayores que el saldo del cargo. Un pago enviado dos veces (doble clic) se registra una sola vez.
- Estados de los cargos: Pendiente, Parcial, Cancelado y Vencido (al pasar la fecha de vencimiento).
- Al crear una solicitud se guarda un correo para el familiar responsable; si no se puede enviar, la solicitud igual se guarda y el correo queda pendiente para reenvío.

## Endpoints principales de la API

| Ruta | Descripción |
|------|-------------|
| `POST /api/auth/login`, `GET /api/auth/perfil` | Inicio de sesión y datos del usuario |
| `/api/usuarios` | Usuarios (Administrador) |
| `/api/residentes`, `/api/residentes/:id/historial` | Fichas de internos e historial médico |
| `/api/familiares`, `/api/residentes/:id/familiares` | Familiares y vínculo con el interno |
| `/api/solicitudes`, `POST /api/solicitudes/:id/asignar` | Solicitudes a especialistas y asignación de la fundación |
| `/api/citas`, `POST /api/citas/:id/visita` | Citas y apertura de la visita médica |
| `/api/visitas/:id` (+ `/examenes`, `/medicamentos`, `/cerrar`) | Visita médica |
| `/api/laboratorio/examenes`, `/api/farmacia/medicamentos`, `/api/enfermeria/medicamentos` | Laboratorio, farmacia y enfermería |
| `/api/caja/...` | Cargos, pagos, cuotas, donaciones, gastos, fundación y resumen |
| `/api/portal` | Portal del familiar |
| `/api/notificaciones` | Correos a familiares y reenvío |
| `/api/reportes/...` | Los siete reportes |
| `/api/catalogos` | Especialidades, médicos, enfermeros, medicamentos y descuentos |

Una petición con datos inválidos, un cuerpo que no es JSON o un identificador no numérico responde **400** con un mensaje, y el servidor sigue activo.

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `Failed to connect to localhost:1433` | TCP/IP no está habilitado o el servicio no se reinició (paso 2). |
| `Login failed for user 'asilo_app'` | Falta la autenticación mixta o la contraseña de `.env` no coincide. |
| El frontend dice "No hay conexión con el servidor" | El backend no está encendido o `NEXT_PUBLIC_API_URL` es incorrecta. |
| Instancia SQLEXPRESS no conecta | Escribir `DB_INSTANCE=SQLEXPRESS` en `.env` e iniciar el servicio *SQL Server Browser*. |

## Mejoras futuras (aceptadas por el SQA)

- **H-15:** guardar la sesión en una cookie `HttpOnly` en lugar de `localStorage`.
- **H-20:** paginar los listados y reportes largos.

## Autor

Héctor — Análisis de Sistemas II
