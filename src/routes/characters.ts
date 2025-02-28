import { Router, Request, Response, NextFunction } from "express";
import { getCharactersByUser, addCharacter, syncCharacters } from "../services/characterService";
import { body, validationResult } from "express-validator";
import { verifyToken } from "../services/authService";

// ✅ Extender la interfaz de Express Request para incluir `user`
interface AuthenticatedRequest extends Request {
  user?: { id: number };
}

const characterRouter = Router();

// ✅ Middleware para verificar autenticación y extraer el userId
const authenticateUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.token; // 🔹 Obtiene el token desde la cookie

  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
    req.user = { id: decoded.userId }; // ✅ Se añade `user` al request
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
};

// ✅ Obtener personajes del usuario autenticado
characterRouter.get(
  "/",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const characters = await getCharactersByUser(req.user.id);

      if (!characters || characters.length === 0) {
        return res.status(404).json({ error: "No se encontraron personajes para este usuario" });
      }

      return res.json(characters);
    } catch (error) {
      console.error("❌ Error obteniendo personajes:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// ✅ Agregar un personaje manualmente (solo para el usuario autenticado)
characterRouter.post(
  "/",
  authenticateUser,
  [
    body("name").isString().notEmpty().withMessage("El nombre es obligatorio"),
    body("realm").isString().notEmpty().withMessage("El reino es obligatorio"),
    body("region").isString().notEmpty().withMessage("La región es obligatoria"),
    body("className").isString().notEmpty().withMessage("La clase es obligatoria"),
    body("ilvl").isInt().withMessage("El nivel de objeto debe ser un número"),
    body("mythicScore").optional().isInt().withMessage("El puntaje mítico debe ser un número"),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const { name, realm, region, className, ilvl, mythicScore, updatedAt } = req.body;

      const newCharacter = await addCharacter(req.user.id, name, realm, region, className, ilvl, mythicScore || 0, updatedAt);
      return res.status(201).json(newCharacter);
    } catch (error) {
      console.error("❌ Error agregando personaje:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// ✅ Sincronizar personajes con Battle.net (solo el usuario autenticado)
characterRouter.post(
  "/sync",
  authenticateUser,
  [body("characters").isArray().withMessage("Los personajes deben ser un array válido")],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const { characters } = req.body;

      if (characters.length === 0) {
        return res.status(400).json({ error: "No se enviaron personajes para sincronizar" });
      }

      const syncedCharacters = await syncCharacters(req.user.id, characters);
      return res.json({ message: "Personajes sincronizados correctamente", syncedCharacters });
    } catch (error) {
      console.error("❌ Error sincronizando personajes:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// ✅ Exportar el router correctamente
export default characterRouter;
