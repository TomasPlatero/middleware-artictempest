import express from 'express'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const router = express.Router()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.post('/sync-guilds', async (req, res) => {
  const userId = req.user.id

  const { data: user } = await supabase
    .from('users')
    .select('battletag')
    .eq('id', userId)
    .single()

  if (!user || !user.battletag) {
    return res.status(400).json({ error: 'No Battle.net account linked' })
  }

  try {
    const token = await getBlizzardToken()

    const resChars = await fetch(`https://eu.api.blizzard.com/profile/user/wow?namespace=profile-eu&locale=es_ES&access_token=${token}`)
    const json = await resChars.json()

    if (!json.wow_accounts) {
      return res.status(404).json({ error: 'No characters found' })
    }

    const gmGuilds = []

    for (const account of json.wow_accounts) {
      for (const char of account.characters) {
        if (!char.guild || char.guild.member_rank !== 0) continue

        const region = 'eu'
        const realmSlug = char.realm.slug
        const guildName = char.guild.name
        const guildSlug = slugify(guildName)

        gmGuilds.push({
          name: guildName,
          region,
          realm_slug: realmSlug,
          guild_slug: guildSlug
        })
      }
    }

    const insertions = []

    for (const guild of gmGuilds) {
      const { data, error } = await supabase
        .from('guilds')
        .upsert({
          name: guild.name,
          region: guild.region,
          realm_slug: guild.realm_slug,
          guild_slug: guild.guild_slug,
          discord_guild_id: null,
          owner_user_id: userId
        }, { onConflict: 'region,realm_slug,guild_slug' })

      if (error) console.error('Insert error:', error)
      else insertions.push(guild.name)
    }

    res.json({ inserted: insertions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error syncing guilds' })
  }
})

function slugify(str) {
  return str.toLowerCase().replace(/'/g, '').replace(/\s+/g, '-')
}

async function getBlizzardToken() {
  const auth = Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`https://eu.battle.net/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  })
  const json = await res.json()
  return json.access_token
}

export default router