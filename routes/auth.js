import express from 'express'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import redis from '../lib/redis.js'
import crypto from 'crypto'

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// LOGIN: guarda el token en Redis y genera un state seguro
router.get('/login', async (req, res) => {
  const token = req.query.token
  if (!token) return res.status(400).send('Missing token')

  const state = `state_${crypto.randomUUID()}`
  await redis.set(state, token, 'EX', 300)

  const redirectUri = `${process.env.MIDDLEWARE_PUBLIC_URL}/auth/callback`
  const url = `https://eu.battle.net/oauth/authorize?client_id=${process.env.BLIZZARD_CLIENT_ID}&scope=openid wow.profile&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`

  res.redirect(url)
})

// CALLBACK: recupera el token de Redis desde el state
router.get('/callback', async (req, res) => {
  const code = req.query.code
  const state = req.query.state
  const redirectUri = `${process.env.MIDDLEWARE_PUBLIC_URL}/auth/callback`

  try {
    const supabaseToken = await redis.get(state)
    if (!supabaseToken) return res.status(400).send('State inválido o expirado')

    // Obtener token de Battle.net
    const auth = Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString('base64')
    const tokenRes = await fetch('https://eu.battle.net/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}`
    })
    const tokenData = await tokenRes.json()
    const blizzardToken = tokenData.access_token

    // Obtener battletag
    const userInfoRes = await fetch('https://eu.battle.net/oauth/userinfo', {
      headers: { Authorization: `Bearer ${blizzardToken}` }
    })
    const userInfo = await userInfoRes.json()
    const battletag = userInfo.battletag

    // Validar token contra Supabase
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${supabaseToken}` } } }
    )

    const { data: user, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user?.user?.id) throw new Error('Token de Supabase inválido')

    const userId = user.user.id

    // Guardar battletag
    await supabase
      .from('users')
      .update({ battletag })
      .eq('id', userId)

    res.redirect(`${process.env.DASHBOARD_URL}/dashboard`)
  } catch (err) {
    console.error('Error en callback:', err)
    res.status(500).send('Error al vincular cuenta Battle.net')
  }
})

export default router
