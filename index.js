import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import guildRoutes from './routes/guilds.js'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

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

app.use('/api', guildRoutes)

app.listen(PORT, () => console.log(`Middleware API corriendo en puerto ${PORT}`))