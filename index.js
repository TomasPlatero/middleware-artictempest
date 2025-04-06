import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import guildRoutes from './routes/guilds.js'
import authRoutes from './routes/auth.js'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5000

// Rutas públicas
app.use('/auth', authRoutes)

// Middleware para proteger rutas privadas
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'No token provided' })

  const token = auth.replace('Bearer ', '')
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' })
  }
})

// Rutas protegidas
app.use('/api/guilds', guildRoutes)

app.get('/api/ping', (req, res) => {
  res.json({ message: 'Ping recibido. Token válido.' })
})

app.listen(PORT, () => console.log(`Middleware API corriendo en puerto ${PORT}`))
