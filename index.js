import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

// Middleware para verificar el JWT enviado por el dashboard
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

// Endpoint protegido
app.get('/api/ping', (req, res) => {
  res.json({ message: 'Ping recibido. Token válido.' })
})

app.listen(PORT, () => console.log(`Middleware API corriendo en puerto ${PORT}`))
