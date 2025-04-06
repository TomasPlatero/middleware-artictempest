import express from 'express'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.get('/login', (req, res) => {
  const token = req.query.token
  if (!token) return res.status(400).send('Missing token')

  const redirectUri = `${process.env.MIDDLEWARE_PUBLIC_URL}/auth/callback`
  const url = `https://eu.battle.net/oauth/authorize?client_id=${process.env.BLIZZARD_CLIENT_ID}&scope=openid wow.profile&redirect_uri=${redirectUri}&response_type=code&state=${token}`

  res.redirect(url)
})

router.get('/callback', async (req, res) => {
  const code = req.query.code
  const supabaseToken = req.query.state
  const redirectUri = `${process.env.MIDDLEWARE_PUBLIC_URL}/auth/callback`

  try {
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

    // Validar usuario con Supabase
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${supabaseToken}` } } }
    )

    const { data: user, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user?.user?.id) throw new Error('Token de Supabase inválido')

    const userId = user.user.id

    // Guardar battletag en Supabase
    await supabase
      .from('users')
      .update({ battletag })
      .eq('id', userId)

    // Redirigir al dashboard
    res.redirect(`${process.env.DASHBOARD_URL}/dashboard`)
  } catch (err) {
    console.error('Error en callback:', err)
    res.status(500).send('Error al vincular cuenta Battle.net')
  }
})

export default router
