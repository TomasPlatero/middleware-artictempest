import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import {
  getDiscordAuthUrl,
  getDiscordToken,
  getDiscordUser,
  getBattleNetAuthUrl,
  getBattleNetToken,
  getBattleNetUser,
  verifyToken,
} from "../services/authService";
import prisma from "../prisma";

const authRouter = Router();
authRouter.use(cookieParser()); // 🔹 Habilita la lectura de cookies en Express

const stateStore = new Map<string, string>(); // 🔹 Evita ataques CSRF

// 🔹 Configuración segura de cookies
const cookieOptions: import("express").CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 🔹 Expira en 7 días
};

// 🔹 Función para generar un token JWT
const generateJWT = (user: any): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("❌ JWT_SECRET no está definido en .env");
  }

  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      discordId: user.discordId ?? undefined,
      battleNetId: user.battleNetId ?? undefined,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// 🔹 Login con Discord
authRouter.get("/discord", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  stateStore.set(state, "valid");
  res.redirect(getDiscordAuthUrl(state));
});

// 🔹 Callback de Discord
authRouter.get("/discord/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state || !stateStore.has(state)) {
    return res.status(400).json({ error: "Código de autorización o state inválido" });
  }

  stateStore.delete(state);

  try {
    const accessToken = await getDiscordToken(code);
    const userInfo = await getDiscordUser(accessToken);

    const user = await prisma.user.upsert({
      where: { discordId: userInfo.id },
      update: { username: userInfo.username },
      create: {
        discordId: userInfo.id,
        battleNetId: null,
        username: userInfo.username,
      },
    });

    const token = generateJWT(user);

    // 🔹 Guardamos el token en una cookie segura
    res.cookie("auth_token", token, cookieOptions);

    // 🔹 Redirigimos al frontend sin token en la URL
    const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:8080";
    return res.redirect(`${frontendUrl}/dashboard`);
  } catch (error) {
    console.error("❌ Error en Discord Callback:", error);
    return res.status(500).json({ error: "Error autenticando con Discord" });
  }
});

// 🔹 Login con Battle.net
authRouter.get("/battle-net", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  stateStore.set(state, "valid");
  res.redirect(getBattleNetAuthUrl(state));
});

// 🔹 Callback de Battle.net
authRouter.get("/battle-net/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const token = req.cookies.auth_token;

  if (!code || !state || !stateStore.has(state) || !token) {
    return res.status(400).json({ error: "Solicitud inválida" });
  }

  stateStore.delete(state);

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const accessToken = await getBattleNetToken(code);
    const battleNetUser = await getBattleNetUser(accessToken);

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { battleNetId: battleNetUser.id },
    });

    const newToken = generateJWT(updatedUser);

    res.cookie("auth_token", newToken, cookieOptions);
    return res.redirect(`${process.env.FRONTEND_URL}/profile`);
  } catch (error) {
    console.error("❌ Error en Battle.net Callback:", error);
    return res.status(500).json({ error: "Error vinculando Battle.net" });
  }
});

// 🔹 Desvincular Battle.net
authRouter.post("/unlink-bnet", async (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { battleNetId: null },
    });

    const newToken = generateJWT(updatedUser);

    res.cookie("auth_token", newToken, cookieOptions);
    return res.status(200).json({ message: "Battle.net desvinculado" });
  } catch (error) {
    console.error("❌ Error desvinculando Battle.net:", error);
    return res.status(500).json({ error: "Error al desvincular Battle.net" });
  }
});

// 🔹 Logout - Elimina la cookie
authRouter.post("/logout", (req, res) => {
  res.clearCookie("auth_token", cookieOptions);
  res.status(200).json({ message: "Sesión cerrada" });
});

// 🔹 Verificar usuario con JWT desde la cookie
authRouter.get("/me", async (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    return res.json({ user });
  } catch (error) {
    console.error("❌ Error verificando usuario:", error);
    return res.status(500).json({ error: "Error al verificar usuario" });
  }
});

export default authRouter;
