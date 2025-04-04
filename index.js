import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

app.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  const { data: user, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(403).json({ error: 'Unauthorized' })

  req.user = user
  next()
})

app.get('/api/ping', (req, res) => {
  res.json({ message: 'Autenticado correctamente', user: req.user })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Middleware corriendo en puerto ${PORT}`))
