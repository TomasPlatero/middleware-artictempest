import jwt, { JwtPayload } from "jsonwebtoken";
import axios from "axios";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const BLIZZARD_REDIRECT_URI = `${baseUrl}/api/auth/battle-net/callback`;
const DISCORD_REDIRECT_URI = `${baseUrl}/api/auth/discord/callback`;

// 🔹 Verificar y decodificar token JWT
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET no está definido en .env");
      return null;
    }
    return jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    console.error("❌ Token inválido:", error);
    return null;
  }
};

// 🔹 Función para generar un token JWT con datos de usuario
export const generateJWT = (user: { id: number; username: string; discordId?: string; battleNetId?: number }): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("❌ JWT_SECRET no está definido en .env");
  }

  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      discordId: user.discordId || undefined,
      battleNetId: user.battleNetId || undefined,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// 🔹 Obtener la URL de autenticación de Discord
export const getDiscordAuthUrl = (state: string): string => {
  if (!process.env.DISCORD_CLIENT_ID) {
    throw new Error("❌ DISCORD_CLIENT_ID no está definido en .env");
  }
  return `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${DISCORD_REDIRECT_URI}&response_type=code&scope=identify guilds&state=${state}`;
};

// 🔹 Obtener el token de Discord
export const getDiscordToken = async (code: string): Promise<string> => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    throw new Error("❌ Credenciales de Discord no están definidas en .env");
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.DISCORD_CLIENT_ID);
    params.append("client_secret", process.env.DISCORD_CLIENT_SECRET);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", DISCORD_REDIRECT_URI);

    const response = await axios.post("https://discord.com/api/oauth2/token", params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return response.data.access_token;
  } catch (error: any) {
    console.error("❌ Error obteniendo el token de Discord:", error.response?.data || error.message);
    throw new Error("No se pudo obtener el token de Discord");
  }
};

// 🔹 Obtener datos del usuario de Discord
export const getDiscordUser = async (accessToken: string): Promise<{ id: string; username: string }> => {
  try {
    const response = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.data.id || !response.data.username) {
      throw new Error("❌ No se encontraron datos de usuario en Discord.");
    }

    return { id: response.data.id, username: response.data.username };
  } catch (error) {
    console.error("❌ Error obteniendo datos del usuario en Discord:", error);
    throw new Error("No se pudo obtener la información del usuario en Discord");
  }
};

// 🔹 Obtener la URL de autenticación de Battle.net
export const getBattleNetAuthUrl = (state: string): string => {
  if (!process.env.BLIZZARD_CLIENT_ID) {
    throw new Error("❌ BLIZZARD_CLIENT_ID no está definido en .env");
  }
  return `https://oauth.battle.net/authorize?client_id=${process.env.BLIZZARD_CLIENT_ID}&redirect_uri=${BLIZZARD_REDIRECT_URI}&response_type=code&scope=openid wow.profile&state=${state}`;
};

// 🔹 Obtener el token de Battle.net
export const getBattleNetToken = async (code: string): Promise<string> => {
  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) {
    throw new Error("❌ Credenciales de Battle.net no están definidas en .env");
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.BLIZZARD_CLIENT_ID);
    params.append("client_secret", process.env.BLIZZARD_CLIENT_SECRET);
    params.append("code", code);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", BLIZZARD_REDIRECT_URI);

    const response = await axios.post("https://oauth.battle.net/token", params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return response.data.access_token;
  } catch (error: any) {
    console.error("❌ Error obteniendo el token de Battle.net:", error.response?.data || error.message);
    throw new Error("No se pudo obtener el token de Battle.net");
  }
};

// 🔹 Obtener datos del usuario de Battle.net
export const getBattleNetUser = async (accessToken: string): Promise<{ id: number; battletag: string }> => {
  try {
    const response = await axios.get("https://oauth.battle.net/oauth/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.data.id) {
      throw new Error("❌ No se encontró el ID de Battle.net en la respuesta.");
    }

    return { id: response.data.id, battletag: response.data.battletag };
  } catch (error) {
    console.error("❌ Error obteniendo datos del usuario en Battle.net:", error);
    throw new Error("No se pudo obtener la información del usuario en Battle.net");
  }
};