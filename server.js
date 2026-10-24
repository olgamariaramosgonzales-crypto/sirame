//server.js
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");


const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "sirame_inframen_cambia_este_secreto";
if (!process.env.JWT_SECRET)
  console.warn("ADVERTENCIA: define la variable JWT_SECRET antes de entregar el sistema");
const DB_NAME = process.env.DB_NAME || "sirame_sistema";

const FOTOS_DIR = path.join(__dirname, "fotos");
fs.mkdirSync(FOTOS_DIR, { recursive: true });

const T = {
  usuario: {
    tabla: "Usuario",
    id: "IdUsuario",
    nombre: "Nombre_Completo",
    cargo: "Cargo",
    correo: "Correo_Electronico",
    usuario: "Usuario_Acceso",
    clave: "Contrasena",
    rol: "Rol",
  },
  tipo: { tabla: "TipoEquipo", id: "IdTipoEquipo", nombre: "Nombre_Tipo" },
  ubicacion: { tabla: "Ubicacion", id: "IdUbicacion", nombre: "Nombre_Ubicacion" },
  equipo: {
    tabla: "Equipo",
    num: "NumInventario",
    nombre: "Nombre_Equipo",
    descripcion: "Descripcion",
    tipo: "IdTipoEquipo",
    ubicacion: "IdUbicacion",
    estado: "Estado_Conservacion",
    foto: "Foto",
  },
  traslado: {
    tabla: "Traslado",
    id: "IdTraslado",
    num: "NumInventario",
    origen: "Ubicacion_Origen",
    destino: "Ubicacion_Destino",
    motivo: "Motivo_Traslado",
    fecha: "Fecha_Traslado",
    usuario: "IdUsuario",
  },
  mantenimiento: {
    tabla: "HistorialMantenimiento",
    id: "IdMantenimiento",
    num: "NumInventario",
    motivo: "Motivo_Mantenimiento",
    ingreso: "Fecha_Ingreso",
    salida: "Fecha_Salida",
    usuario: "IdUsuario",
  },
  baja: {
    tabla: "Baja",
    id: "IdBaja",
    num: "NumInventario",
    motivo: "Motivo_Baja",
    fecha: "Fecha_Baja",
    usuario: "IdUsuario",
  },
  incidencia: {
    tabla: "Incidencia",
    id: "IdIncidencia",
    num: "NumInventario",
    usuario: "IdUsuario",
    descripcion: "Descripcion",
    fecha: "Fecha_Reporte",
    estado: "Estado",
  },
};

const ROLES = ["Profesor", "Coordinador", "Director", "Administración"];
const ESTADOS = ["Bueno", "Dañado", "En mantenimiento"];
const ESTADOS_INCIDENCIA = ["Pendiente", "En proceso", "Resuelta"];

const q = (n) => "`" + n + "`";
const esHash = (s) => /^\$2[aby]\$/.test(s);

function normalizarRol(rol) {
  const r = String(rol || "")
    .trim()
    .toLowerCase()
    .replace(/ó/g, "o")
    .replace(/í/g, "i");
  if (r === "administracion") return "Administración";
  if (r === "director") return "Director";
  if (r === "coordinador") return "Coordinador";
  return "Profesor";
}

// Devuelve el rol válido (con su ortografía correcta) o null si no existe.
// A diferencia de normalizarRol, NO convierte textos desconocidos en "Profesor".
const sinAcento = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
const rolExacto = (r) => ROLES.find((x) => sinAcento(x) === sinAcento(r)) || null;

// ---------- Validaciones (límites y caracteres permitidos) ----------
const LET = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const RE = {
  nombre: new RegExp(`^[${LET}][${LET} .'-]*$`),
  cargo: new RegExp(`^[${LET}][${LET} .,/-]*$`),
  correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  usuario: /^[A-Za-z0-9._-]+$/,
  titulo: /^[\p{L}\p{N}][\p{L}\p{N} .,\-\/()#+'"]*$/u,
};
const limpia = (s) => String(s || "").replace(/\s+/g, " ").trim();
// ¿hay n o más caracteres iguales seguidos? (000000, aaaaaa...)
const repetido = (s, n) => new RegExp(`(.)\\1{${n - 1},}`, "u").test(s);

function validarTexto(valor, { etiqueta, min = 1, max, re, msgRe, repite = 4 }) {
  if (valor.length < min) return `${etiqueta} debe tener al menos ${min} caracteres`;
  if (valor.length > max) return `${etiqueta} no puede pasar de ${max} caracteres`;
  if (re && !re.test(valor)) return msgRe || `${etiqueta} contiene caracteres no válidos`;
  if (repite && repetido(valor, repite))
    return `${etiqueta} tiene demasiados caracteres repetidos seguidos`;
  return null;
}

function validarClave(c) {
  if (c.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (c.length > 64) return "La contraseña no puede pasar de 64 caracteres";
  if (/\s/.test(c)) return "La contraseña no puede tener espacios";
  if (!/[A-Za-z]/.test(c) || !/\d/.test(c)) return "La contraseña debe combinar letras y números";
  return null;
}

function validarPersona({ nombre, cargo, correo, usuario, clave }) {
  return (
    validarTexto(nombre, { etiqueta: "El nombre", min: 3, max: 60, re: RE.nombre, msgRe: "El nombre solo puede tener letras y espacios" }) ||
    validarTexto(cargo, { etiqueta: "El cargo", min: 3, max: 40, re: RE.cargo, msgRe: "El cargo solo puede tener letras y espacios" }) ||
    validarTexto(correo, { etiqueta: "El correo", min: 6, max: 80, re: RE.correo, msgRe: "Correo no válido", repite: 0 }) ||
    validarTexto(usuario, { etiqueta: "El usuario", min: 4, max: 20, re: RE.usuario, msgRe: "El usuario solo puede tener letras, números, punto, guion y guion bajo (sin espacios)" }) ||
    validarClave(clave)
  );
}

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

// Seguridad básica: cabeceras y límite de intentos de login
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
});
const intentos = new Map();
function limiteLogin(req, res, next) {
  const ahora = Date.now();
  const v = intentos.get(req.ip) || { n: 0, t: ahora };
  if (ahora - v.t > 15 * 60 * 1000) {
    v.n = 0;
    v.t = ahora;
  }
  if (v.n >= 10) {
    return res
      .status(429)
      .json({ status: "fail", mensaje: "Demasiados intentos. Intenta de nuevo en 15 minutos." });
  }
  v.n++;
  intentos.set(req.ip, v);
  next();
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

app.use("/fotos", express.static(FOTOS_DIR));
// Página web (HTML/CSS/JS). Debe ir ANTES del manejador 404 del final.
app.use(express.static(path.join(__dirname, "public")));

const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    if (res.headersSent) return res.end();
    res.status(500).json({ status: "error", mensaje: "Error interno del servidor" });
  });

const EXT_IMAGEN = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FOTOS_DIR),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!EXT_IMAGEN.includes(ext)) ext = ".jpg";
    cb(null, `equipo_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith("image/") || EXT_IMAGEN.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("El archivo debe ser una imagen"));
    }
  },
});

function subirFoto(campo) {
  const mw = upload.single(campo);
  return (req, res, next) =>
    mw(req, res, (err) => {
      if (err) return res.status(400).json({ status: "error", mensaje: err.message });
      next();
    });
}

function borrarFoto(req) {
  if (req.file) fs.unlink(path.join(FOTOS_DIR, req.file.filename), () => {});
}

function auth(req, res, next) {
  const cab = req.headers.authorization || "";
  const token = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if (!token) {
    return res
      .status(401)
      .json({ status: "error", mensaje: "Sesión no válida. Inicia sesión de nuevo." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res
      .status(401)
      .json({ status: "error", mensaje: "Tu sesión expiró. Inicia sesión de nuevo." });
  }
}

function solo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res
        .status(403)
        .json({ status: "error", mensaje: "No tienes permiso para realizar esta acción" });
    }
    next();
  };
}

// ================= LOGIN =================
app.post(
  "/login",
  limiteLogin,
  ah(async (req, res) => {
    const usuario = String(req.body.usuario || "").trim();
    const clave = String(req.body.clave || "").trim();
    if (!usuario || !clave) {
      return res.json({ status: "fail", mensaje: "Usuario y contraseña son obligatorios" });
    }
    if (usuario.length > 50 || clave.length > 100)
      return res.json({ status: "fail", mensaje: "Usuario o contraseña incorrectos" });

    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT ${q(U.id)} AS id, ${q(U.usuario)} AS usuario, ${q(U.clave)} AS clave, ${q(U.rol)} AS rol
       FROM ${q(U.tabla)} WHERE ${q(U.usuario)} = ?`,
      [usuario]
    );
    const u = rows[0];

    let ok = false;
    if (u && typeof u.clave === "string" && u.clave.trim()) {
      const guardada = u.clave.trim();
      if (esHash(guardada)) {
        ok = bcrypt.compareSync(clave, guardada);
      } else if (guardada === clave) {
        ok = true;
        await pool.query(`UPDATE ${q(U.tabla)} SET ${q(U.clave)} = ? WHERE ${q(U.id)} = ?`, [
          bcrypt.hashSync(clave, 10),
          u.id,
        ]);
      }
    }

    if (!ok) return res.json({ status: "fail", mensaje: "Usuario o contraseña incorrectos" });

    intentos.delete(req.ip);
    const rol = normalizarRol(u.rol);

    // ¿Tiene una solicitud de administrador pendiente?
    let solicitud = "";
    if (rol !== "Administración") {
      const [s] = await pool.query(
        "SELECT 1 FROM SolicitudRol WHERE IdUsuario = ? AND Estado = 'Pendiente' LIMIT 1",
        [u.id]
      );
      if (s.length) solicitud = "Pendiente";
    }

    const token = jwt.sign({ id: u.id, usuario: u.usuario, rol }, JWT_SECRET, {
      expiresIn: "12h",
    });
    res.json({ status: "ok", token, rol, usuario: u.usuario, solicitud });
  })
);

// ================= REGISTRO (público) =================
app.post(
  "/registro",
  ah(async (req, res) => {
    const nombre = limpia(req.body.nombre);
    const cargo = limpia(req.body.cargo);
    const correo = String(req.body.correo || "").trim().toLowerCase();
    const usuario = String(req.body.usuario || "").trim();
    const clave = String(req.body.clave || "").trim();
    // Seguridad: el registro público SIEMPRE crea un Profesor.
    // Si pidió ser administrador, se crea una solicitud que debe aprobar Administración.
    const rol = "Profesor";
    const solicitaAdmin = rolExacto(req.body.rol_solicitado) === "Administración";

    if (!nombre || !cargo || !correo || !usuario || !clave) {
      return res.json({
        status: "fail",
        mensaje: "Nombre, cargo, correo, usuario y contraseña son obligatorios",
      });
    }
    const errDatos = validarPersona({ nombre, cargo, correo, usuario, clave });
    if (errDatos) return res.json({ status: "fail", mensaje: errDatos });

    const U = T.usuario;
    const [existe] = await pool.query(
      `SELECT ${q(U.id)} FROM ${q(U.tabla)} WHERE ${q(U.usuario)} = ? OR ${q(U.correo)} = ?`,
      [usuario, correo]
    );
    if (existe.length > 0) {
      return res.json({ status: "fail", mensaje: "Ya existe un usuario con ese nombre o correo" });
    }

    const [ins] = await pool.query(
      `INSERT INTO ${q(U.tabla)}
       (${q(U.nombre)}, ${q(U.cargo)}, ${q(U.rol)}, ${q(U.correo)}, ${q(U.usuario)}, ${q(U.clave)})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, cargo, rol, correo, usuario, bcrypt.hashSync(clave, 10)]
    );

    if (solicitaAdmin) {
      await pool.query("INSERT INTO SolicitudRol (IdUsuario) VALUES (?)", [ins.insertId]);
      console.log(`Solicitud de administrador creada para el usuario "${usuario}" (id ${ins.insertId})`);
    }

    res.json({
      status: "ok",
      mensaje: solicitaAdmin
        ? "Cuenta creada como Profesor. Tu solicitud de administrador quedó pendiente."
        : "Usuario registrado correctamente",
    });
  })
);

// ================= USUARIOS (solo Admin / Director) =================
// Nota: la contraseña NUNCA se devuelve en ninguna consulta.
app.get(
  "/usuarios",
  auth,
  solo("Administración", "Director"),
  ah(async (req, res) => {
    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT ${q(U.id)} AS id, ${q(U.nombre)} AS nombre, ${q(U.cargo)} AS cargo,
              ${q(U.correo)} AS correo, ${q(U.usuario)} AS usuario, ${q(U.rol)} AS rol
       FROM ${q(U.tabla)} ORDER BY ${q(U.nombre)}`
    );
    // Roles siempre con la misma ortografía (así el selector marca el correcto)
    res.json({ status: "ok", data: rows.map((r) => ({ ...r, rol: normalizarRol(r.rol) })) });
  })
);

app.post(
  "/usuarios",
  auth,
  solo("Administración", "Director"),
  ah(async (req, res) => {
    const U = T.usuario;
    const nombre = limpia(req.body.nombre);
    const cargo = limpia(req.body.cargo);
    const correo = String(req.body.correo || "").trim().toLowerCase();
    const usuario = String(req.body.usuario || "").trim();
    const clave = String(req.body.clave || "").trim();
    const rol = rolExacto(req.body.rol);

    if (!nombre || !cargo || !correo || !usuario || !clave)
      return res.json({ status: "fail", mensaje: "Todos los campos son obligatorios" });
    const errDatos = validarPersona({ nombre, cargo, correo, usuario, clave });
    if (errDatos) return res.json({ status: "fail", mensaje: errDatos });
    if (!rol) return res.json({ status: "fail", mensaje: "Rol no válido" });
    if (rol === "Administración" && req.user.rol !== "Administración")
      return res.json({ status: "fail", mensaje: "Solo Administración puede crear administradores" });
    if (rol === "Director" || rol === "Coordinador") {
      const [[{ n }]] = await pool.query(
        `SELECT COUNT(*) AS n FROM ${q(U.tabla)} WHERE LOWER(TRIM(${q(U.rol)})) = ?`,
        [rol.toLowerCase()]
      );
      if (n > 0)
        return res.json({ status: "fail", mensaje: `Ya existe un ${rol}. Solo puede haber uno.` });
    }

    const [existe] = await pool.query(
      `SELECT ${q(U.id)} FROM ${q(U.tabla)} WHERE ${q(U.usuario)} = ? OR ${q(U.correo)} = ?`,
      [usuario, correo]
    );
    if (existe.length > 0)
      return res.json({ status: "fail", mensaje: "Ya existe un usuario con ese nombre o correo" });

    await pool.query(
      `INSERT INTO ${q(U.tabla)}
       (${q(U.nombre)}, ${q(U.cargo)}, ${q(U.rol)}, ${q(U.correo)}, ${q(U.usuario)}, ${q(U.clave)})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, cargo, rol, correo, usuario, bcrypt.hashSync(clave, 10)]
    );
    res.json({ status: "ok", mensaje: "Usuario creado correctamente" });
  })
);

// Cambiar rol de un usuario (Admin / Director)
app.put(
  "/usuarios/:id",
  auth,
  solo("Administración", "Director"),
  ah(async (req, res) => {
    const U = T.usuario;
    const id = parseInt(req.params.id, 10);
    const rol = rolExacto(req.body.rol);
    if (rol !== "Profesor" && rol !== "Administración")
      return res.json({ status: "fail", mensaje: "Solo se puede asignar Profesor o Administración" });
    if (id === req.user.id)
      return res.json({ status: "fail", mensaje: "No puedes cambiar tu propio rol" });
    if (rol === "Administración" && req.user.rol !== "Administración")
      return res.json({ status: "fail", mensaje: "Solo Administración puede asignar ese rol" });

    const [ex] = await pool.query(
      `SELECT ${q(U.rol)} AS rol FROM ${q(U.tabla)} WHERE ${q(U.id)} = ?`,
      [id]
    );
    if (!ex.length) return res.json({ status: "fail", mensaje: "El usuario no existe" });
    if (["Director", "Coordinador"].includes(normalizarRol(ex[0].rol)))
      return res.json({
        status: "fail",
        mensaje: "El rol de Director y Coordinador es fijo y no se puede cambiar",
      });
    if (normalizarRol(ex[0].rol) === "Administración" && req.user.rol !== "Administración")
      return res.json({ status: "fail", mensaje: "Solo Administración puede modificar a un administrador" });

    await pool.query(`UPDATE ${q(U.tabla)} SET ${q(U.rol)} = ? WHERE ${q(U.id)} = ?`, [rol, id]);

    // Si ahora es administrador, su solicitud pendiente queda como aprobada
    if (rol === "Administración") {
      await pool.query(
        `UPDATE SolicitudRol SET Estado = 'Aprobada', Fecha_Resolucion = NOW(), IdResolutor = ?
         WHERE IdUsuario = ? AND Estado = 'Pendiente'`,
        [req.user.id, id]
      );
    }
    res.json({ status: "ok", mensaje: "Rol actualizado" });
  })
);

app.delete(
  "/usuarios/:id",
  auth,
  solo("Administración"),
  ah(async (req, res) => {
    const U = T.usuario;
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id)
      return res.json({ status: "fail", mensaje: "No puedes eliminar tu propia cuenta" });
    const [objetivo] = await pool.query(
      `SELECT ${q(U.rol)} AS rol FROM ${q(U.tabla)} WHERE ${q(U.id)} = ?`,
      [id]
    );
    if (objetivo.length && ["Director", "Coordinador"].includes(normalizarRol(objetivo[0].rol)))
      return res.json({ status: "fail", mensaje: "No se puede eliminar al Director ni al Coordinador" });
    try {
      await pool.query("DELETE FROM SolicitudRol WHERE IdUsuario = ?", [id]);
      await pool.query(`DELETE FROM ${q(U.tabla)} WHERE ${q(U.id)} = ?`, [id]);
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2")
        return res.json({
          status: "fail",
          mensaje: "No se puede eliminar: el usuario tiene traslados, bajas o incidencias registradas",
        });
      throw err;
    }
    res.json({ status: "ok", mensaje: "Usuario eliminado" });
  })
);

// ================= SOLICITUDES DE ADMINISTRADOR (solo Administración) =================
app.get(
  "/solicitudes",
  auth,
  solo("Administración"),
  ah(async (req, res) => {
    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT s.IdSolicitud AS id, s.Fecha_Solicitud AS fecha,
              u.${q(U.nombre)} AS nombre, u.${q(U.cargo)} AS cargo,
              u.${q(U.correo)} AS correo, u.${q(U.usuario)} AS usuario
       FROM SolicitudRol s
       JOIN ${q(U.tabla)} u ON u.${q(U.id)} = s.IdUsuario
       WHERE s.Estado = 'Pendiente'
       ORDER BY s.Fecha_Solicitud`
    );
    res.json({ status: "ok", data: rows });
  })
);

// ids = arreglo de solicitudes, o null para todas las pendientes. Todo en una transacción.
async function resolver(ids, aprobar, adminId) {
  const U = T.usuario;
  const cn = await pool.getConnection();
  try {
    await cn.beginTransaction();
    const [pend] = await cn.query(
      "SELECT IdSolicitud AS id, IdUsuario AS uid FROM SolicitudRol WHERE Estado = 'Pendiente'" +
        (ids ? " AND IdSolicitud IN (?)" : ""),
      ids ? [ids] : []
    );
    if (pend.length) {
      if (aprobar)
        await cn.query(
          `UPDATE ${q(U.tabla)} SET ${q(U.rol)} = 'Administración' WHERE ${q(U.id)} IN (?)`,
          [pend.map((p) => p.uid)]
        );
      await cn.query(
        "UPDATE SolicitudRol SET Estado = ?, Fecha_Resolucion = NOW(), IdResolutor = ? WHERE IdSolicitud IN (?)",
        [aprobar ? "Aprobada" : "Rechazada", adminId, pend.map((p) => p.id)]
      );
    }
    await cn.commit();
    return pend.length;
  } catch (e) {
    await cn.rollback();
    throw e;
  } finally {
    cn.release();
  }
}

app.put(
  "/solicitudes/:id/aprobar",
  auth,
  solo("Administración"),
  ah(async (req, res) => {
    const n = await resolver([parseInt(req.params.id, 10)], true, req.user.id);
    if (!n) return res.json({ status: "fail", mensaje: "La solicitud no existe o ya fue resuelta" });
    res.json({ status: "ok", mensaje: "Solicitud aprobada" });
  })
);

app.put(
  "/solicitudes/:id/rechazar",
  auth,
  solo("Administración"),
  ah(async (req, res) => {
    const n = await resolver([parseInt(req.params.id, 10)], false, req.user.id);
    if (!n) return res.json({ status: "fail", mensaje: "La solicitud no existe o ya fue resuelta" });
    res.json({ status: "ok", mensaje: "Solicitud rechazada" });
  })
);

app.post(
  "/solicitudes/aprobar-todas",
  auth,
  solo("Administración"),
  ah(async (req, res) => {
    const n = await resolver(null, true, req.user.id);
    res.json({
      status: "ok",
      mensaje: n ? `${n} solicitud(es) aprobada(s)` : "No hay solicitudes pendientes",
    });
  })
);

// ================= CATÁLOGOS =================
function catalogo(ruta, C, rolesEscritura = []) {
  app.get(
    ruta,
    auth,
    ah(async (req, res) => {
      const [rows] = await pool.query(
        `SELECT ${q(C.id)} AS id, ${q(C.nombre)} AS nombre
         FROM ${q(C.tabla)} ORDER BY ${q(C.nombre)}`
      );
      res.json({ status: "ok", data: rows });
    })
  );

  if (rolesEscritura.length > 0) {
    app.post(
      ruta,
      auth,
      solo(...rolesEscritura),
      ah(async (req, res) => {
        const nombre = String(req.body.nombre || "").trim();
        const errNombre = validarTexto(nombre, { etiqueta: "El nombre", min: 3, max: 60, re: RE.titulo });
        if (errNombre) return res.json({ status: "fail", mensaje: errNombre });
        const [existe] = await pool.query(
          `SELECT ${q(C.id)} FROM ${q(C.tabla)} WHERE ${q(C.nombre)} = ?`,
          [nombre]
        );
        if (existe.length > 0)
          return res.json({ status: "fail", mensaje: "Ya existe ese registro" });
        await pool.query(`INSERT INTO ${q(C.tabla)} (${q(C.nombre)}) VALUES (?)`, [nombre]);
        res.json({ status: "ok", mensaje: "Registro creado" });
      })
    );

    app.put(
      `${ruta}/:id`,
      auth,
      solo(...rolesEscritura),
      ah(async (req, res) => {
        const nombre = String(req.body.nombre || "").trim();
        const id = parseInt(req.params.id, 10);
        const errNombre = validarTexto(nombre, { etiqueta: "El nombre", min: 3, max: 60, re: RE.titulo });
        if (errNombre) return res.json({ status: "fail", mensaje: errNombre });
        const [dup] = await pool.query(
          `SELECT ${q(C.id)} FROM ${q(C.tabla)} WHERE ${q(C.nombre)} = ? AND ${q(C.id)} <> ?`,
          [nombre, id]
        );
        if (dup.length > 0) return res.json({ status: "fail", mensaje: "Ya existe ese registro" });
        await pool.query(`UPDATE ${q(C.tabla)} SET ${q(C.nombre)} = ? WHERE ${q(C.id)} = ?`, [
          nombre,
          id,
        ]);
        res.json({ status: "ok", mensaje: "Registro actualizado" });
      })
    );

    app.delete(
      `${ruta}/:id`,
      auth,
      solo(...rolesEscritura),
      ah(async (req, res) => {
        try {
          await pool.query(`DELETE FROM ${q(C.tabla)} WHERE ${q(C.id)} = ?`, [
            parseInt(req.params.id, 10),
          ]);
        } catch (err) {
          if (err.code === "ER_ROW_IS_REFERENCED_2")
            return res.json({
              status: "fail",
              mensaje: "No se puede eliminar: está en uso por equipos o traslados",
            });
          throw err;
        }
        res.json({ status: "ok", mensaje: "Registro eliminado" });
      })
    );
  }
}

catalogo("/tipos-equipo", T.tipo, ["Administración", "Coordinador", "Director"]);
catalogo("/ubicaciones", T.ubicacion, ["Administración", "Coordinador", "Director"]);

// ================= EQUIPOS =================
app.get(
  "/equipos",
  auth,
  ah(async (req, res) => {
    const E = T.equipo;
    const TP = T.tipo;
    const UB = T.ubicacion;
    const [rows] = await pool.query(
      `SELECT e.${q(E.num)} AS num_inventario,
              e.${q(E.nombre)} AS nombre,
              e.${q(E.descripcion)} AS descripcion,
              t.${q(TP.nombre)} AS tipo,
              u.${q(UB.nombre)} AS ubicacion,
              e.${q(E.estado)} AS estado_conservacion,
              e.${q(E.foto)} AS foto_url
       FROM ${q(E.tabla)} e
       LEFT JOIN ${q(TP.tabla)} t ON t.${q(TP.id)} = e.${q(E.tipo)}
       LEFT JOIN ${q(UB.tabla)} u ON u.${q(UB.id)} = e.${q(E.ubicacion)}
       ORDER BY e.${q(E.nombre)}`
    );
    res.json({ status: "ok", data: rows });
  })
);

// Alta: SOLO Administración (según los permisos definidos)
app.post(
  "/equipos",
  auth,
  solo("Administración"),
  subirFoto("foto"),
  ah(async (req, res) => {
    const falla = (mensaje) => {
      borrarFoto(req);
      return res.json({ status: "fail", mensaje });
    };

    const num = String(req.body.num_inventario || "").trim();
    const nombre = String(req.body.nombre || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();
    const tipoId = parseInt(req.body.tipo_id, 10);
    const ubicacionId = parseInt(req.body.ubicacion_id, 10);
    const estado = String(req.body.estado_conservacion || "").trim();

    if (!num) return falla("El número de inventario es obligatorio");
    if (!/^\d{3}-\d{3}-\d{3,5}$/.test(num))
      return falla("El número de inventario debe tener el formato 123-001-0001");
    const errNombre = validarTexto(nombre, { etiqueta: "El nombre", min: 3, max: 60, re: RE.titulo });
    if (errNombre) return falla(errNombre);
    if (descripcion.length > 255) return falla("La descripción no puede pasar de 255 caracteres");
    if (descripcion && repetido(descripcion, 6))
      return falla("La descripción tiene demasiados caracteres repetidos seguidos");
    if (!tipoId) return falla("Selecciona un tipo de equipo");
    if (!ubicacionId) return falla("Selecciona una ubicación");
    if (!ESTADOS.includes(estado)) return falla("Estado de conservación no válido");

    const E = T.equipo;
    const [existe] = await pool.query(
      `SELECT ${q(E.num)} FROM ${q(E.tabla)} WHERE ${q(E.num)} = ?`,
      [num]
    );
    if (existe.length > 0) return falla("Ya existe un equipo con ese número de inventario");

    const foto = req.file ? `/fotos/${req.file.filename}` : null;

    try {
      await pool.query(
        `INSERT INTO ${q(E.tabla)}
         (${q(E.num)}, ${q(E.nombre)}, ${q(E.descripcion)}, ${q(E.tipo)}, ${q(E.ubicacion)}, ${q(E.estado)}, ${q(E.foto)})
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [num, nombre, descripcion || null, tipoId, ubicacionId, estado, foto]
      );
    } catch (err) {
      borrarFoto(req);
      throw err;
    }

    res.json({ status: "ok", mensaje: "Equipo registrado correctamente" });
  })
);

// Modificar datos del equipo (Coordinador / Director / Administración)
app.put(
  "/equipos/:num",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const E = T.equipo;
    const num = req.params.num;
    const nombre = String(req.body.nombre || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();
    const tipoId = parseInt(req.body.tipo_id, 10);
    const ubicacionId = parseInt(req.body.ubicacion_id, 10);

    const errNombre = validarTexto(nombre, { etiqueta: "El nombre", min: 3, max: 60, re: RE.titulo });
    if (errNombre) return res.json({ status: "fail", mensaje: errNombre });
    if (descripcion.length > 255 || (descripcion && repetido(descripcion, 6)))
      return res.json({
        status: "fail",
        mensaje: "Descripción no válida (máx. 255 caracteres y sin repeticiones excesivas)",
      });
    if (!tipoId || !ubicacionId)
      return res.json({ status: "fail", mensaje: "Tipo y ubicación son obligatorios" });

    await pool.query(
      `UPDATE ${q(E.tabla)}
       SET ${q(E.nombre)} = ?, ${q(E.descripcion)} = ?, ${q(E.tipo)} = ?, ${q(E.ubicacion)} = ?
       WHERE ${q(E.num)} = ?`,
      [nombre, descripcion || null, tipoId, ubicacionId, num]
    );
    res.json({ status: "ok", mensaje: "Equipo actualizado" });
  })
);

// Cambiar estado (Coordinador, Director, Administración)
app.put(
  "/equipos/:num/estado",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const E = T.equipo;
    const num = req.params.num;
    const estado = String(req.body.estado_conservacion || "").trim();
    if (!ESTADOS.includes(estado))
      return res.json({ status: "fail", mensaje: "Estado no válido" });

    await pool.query(
      `UPDATE ${q(E.tabla)} SET ${q(E.estado)} = ? WHERE ${q(E.num)} = ?`,
      [estado, num]
    );
    res.json({ status: "ok", mensaje: "Estado actualizado" });
  })
);

// ================= TRASLADOS =================
app.get(
  "/traslados",
  auth,
  ah(async (req, res) => {
    const TR = T.traslado;
    const UB = T.ubicacion;
    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT t.${q(TR.id)} AS id,
              t.${q(TR.num)} AS num_inventario,
              e.${q(T.equipo.nombre)} AS equipo,
              uo.${q(UB.nombre)} AS origen,
              ud.${q(UB.nombre)} AS destino,
              t.${q(TR.motivo)} AS motivo,
              t.${q(TR.fecha)} AS fecha,
              us.${q(U.nombre)} AS usuario
       FROM ${q(TR.tabla)} t
       LEFT JOIN ${q(T.equipo.tabla)} e ON e.${q(T.equipo.num)} = t.${q(TR.num)}
       LEFT JOIN ${q(UB.tabla)} uo ON uo.${q(UB.id)} = t.${q(TR.origen)}
       LEFT JOIN ${q(UB.tabla)} ud ON ud.${q(UB.id)} = t.${q(TR.destino)}
       LEFT JOIN ${q(U.tabla)} us ON us.${q(U.id)} = t.${q(TR.usuario)}
       ORDER BY t.${q(TR.fecha)} DESC, t.${q(TR.id)} DESC`
    );
    res.json({ status: "ok", data: rows });
  })
);

app.post(
  "/traslados",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const TR = T.traslado;
    const E = T.equipo;
    const num = String(req.body.num_inventario || "").trim();
    const origenId = parseInt(req.body.origen_id, 10);
    const destinoId = parseInt(req.body.destino_id, 10);
    const motivo = String(req.body.motivo || "").trim();

    if (!num) return res.json({ status: "fail", mensaje: "Selecciona un equipo" });
    if (!origenId || !destinoId)
      return res.json({ status: "fail", mensaje: "Origen y destino son obligatorios" });
    if (origenId === destinoId)
      return res.json({ status: "fail", mensaje: "El origen y el destino no pueden ser iguales" });
    const errMotivo = validarTexto(motivo, { etiqueta: "El motivo", min: 5, max: 255, repite: 6 });
    if (errMotivo) return res.json({ status: "fail", mensaje: errMotivo });

    await pool.query(
      `INSERT INTO ${q(TR.tabla)}
       (${q(TR.num)}, ${q(TR.origen)}, ${q(TR.destino)}, ${q(TR.motivo)}, ${q(TR.usuario)})
       VALUES (?, ?, ?, ?, ?)`,
      [num, origenId, destinoId, motivo, req.user.id]
    );

    // Actualiza la ubicación actual del equipo
    await pool.query(`UPDATE ${q(E.tabla)} SET ${q(E.ubicacion)} = ? WHERE ${q(E.num)} = ?`, [
      destinoId,
      num,
    ]);

    res.json({ status: "ok", mensaje: "Traslado registrado" });
  })
);

// ================= MANTENIMIENTOS =================
app.get(
  "/mantenimientos",
  auth,
  ah(async (req, res) => {
    const M = T.mantenimiento;
    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT m.${q(M.id)} AS id,
              m.${q(M.num)} AS num_inventario,
              e.${q(T.equipo.nombre)} AS equipo,
              m.${q(M.motivo)} AS motivo,
              m.${q(M.ingreso)} AS fecha_ingreso,
              m.${q(M.salida)} AS fecha_salida,
              us.${q(U.nombre)} AS usuario
       FROM ${q(M.tabla)} m
       LEFT JOIN ${q(T.equipo.tabla)} e ON e.${q(T.equipo.num)} = m.${q(M.num)}
       LEFT JOIN ${q(U.tabla)} us ON us.${q(U.id)} = m.${q(M.usuario)}
       ORDER BY m.${q(M.ingreso)} DESC, m.${q(M.id)} DESC`
    );
    res.json({ status: "ok", data: rows });
  })
);

app.post(
  "/mantenimientos",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const M = T.mantenimiento;
    const E = T.equipo;
    const num = String(req.body.num_inventario || "").trim();
    const motivo = String(req.body.motivo || "").trim();

    if (!num || !motivo)
      return res.json({ status: "fail", mensaje: "Equipo y motivo son obligatorios" });
    const errMotivo = validarTexto(motivo, { etiqueta: "El motivo", min: 5, max: 255, repite: 6 });
    if (errMotivo) return res.json({ status: "fail", mensaje: errMotivo });

    await pool.query(
      `INSERT INTO ${q(M.tabla)} (${q(M.num)}, ${q(M.motivo)}, ${q(M.usuario)})
       VALUES (?, ?, ?)`,
      [num, motivo, req.user.id]
    );
    await pool.query(
      `UPDATE ${q(E.tabla)} SET ${q(E.estado)} = 'En mantenimiento' WHERE ${q(E.num)} = ?`,
      [num]
    );
    res.json({ status: "ok", mensaje: "Mantenimiento registrado" });
  })
);

app.put(
  "/mantenimientos/:id/cerrar",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const M = T.mantenimiento;
    const E = T.equipo;
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.query(
      `SELECT ${q(M.num)} AS num FROM ${q(M.tabla)} WHERE ${q(M.id)} = ?`,
      [id]
    );
    if (rows.length === 0) return res.json({ status: "fail", mensaje: "No existe" });

    await pool.query(
      `UPDATE ${q(M.tabla)} SET ${q(M.salida)} = CURRENT_DATE WHERE ${q(M.id)} = ?`,
      [id]
    );
    await pool.query(
      `UPDATE ${q(E.tabla)} SET ${q(E.estado)} = 'Bueno' WHERE ${q(E.num)} = ?`,
      [rows[0].num]
    );
    res.json({ status: "ok", mensaje: "Mantenimiento cerrado" });
  })
);

// ================= BAJAS =================
app.get(
  "/bajas",
  auth,
  ah(async (req, res) => {
    const B = T.baja;
    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT b.${q(B.id)} AS id,
              b.${q(B.num)} AS num_inventario,
              e.${q(T.equipo.nombre)} AS equipo,
              b.${q(B.motivo)} AS motivo,
              b.${q(B.fecha)} AS fecha,
              us.${q(U.nombre)} AS usuario
       FROM ${q(B.tabla)} b
       LEFT JOIN ${q(T.equipo.tabla)} e ON e.${q(T.equipo.num)} = b.${q(B.num)}
       LEFT JOIN ${q(U.tabla)} us ON us.${q(U.id)} = b.${q(B.usuario)}
       ORDER BY b.${q(B.fecha)} DESC, b.${q(B.id)} DESC`
    );
    res.json({ status: "ok", data: rows });
  })
);

app.post(
  "/bajas",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const B = T.baja;
    const E = T.equipo;
    const num = String(req.body.num_inventario || "").trim();
    const motivo = String(req.body.motivo || "").trim();

    if (!num || !motivo)
      return res.json({ status: "fail", mensaje: "Equipo y motivo son obligatorios" });
    const errMotivo = validarTexto(motivo, { etiqueta: "El motivo", min: 5, max: 255, repite: 6 });
    if (errMotivo) return res.json({ status: "fail", mensaje: errMotivo });

    const [existe] = await pool.query(
      `SELECT ${q(B.id)} FROM ${q(B.tabla)} WHERE ${q(B.num)} = ?`,
      [num]
    );
    if (existe.length > 0)
      return res.json({ status: "fail", mensaje: "Ese equipo ya fue dado de baja" });

    await pool.query(
      `INSERT INTO ${q(B.tabla)} (${q(B.num)}, ${q(B.motivo)}, ${q(B.usuario)})
       VALUES (?, ?, ?)`,
      [num, motivo, req.user.id]
    );
    await pool.query(`DELETE FROM ${q(E.tabla)} WHERE ${q(E.num)} = ?`, [num]);
    res.json({ status: "ok", mensaje: "Baja registrada" });
  })
);

// ================= INCIDENCIAS =================
app.get(
  "/incidencias",
  auth,
  ah(async (req, res) => {
    const I = T.incidencia;
    const U = T.usuario;
    const [rows] = await pool.query(
      `SELECT i.${q(I.id)} AS id,
              i.${q(I.num)} AS num_inventario,
              e.${q(T.equipo.nombre)} AS equipo,
              i.${q(I.descripcion)} AS descripcion,
              i.${q(I.fecha)} AS fecha,
              i.${q(I.estado)} AS estado,
              us.${q(U.nombre)} AS usuario
       FROM ${q(I.tabla)} i
       LEFT JOIN ${q(T.equipo.tabla)} e ON e.${q(T.equipo.num)} = i.${q(I.num)}
       LEFT JOIN ${q(U.tabla)} us ON us.${q(U.id)} = i.${q(I.usuario)}
       ORDER BY i.${q(I.fecha)} DESC, i.${q(I.id)} DESC`
    );
    res.json({ status: "ok", data: rows });
  })
);

app.post(
  "/incidencias",
  auth,
  ah(async (req, res) => {
    const I = T.incidencia;
    const num = String(req.body.num_inventario || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();

    if (!num || !descripcion)
      return res.json({ status: "fail", mensaje: "Equipo y descripción son obligatorios" });
    const errDesc = validarTexto(descripcion, { etiqueta: "La descripción", min: 5, max: 255, repite: 6 });
    if (errDesc) return res.json({ status: "fail", mensaje: errDesc });

    await pool.query(
      `INSERT INTO ${q(I.tabla)} (${q(I.num)}, ${q(I.usuario)}, ${q(I.descripcion)})
       VALUES (?, ?, ?)`,
      [num, req.user.id, descripcion]
    );
    res.json({ status: "ok", mensaje: "Incidencia reportada" });
  })
);

app.put(
  "/incidencias/:id",
  auth,
  solo("Coordinador", "Director", "Administración"),
  ah(async (req, res) => {
    const I = T.incidencia;
    const id = parseInt(req.params.id, 10);
    const estado = String(req.body.estado || "").trim();
    if (!ESTADOS_INCIDENCIA.includes(estado))
      return res.json({ status: "fail", mensaje: "Estado no válido" });
    await pool.query(`UPDATE ${q(I.tabla)} SET ${q(I.estado)} = ? WHERE ${q(I.id)} = ?`, [
      estado,
      id,
    ]);
    res.json({ status: "ok", mensaje: "Incidencia actualizada" });
  })
);

// ================= KPIs =================
app.get(
  "/kpis",
  auth,
  ah(async (req, res) => {
    const E = T.equipo;
    const I = T.incidencia;
    const B = T.baja;

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${q(E.tabla)}`);
    const [[{ buenos }]] = await pool.query(
      `SELECT COUNT(*) AS buenos FROM ${q(E.tabla)} WHERE ${q(E.estado)} = 'Bueno'`
    );
    const [[{ danados }]] = await pool.query(
      `SELECT COUNT(*) AS danados FROM ${q(E.tabla)} WHERE ${q(E.estado)} = 'Dañado'`
    );
    const [[{ mantenimiento }]] = await pool.query(
      `SELECT COUNT(*) AS mantenimiento FROM ${q(E.tabla)} WHERE ${q(E.estado)} = 'En mantenimiento'`
    );
    const [[{ incidencias }]] = await pool.query(
      `SELECT COUNT(*) AS incidencias FROM ${q(I.tabla)} WHERE ${q(I.estado)} != 'Resuelta'`
    );
    const [[{ bajas }]] = await pool.query(`SELECT COUNT(*) AS bajas FROM ${q(B.tabla)}`);

    let pendientes = 0;
    if (req.user.rol === "Administración") {
      const [[{ n }]] = await pool.query(
        "SELECT COUNT(*) AS n FROM SolicitudRol WHERE Estado = 'Pendiente'"
      );
      pendientes = n;
    }

    res.json({
      status: "ok",
      data: {
        total_equipos: total,
        buenos,
        danados,
        en_mantenimiento: mantenimiento,
        incidencias_abiertas: incidencias,
        bajas,
        solicitudes_pendientes: pendientes,
      },
    });
  })
);

// ================= REPORTES (PDF / EXCEL) =================
const GES = ["Coordinador", "Director", "Administración"];
const C_PRIM = "9E2A4A", C_DARK = "7D1F3A", C_GOLD = "C58A32", C_SOFT = "F5EFF1";
const COLOR_ESTADO = {
  Bueno: "3F7D58", Resuelta: "3F7D58", Cerrado: "3F7D58",
  "Dañado": "B3261E",
  "En mantenimiento": "C58A32", Pendiente: "C58A32", Abierto: "C58A32",
  "En proceso": "2F6FB3",
};

// cols: [encabezado, clave, ancho relativo]
const REP = {
  inventario: {
    titulo: "Inventario de equipos",
    roles: null,
    cols: [["N.º inventario", "num_inventario", 16], ["Equipo", "nombre", 30], ["Tipo", "tipo", 20], ["Ubicación", "ubicacion", 24], ["Estado", "estado", 16]],
    sql: `SELECT e.NumInventario AS num_inventario, e.Nombre_Equipo AS nombre, t.Nombre_Tipo AS tipo,
                 u.Nombre_Ubicacion AS ubicacion, e.Estado_Conservacion AS estado
          FROM Equipo e
          LEFT JOIN TipoEquipo t ON t.IdTipoEquipo = e.IdTipoEquipo
          LEFT JOIN Ubicacion u ON u.IdUbicacion = e.IdUbicacion
          ORDER BY e.Nombre_Equipo`,
  },
  incidencias: {
    titulo: "Incidencias reportadas",
    roles: null,
    cols: [["N.º inventario", "num_inventario", 15], ["Equipo", "equipo", 22], ["Descripción", "descripcion", 38], ["Reportó", "usuario", 20], ["Fecha", "fecha", 16], ["Estado", "estado", 13]],
    sql: `SELECT i.NumInventario AS num_inventario, e.Nombre_Equipo AS equipo, i.Descripcion AS descripcion,
                 us.Nombre_Completo AS usuario, i.Fecha_Reporte AS fecha, i.Estado AS estado
          FROM Incidencia i
          LEFT JOIN Equipo e ON e.NumInventario = i.NumInventario
          LEFT JOIN Usuario us ON us.IdUsuario = i.IdUsuario
          ORDER BY i.Fecha_Reporte DESC, i.IdIncidencia DESC`,
  },
  traslados: {
    titulo: "Traslados realizados",
    roles: GES,
    cols: [["N.º inventario", "num_inventario", 15], ["Equipo", "equipo", 22], ["Origen", "origen", 20], ["Destino", "destino", 20], ["Motivo", "motivo", 30], ["Fecha", "fecha", 15], ["Responsable", "usuario", 20]],
    sql: `SELECT t.NumInventario AS num_inventario, e.Nombre_Equipo AS equipo, uo.Nombre_Ubicacion AS origen,
                 ud.Nombre_Ubicacion AS destino, t.Motivo_Traslado AS motivo, t.Fecha_Traslado AS fecha,
                 us.Nombre_Completo AS usuario
          FROM Traslado t
          LEFT JOIN Equipo e ON e.NumInventario = t.NumInventario
          LEFT JOIN Ubicacion uo ON uo.IdUbicacion = t.Ubicacion_Origen
          LEFT JOIN Ubicacion ud ON ud.IdUbicacion = t.Ubicacion_Destino
          LEFT JOIN Usuario us ON us.IdUsuario = t.IdUsuario
          ORDER BY t.Fecha_Traslado DESC, t.IdTraslado DESC`,
  },
  mantenimientos: {
    titulo: "Historial de mantenimientos",
    roles: GES,
    cols: [["N.º inventario", "num_inventario", 15], ["Equipo", "equipo", 22], ["Motivo", "motivo", 32], ["Ingreso", "fecha_ingreso", 15], ["Salida", "fecha_salida", 15], ["Estado", "estado", 12], ["Responsable", "usuario", 20]],
    sql: `SELECT m.NumInventario AS num_inventario, e.Nombre_Equipo AS equipo, m.Motivo_Mantenimiento AS motivo,
                 m.Fecha_Ingreso AS fecha_ingreso, m.Fecha_Salida AS fecha_salida, us.Nombre_Completo AS usuario
          FROM HistorialMantenimiento m
          LEFT JOIN Equipo e ON e.NumInventario = m.NumInventario
          LEFT JOIN Usuario us ON us.IdUsuario = m.IdUsuario
          ORDER BY m.Fecha_Ingreso DESC, m.IdMantenimiento DESC`,
    map: (r) => ({ ...r, estado: r.fecha_salida ? "Cerrado" : "Abierto" }),
  },
  bajas: {
    titulo: "Bajas realizadas",
    roles: GES,
    cols: [["N.º inventario", "num_inventario", 16], ["Equipo", "equipo", 24], ["Motivo", "motivo", 38], ["Fecha", "fecha", 15], ["Responsable", "usuario", 22]],
    sql: `SELECT b.NumInventario AS num_inventario, e.Nombre_Equipo AS equipo, b.Motivo_Baja AS motivo,
                 b.Fecha_Baja AS fecha, us.Nombre_Completo AS usuario
          FROM Baja b
          LEFT JOIN Equipo e ON e.NumInventario = b.NumInventario
          LEFT JOIN Usuario us ON us.IdUsuario = b.IdUsuario
          ORDER BY b.Fecha_Baja DESC, b.IdBaja DESC`,
    map: (r) => ({ ...r, equipo: r.equipo || "(eliminado)" }),
  },
  usuarios: {
    titulo: "Usuarios del sistema",
    roles: ["Director", "Administración"],
    // OJO: nunca se incluye la contraseña
    cols: [["Nombre", "nombre", 28], ["Cargo", "cargo", 20], ["Correo", "correo", 30], ["Usuario", "usuario", 16], ["Rol", "rol", 16]],
    sql: `SELECT Nombre_Completo AS nombre, Cargo AS cargo, Correo_Electronico AS correo,
                 Usuario_Acceso AS usuario, Rol AS rol FROM Usuario ORDER BY Nombre_Completo`,
    map: (r) => ({ ...r, rol: normalizarRol(r.rol) }),
  },
};

const fechaLarga = () =>
  new Date().toLocaleString("es-SV", { dateStyle: "long", timeStyle: "short", timeZone: "America/El_Salvador" });
const val = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

async function generarExcel(rep, rows, quien, res) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIRAME";
  wb.created = new Date();
  const ws = wb.addWorksheet(rep.titulo.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const n = rep.cols.length;
  ws.columns = rep.cols.map((c) => ({ key: c[1], width: c[2] + 4 }));
  const fill = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hex } });
  const borde = { style: "thin", color: { argb: "FFE6DCE0" } };

  // Título
  ws.mergeCells(1, 1, 1, n);
  Object.assign(ws.getCell(1, 1), {
    value: `SIRAME  |  ${rep.titulo}`,
    font: { bold: true, size: 16, color: { argb: "FFFFFFFF" } },
    fill: fill(C_PRIM),
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
  });
  ws.getRow(1).height = 36;

  // Subtítulo
  ws.mergeCells(2, 1, 2, n);
  Object.assign(ws.getCell(2, 1), {
    value: `Generado el ${fechaLarga()} por ${quien}  ·  ${rows.length} registro(s)`,
    font: { italic: true, size: 10, color: { argb: "FF" + C_DARK } },
    fill: fill("F3DDE4"),
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
  });
  ws.getRow(2).height = 22;

  // Encabezados
  const h = ws.getRow(3);
  rep.cols.forEach((c, i) => {
    const cell = h.getCell(i + 1);
    cell.value = c[0];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(C_DARK);
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: "FF" + C_GOLD } } };
  });
  h.height = 26;

  // Datos
  rows.forEach((r, idx) => {
    const row = ws.addRow(rep.cols.map((c) => val(r[c[1]])));
    row.height = 20;
    row.eachCell((cell, col) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { top: borde, bottom: borde, left: borde, right: borde };
      if (idx % 2) cell.fill = fill(C_SOFT);
      const k = rep.cols[col - 1][1];
      if (k === "estado" && COLOR_ESTADO[cell.value]) {
        cell.font = { bold: true, color: { argb: "FF" + COLOR_ESTADO[cell.value] } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  });

  // Pie
  const pie = ws.addRow([`Total de registros: ${rows.length}`]);
  ws.mergeCells(pie.number, 1, pie.number, n);
  pie.getCell(1).font = { bold: true, color: { argb: "FF" + C_PRIM } };
  pie.getCell(1).border = { top: { style: "medium", color: { argb: "FF" + C_GOLD } } };

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: n } };
  await wb.xlsx.write(res);
  res.end();
}

function generarPDF(rep, rows, quien, res) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });
  doc.pipe(res);
  const PW = doc.page.width, PH = doc.page.height, W = PW - 72;
  const tot = rep.cols.reduce((s, c) => s + c[2], 0);
  const cw = rep.cols.map((c) => (c[2] / tot) * W);
  const fecha = fechaLarga();

  const banner = () => {
    doc.rect(0, 0, PW, 64).fill("#" + C_PRIM);
    doc.rect(0, 64, PW, 3).fill("#" + C_GOLD);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(22).text("SIRAME", 36, 14, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).text("Sistema de Inventario de Equipos · INFRAMEN", 36, 42, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(14).text(rep.titulo, 36, 18, { width: W, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(9).text(fecha, 36, 42, { width: W, align: "right", lineBreak: false });
  };
  const encabezadoTabla = (y) => {
    doc.rect(36, y, W, 24).fill("#" + C_DARK);
    let x = 36;
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
    rep.cols.forEach((c, i) => {
      doc.text(c[0], x + 5, y + 8, { width: cw[i] - 10, lineBreak: false, ellipsis: true });
      x += cw[i];
    });
    return y + 24;
  };

  banner();
  doc.on("pageAdded", banner);

  doc.fillColor("#" + C_PRIM).font("Helvetica-Bold").fontSize(10)
    .text(`Total de registros: ${rows.length}   ·   Generado por: ${quien}`, 36, 78, { lineBreak: false });

  let y = encabezadoTabla(98);
  doc.font("Helvetica").fontSize(8.5);

  if (!rows.length) {
    doc.fillColor("#6B6468").fontSize(11).text("No hay registros para mostrar.", 36, y + 20, { width: W, align: "center" });
  }

  rows.forEach((r, idx) => {
    const celdas = rep.cols.map((c) => val(r[c[1]]));
    doc.font("Helvetica").fontSize(8.5);
    const alto = Math.max(...celdas.map((t, i) => doc.heightOfString(t, { width: cw[i] - 10 }))) + 10;
    if (y + alto > PH - 50) {
      doc.addPage();
      y = encabezadoTabla(80);
    }
    if (idx % 2) doc.rect(36, y, W, alto).fill("#" + C_SOFT);
    let x = 36;
    celdas.forEach((t, i) => {
      const k = rep.cols[i][1];
      const col = k === "estado" && COLOR_ESTADO[t] ? "#" + COLOR_ESTADO[t] : "#292529";
      doc.fillColor(col).font(col !== "#292529" ? "Helvetica-Bold" : "Helvetica")
        .text(t, x + 5, y + 5, { width: cw[i] - 10 });
      x += cw[i];
    });
    doc.moveTo(36, y + alto).lineTo(36 + W, y + alto).lineWidth(0.5).strokeColor("#E6DCE0").stroke();
    y += alto;
  });

  // Numeración de páginas
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    doc.page.margins.bottom = 0; // evita que el pie genere una página nueva
    doc.moveTo(36, PH - 34).lineTo(36 + W, PH - 34).lineWidth(1).strokeColor("#" + C_GOLD).stroke();
    doc.fillColor("#6B6468").font("Helvetica").fontSize(8)
      .text("SIRAME · Documento generado automáticamente", 36, PH - 26, { width: W / 2, lineBreak: false })
      .text(`Página ${i + 1} de ${rango.count}`, 36 + W / 2, PH - 26, { width: W / 2, align: "right", lineBreak: false });
  }
  doc.end();
}

app.get(
  "/reportes/:tipo/:formato",
  auth,
  ah(async (req, res) => {
    const rep = REP[req.params.tipo];
    const fmt = req.params.formato;
    if (!rep || !["pdf", "excel"].includes(fmt))
      return res.status(404).json({ status: "error", mensaje: "Reporte no encontrado" });
    if (rep.roles && !rep.roles.includes(req.user.rol))
      return res.status(403).json({ status: "error", mensaje: "No tienes permiso para este reporte" });

    const [raw] = await pool.query(rep.sql);
    const rows = rep.map ? raw.map(rep.map) : raw;
    const nombre = `SIRAME_${req.params.tipo}_${new Date().toISOString().slice(0, 10)}`;

    if (fmt === "excel") {
      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
      });
      return generarExcel(rep, rows, req.user.usuario, res);
    }
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}.pdf"`,
    });
    generarPDF(rep, rows, req.user.usuario, res);
  })
);

// 404 (siempre al final, después de todas las rutas y de express.static)
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    mensaje: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
});

// Cifra con bcrypt TODAS las contraseñas que aún estén en texto plano
async function cifrarContrasenas() {
  const U = T.usuario;
  try {
    // bcrypt genera 60 caracteres; se deja espacio de sobra
    await pool.query(`ALTER TABLE ${q(U.tabla)} MODIFY ${q(U.clave)} VARCHAR(255) NOT NULL`);
  } catch (e) {
    console.warn("No se pudo ampliar la columna de contraseña:", e.message);
  }
  const [rows] = await pool.query(
    `SELECT ${q(U.id)} AS id, ${q(U.clave)} AS clave FROM ${q(U.tabla)}`
  );
  let n = 0;
  for (const r of rows) {
    const c = String(r.clave || "").trim();
    if (!c || esHash(c)) continue; // vacía o ya cifrada
    await pool.query(`UPDATE ${q(U.tabla)} SET ${q(U.clave)} = ? WHERE ${q(U.id)} = ?`, [
      bcrypt.hashSync(c, 10),
      r.id,
    ]);
    n++;
  }
  console.log(n ? `Contraseñas cifradas: ${n}` : "Todas las contraseñas ya están cifradas");
}

async function prepararBD() {
  await pool.query("SELECT 1");
  console.log(`Conectado a MySQL (${DB_NAME})`);

  // Tabla de solicitudes de administrador (se crea sola si no existe)
  await pool.query(`CREATE TABLE IF NOT EXISTS SolicitudRol (
    IdSolicitud INT AUTO_INCREMENT PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Rol_Solicitado VARCHAR(30) NOT NULL DEFAULT 'Administración',
    Estado VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
    Fecha_Solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Fecha_Resolucion DATETIME NULL,
    IdResolutor INT NULL,
    INDEX idx_estado (Estado)
  ) CHARACTER SET utf8mb4`);
  console.log("Tabla SolicitudRol lista");

  // Cifra todas las contraseñas que estén en texto plano
  await cifrarContrasenas();

  const [cols] = await pool.query(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?",
    [DB_NAME]
  );
  const hay = new Set(cols.map((x) => `${x.t.toLowerCase()}.${x.c.toLowerCase()}`));

  const faltan = [];
  Object.keys(T).forEach((k) => {
    const t = T[k];
    Object.keys(t).forEach((c) => {
      if (c === "tabla" || (k === "equipo" && c === "foto")) return;
      if (!hay.has(`${t.tabla.toLowerCase()}.${t[c].toLowerCase()}`)) {
        faltan.push(`${t.tabla}.${t[c]}`);
      }
    });
  });

  if (faltan.length > 0) {
    console.error("No existen en la base de datos: " + faltan.join(", "));
    console.error("Corrige esos nombres en el objeto T al inicio de server.js");
    return;
  }

  const E = T.equipo;
  if (!hay.has(`${E.tabla.toLowerCase()}.${E.foto.toLowerCase()}`)) {
    await pool.query(`ALTER TABLE ${q(E.tabla)} ADD COLUMN ${q(E.foto)} VARCHAR(255) NULL`);
    console.log(`Se agregó la columna ${E.foto} a la tabla ${E.tabla}`);
  }
}

prepararBD().catch((e) => {
  console.error("No se pudo preparar la base de datos:", e.message || e.code);
  if (e.code === "ECONNREFUSED") {
    console.error("-> Abre XAMPP, inicia MySQL y revisa que use el puerto 3308.");
  } else if (e.code === "ER_BAD_DB_ERROR") {
    console.error("-> La base de datos no existe. Revisa que se llame sirame_sistema.");
  } else if (e.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("-> Usuario o contraseña de MySQL incorrectos (DB_USER / DB_PASSWORD).");
  }
});

app.listen(PORT, process.env.IP || process.env.HOST || "0.0.0.0", () =>
  console.log(`Servidor SIRAME corriendo en el puerto ${PORT}`)
);