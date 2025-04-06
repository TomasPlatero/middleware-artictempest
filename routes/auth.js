import express from 'express'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import redis from '../lib/redis.js'
import crypto from 'crypto'

const router = express.Router()

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// LOGIN: guarda el token en Redis y genera un state seguro
router.get('/login', async (req, res) => {
  const token = req.query.token
  if (!token) return res.status(400).send('Missing token')

  const state = `state_${crypto.randomUUID()}`
  await redis.set(state, token, 'EX', 300) // TTL: 5 min

  const redirectUri = `${process.env.MIDDLEWARE_PUBLIC_URL}/auth/callback`
  const url = `https://oauth.battle.net/oauth/authorize` +
              `?client_id=${process.env.BLIZZARD_CLIENT_ID}` +
              `&scope=openid%20wow.profile` +
              `&redirect_uri=${encodeURIComponent(redirectUri)}` +
              `&response_type=code` +
              `&state=${state}`

  res.redirect(url)
})

// CALLBACK: recupera el token desde Redis usando el state
router.get('/callback', async (req, res) => {
  const { code, state } = req.query
  const redirectUri = `${process.env.MIDDLEWARE_PUBLIC_URL}/auth/callback`

  try {
    if (!code || !state) return res.status(400).send('Missing code or state')

    const supabaseToken = await redis.get(state)
    if (!supabaseToken) return res.status(400).send('Invalid or expired state')

    // Intercambiar el código por un access token de Blizzard
    const authHeader = Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString('base64')

    const tokenRes = await fetch('https://eu.battle.net/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}`
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error('Failed to retrieve access token from Blizzard')

    const blizzardToken = tokenData.access_token

    // Obtener datos del usuario (Battletag)
    const userInfoRes = await fetch('https://eu.battle.net/oauth/userinfo', {
      headers: { Authorization: `Bearer ${blizzardToken}` }
    })

    const userInfo = await userInfoRes.json()
    const battletag = userInfo?.battletag
    if (!battletag) throw new Error('No battletag in response from Blizzard')

    // Validar el token en Supabase
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${supabaseToken}` } } }
    )

    const { data: user, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user?.user?.id) throw new Error('Invalid Supabase token')

    const userId = user.user.id

    // Actualizar battletag
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ battletag })
      .eq('id', userId)

    if (updateError) throw new Error('Failed to update battletag in Supabase')

    res.redirect(`${process.env.DASHBOARD_URL}/dashboard`)
  } catch (err) {
    console.error('[OAuth Callback Error]', err.message)
    res.status(500).send('Error al vincular cuenta Battle.net')
  }
})

export default router
