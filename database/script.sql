/* =====================================================================
   Sistema de Gestión del Asilo de Ancianos "Cabeza de Algodón"
   Script de base de datos para Microsoft SQL Server (2019 / 2022)
   ---------------------------------------------------------------------
   Ejecutar completo en SQL Server Management Studio (F5).
   Crea la base de datos, las tablas, restricciones, índices, una vista
   de estado de cuenta y los datos de catálogo (roles, especialidades).
   Los usuarios de prueba NO se crean aquí: se generan con
   "npm run seed" en el backend, para que ninguna contraseña quede
   escrita en el repositorio.
   ===================================================================== */

IF DB_ID('AsiloCabezaAlgodon') IS NULL
    CREATE DATABASE AsiloCabezaAlgodon;
GO
USE AsiloCabezaAlgodon;
GO

/* ---------------------------------------------------------------------
   1. Seguridad: roles, usuarios y auditoría
   --------------------------------------------------------------------- */
CREATE TABLE roles (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombre      NVARCHAR(40)  NOT NULL UNIQUE,
    descripcion NVARCHAR(200) NULL
);

CREATE TABLE usuarios (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    nombres        NVARCHAR(80)  NOT NULL,
    apellidos      NVARCHAR(80)  NOT NULL,
    email          NVARCHAR(120) NOT NULL UNIQUE,
    password_hash  NVARCHAR(200) NOT NULL,
    rol_id         INT           NOT NULL REFERENCES roles(id),
    activo         BIT           NOT NULL DEFAULT 1,
    ultimo_acceso  DATETIME2     NULL,
    creado_en      DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE auditoria (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario_id   INT           NULL REFERENCES usuarios(id),
    accion       NVARCHAR(30)  NOT NULL,   -- LOGIN, LOGIN_FALLIDO, CREAR, EDITAR, CAMBIAR_ESTADO...
    tabla        NVARCHAR(60)  NULL,
    registro_id  INT           NULL,
    detalle      NVARCHAR(500) NULL,
    ip           NVARCHAR(45)  NULL,
    fecha        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
CREATE INDEX ix_auditoria_fecha ON auditoria(fecha);

/* ---------------------------------------------------------------------
   2. Residentes y familiares (relación muchos a muchos)
   --------------------------------------------------------------------- */
CREATE TABLE residentes (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    codigo               NVARCHAR(20)  NOT NULL UNIQUE,       -- RES-0001
    nombres              NVARCHAR(80)  NOT NULL,
    apellidos            NVARCHAR(80)  NOT NULL,
    dpi                  NVARCHAR(13)  NULL,
    fecha_nacimiento     DATE          NOT NULL,
    sexo                 CHAR(1)       NOT NULL CHECK (sexo IN ('M','F')),
    fecha_ingreso        DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    estado               NVARCHAR(20)  NOT NULL DEFAULT 'Activo'
                         CHECK (estado IN ('Activo','Egresado','Fallecido')),
    tipo_sangre          NVARCHAR(3)   NULL,
    alergias             NVARCHAR(300) NULL,
    condiciones_medicas  NVARCHAR(500) NULL,
    habitacion           NVARCHAR(10)  NULL,
    observaciones        NVARCHAR(500) NULL,
    creado_por           INT           NULL REFERENCES usuarios(id),
    creado_en            DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    actualizado_en       DATETIME2     NULL
);
-- DPI único solo cuando se registra (permite varios residentes sin DPI)
CREATE UNIQUE INDEX uq_residentes_dpi ON residentes(dpi) WHERE dpi IS NOT NULL;

CREATE TABLE familiares (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombres     NVARCHAR(80)  NOT NULL,
    apellidos   NVARCHAR(80)  NOT NULL,
    dpi         NVARCHAR(13)  NULL,
    telefono    NVARCHAR(15)  NOT NULL,
    email       NVARCHAR(120) NULL,
    direccion   NVARCHAR(200) NULL,
    usuario_id  INT           NULL REFERENCES usuarios(id)  -- acceso al portal (opcional)
);
CREATE UNIQUE INDEX uq_familiares_dpi     ON familiares(dpi)        WHERE dpi IS NOT NULL;
CREATE UNIQUE INDEX uq_familiares_usuario ON familiares(usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE residente_familiar (
    residente_id    INT          NOT NULL REFERENCES residentes(id),
    familiar_id     INT          NOT NULL REFERENCES familiares(id),
    parentesco      NVARCHAR(30) NOT NULL,
    es_responsable  BIT          NOT NULL DEFAULT 0,  -- responsable de pagos
    PRIMARY KEY (residente_id, familiar_id)
);

/* ---------------------------------------------------------------------
   3. Personal médico
   --------------------------------------------------------------------- */
CREATE TABLE especialidades (
    id      INT IDENTITY(1,1) PRIMARY KEY,
    nombre  NVARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE medicos (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    nombres          NVARCHAR(80) NOT NULL,
    apellidos        NVARCHAR(80) NOT NULL,
    colegiado        NVARCHAR(20) NULL,
    especialidad_id  INT          NOT NULL REFERENCES especialidades(id),
    tipo             NVARCHAR(10) NOT NULL CHECK (tipo IN ('Interno','Fundacion')),
    telefono         NVARCHAR(15) NULL,
    activo           BIT          NOT NULL DEFAULT 1,
    usuario_id       INT          NULL REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_medicos_colegiado ON medicos(colegiado)  WHERE colegiado IS NOT NULL;
CREATE UNIQUE INDEX uq_medicos_usuario   ON medicos(usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE enfermeros (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombres     NVARCHAR(80) NOT NULL,
    apellidos   NVARCHAR(80) NOT NULL,
    telefono    NVARCHAR(15) NULL,
    turno       NVARCHAR(10) NOT NULL CHECK (turno IN ('Matutino','Vespertino','Nocturno')),
    activo      BIT          NOT NULL DEFAULT 1,
    usuario_id  INT          NULL REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_enfermeros_usuario ON enfermeros(usuario_id) WHERE usuario_id IS NOT NULL;

/* ---------------------------------------------------------------------
   4. Atención médica
   - Evaluación interna: la hace el médico del asilo, NO requiere cita.
   - Consulta especializada: solicitud -> cita con la fundación.
   --------------------------------------------------------------------- */
CREATE TABLE evaluaciones_medicas (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    residente_id       INT           NOT NULL REFERENCES residentes(id),
    medico_id          INT           NOT NULL REFERENCES medicos(id),
    fecha              DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    motivo             NVARCHAR(300) NOT NULL,
    presion_arterial   NVARCHAR(10)  NULL,
    temperatura        DECIMAL(4,1)  NULL,
    peso_kg            DECIMAL(5,2)  NULL,
    diagnostico        NVARCHAR(500) NULL,
    observaciones      NVARCHAR(500) NULL
);

CREATE TABLE solicitudes_medicas (
    id                     INT IDENTITY(1,1) PRIMARY KEY,
    residente_id           INT           NOT NULL REFERENCES residentes(id),
    evaluacion_id          INT           NULL REFERENCES evaluaciones_medicas(id),
    medico_solicitante_id  INT           NOT NULL REFERENCES medicos(id),
    especialidad_id        INT           NOT NULL REFERENCES especialidades(id),
    motivo                 NVARCHAR(500) NOT NULL,
    prioridad              NVARCHAR(10)  NOT NULL DEFAULT 'Normal'
                           CHECK (prioridad IN ('Normal','Urgente')),
    estado                 NVARCHAR(15)  NOT NULL DEFAULT 'Pendiente'
                           CHECK (estado IN ('Pendiente','En revision','Aprobada','Rechazada','Programada','Atendida')),
    motivo_rechazo         NVARCHAR(300) NULL,
    fecha_solicitud        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE citas_medicas (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    solicitud_id     INT           NOT NULL UNIQUE REFERENCES solicitudes_medicas(id),
    medico_id        INT           NOT NULL REFERENCES medicos(id),
    enfermero_id     INT           NULL REFERENCES enfermeros(id),   -- acompañante
    fecha_hora       DATETIME2     NOT NULL,
    lugar            NVARCHAR(150) NULL,
    estado           NVARCHAR(15)  NOT NULL DEFAULT 'Programada'
                     CHECK (estado IN ('Programada','Realizada','Cancelada','No asistio')),
    costo            DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
    resultado        NVARCHAR(1000) NULL
);

CREATE TABLE examenes_laboratorio (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    residente_id     INT           NOT NULL REFERENCES residentes(id),
    evaluacion_id    INT           NULL REFERENCES evaluaciones_medicas(id),
    cita_id          INT           NULL REFERENCES citas_medicas(id),
    tipo_examen      NVARCHAR(100) NOT NULL,
    fecha_solicitud  DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    fecha_resultado  DATE          NULL,
    resultado        NVARCHAR(1000) NULL,
    costo            DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
    estado           NVARCHAR(15)  NOT NULL DEFAULT 'Solicitado'
                     CHECK (estado IN ('Solicitado','Completado','Cancelado'))
);

/* ---------------------------------------------------------------------
   5. Medicamentos, recetas y administración
   --------------------------------------------------------------------- */
CREATE TABLE medicamentos (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    nombre         NVARCHAR(100) NOT NULL,
    presentacion   NVARCHAR(50)  NOT NULL DEFAULT N'Tableta',  -- tableta, jarabe, inyección
    concentracion  NVARCHAR(30)  NOT NULL DEFAULT N'',         -- 500 mg
    stock          INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo   INT           NOT NULL DEFAULT 0,
    precio_unidad  DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_medicamento UNIQUE (nombre, presentacion, concentracion)
);

CREATE TABLE recetas (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    residente_id   INT       NOT NULL REFERENCES residentes(id),
    medico_id      INT       NOT NULL REFERENCES medicos(id),
    evaluacion_id  INT       NULL REFERENCES evaluaciones_medicas(id),
    cita_id        INT       NULL REFERENCES citas_medicas(id),
    fecha          DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE receta_detalle (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    receta_id       INT           NOT NULL REFERENCES recetas(id),
    medicamento_id  INT           NOT NULL REFERENCES medicamentos(id),
    dosis           NVARCHAR(50)  NOT NULL,
    frecuencia      NVARCHAR(50)  NOT NULL,   -- cada 8 horas
    duracion_dias   INT           NULL,
    indicaciones    NVARCHAR(300) NULL
);

CREATE TABLE administracion_medicamentos (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    receta_detalle_id  INT           NOT NULL REFERENCES receta_detalle(id),
    enfermero_id       INT           NOT NULL REFERENCES enfermeros(id),
    fecha_hora         DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    observaciones      NVARCHAR(300) NULL
);

/* ---------------------------------------------------------------------
   6. Finanzas: cuotas, cargos, pagos y pagos a la fundación
   Saldo del residente = SUM(cargos) - SUM(pagos)  (ver vista)
   --------------------------------------------------------------------- */
CREATE TABLE cuotas (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    residente_id    INT           NOT NULL REFERENCES residentes(id),
    monto_mensual   DECIMAL(10,2) NOT NULL CHECK (monto_mensual > 0),
    vigente_desde   DATE          NOT NULL,
    activa          BIT           NOT NULL DEFAULT 1
);

CREATE TABLE cargos (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    residente_id  INT           NOT NULL REFERENCES residentes(id),
    tipo          NVARCHAR(15)  NOT NULL
                  CHECK (tipo IN ('Cuota','Consulta','Examen','Medicamento','Otro')),
    concepto      NVARCHAR(200) NOT NULL,
    monto         DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    periodo       CHAR(7)       NULL,       -- 2026-10 (para cuotas)
    cita_id       INT           NULL REFERENCES citas_medicas(id),
    examen_id     INT           NULL REFERENCES examenes_laboratorio(id),
    fecha         DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE)
);

CREATE TABLE pagos (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    residente_id    INT           NOT NULL REFERENCES residentes(id),
    familiar_id     INT           NULL REFERENCES familiares(id),   -- quién pagó
    monto           DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    metodo          NVARCHAR(15)  NOT NULL
                    CHECK (metodo IN ('Efectivo','Transferencia','Deposito','Tarjeta')),
    numero_recibo   NVARCHAR(20)  NOT NULL UNIQUE,
    fecha           DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    observaciones   NVARCHAR(300) NULL,
    registrado_por  INT           NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE pagos_fundacion (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    cita_id       INT           NULL REFERENCES citas_medicas(id),
    examen_id     INT           NULL REFERENCES examenes_laboratorio(id),
    monto         DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    fecha         DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    comprobante   NVARCHAR(30)  NULL,
    CONSTRAINT ck_pago_fundacion_origen CHECK (cita_id IS NOT NULL OR examen_id IS NOT NULL)
);

/* ---------------------------------------------------------------------
   7. Notificaciones a familiares
   --------------------------------------------------------------------- */
CREATE TABLE notificaciones (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    familiar_id   INT           NOT NULL REFERENCES familiares(id),
    residente_id  INT           NULL REFERENCES residentes(id),
    tipo          NVARCHAR(20)  NOT NULL
                  CHECK (tipo IN ('Cita','Resultado','Pago','Emergencia','General')),
    mensaje       NVARCHAR(500) NOT NULL,
    canal         NVARCHAR(10)  NOT NULL DEFAULT 'Email' CHECK (canal IN ('Email','SMS')),
    estado        NVARCHAR(10)  NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado IN ('Pendiente','Enviada','Fallida')),
    intentos      INT           NOT NULL DEFAULT 0,
    creada_en     DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    enviada_en    DATETIME2     NULL
);
GO

/* ---------------------------------------------------------------------
   8. Índices de búsqueda frecuente
   --------------------------------------------------------------------- */
CREATE INDEX ix_residentes_apellidos ON residentes(apellidos, nombres);
CREATE INDEX ix_solicitudes_estado   ON solicitudes_medicas(estado);
CREATE INDEX ix_citas_fecha          ON citas_medicas(fecha_hora);
CREATE INDEX ix_cargos_residente     ON cargos(residente_id);
CREATE INDEX ix_pagos_residente      ON pagos(residente_id);
GO

/* ---------------------------------------------------------------------
   9. Vista: estado de cuenta por residente
   --------------------------------------------------------------------- */
CREATE VIEW v_estado_cuenta AS
SELECT r.id AS residente_id,
       r.codigo,
       r.nombres + N' ' + r.apellidos AS residente,
       ISNULL(c.total_cargos, 0) AS total_cargos,
       ISNULL(p.total_pagos, 0)  AS total_pagos,
       ISNULL(c.total_cargos, 0) - ISNULL(p.total_pagos, 0) AS saldo
FROM residentes r
LEFT JOIN (SELECT residente_id, SUM(monto) AS total_cargos FROM cargos GROUP BY residente_id) c
       ON c.residente_id = r.id
LEFT JOIN (SELECT residente_id, SUM(monto) AS total_pagos FROM pagos GROUP BY residente_id) p
       ON p.residente_id = r.id;
GO

/* ---------------------------------------------------------------------
   10. Datos de catálogo
   --------------------------------------------------------------------- */
INSERT INTO roles (nombre, descripcion) VALUES
 (N'Administrador', N'Acceso total, gestiona usuarios y configuración'),
 (N'Recepcion',     N'Registra residentes y familiares'),
 (N'Medico',        N'Evaluaciones, solicitudes, recetas y resultados'),
 (N'Enfermeria',    N'Administración de medicamentos y acompañamiento'),
 (N'Contabilidad',  N'Cuotas, cargos, pagos y estados de cuenta'),
 (N'Familiar',      N'Consulta la información de su familiar');

INSERT INTO especialidades (nombre) VALUES
 (N'Medicina general'), (N'Cardiología'), (N'Geriatría'), (N'Neurología'),
 (N'Traumatología'), (N'Oftalmología'), (N'Odontología'), (N'Psicología');
GO

PRINT 'Base de datos AsiloCabezaAlgodon creada correctamente.';
