import { Router, Request, Response } from "express";
import { createUser } from "../services/userService";

const userRouter = Router(); // 🔹 Asegurar que sea un sub-router

// ✅ Crear usuario
userRouter.post("/", async (req: Request, res: Response) => {
  const { discordId, battleNetId, username } = req.body;

  try {
    const user = await createUser(discordId, battleNetId, username);
    return res.json(user);
  } catch (error) {
    console.error("❌ Error creando usuario:", error);
    return res.status(500).json({ error: "Error creando usuario" });
  }
});

// ✅ Exportar el router correctamente
export default userRouter;
