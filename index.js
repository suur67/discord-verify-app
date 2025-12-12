import express from "express";
import "dotenv/config";

// userId -> timestamp
const userCooldown = new Map();

// cooldown checker (60 seconds default)
function isOnCooldown(userId, cooldownMs = 60_000) {
  const now = Date.now();
  const last = userCooldown.get(userId) || 0;

  if (now - last < cooldownMs) return true;

  userCooldown.set(userId, now);
  return false;
}

const app = express();

const required = ["CLIENT_ID", "CLIENT_SECRET", "BOT_TOKEN", "GUILD_ID", "REDIRECT_URI"];
for (const k of required) {
  if (!process.env[k]) console.log("MISSING ENV:", k);
}

app.get("/", (req, res) => res.send("Server running"));

app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("No code provided");

    // 1) Exchange code -> token
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: process.env.REDIRECT_URI,
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) return res.status(400).send("TOKEN ERROR: " + tokenText);
    const token = JSON.parse(tokenText);

    // 2) Get user
    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    const meText = await meRes.text();
    if (!meRes.ok) return res.status(400).send("ME ERROR: " + meText);
    const me = JSON.parse(meText);

    // ✅ cooldown (per user)
    if (isOnCooldown(me.id)) {
      return res.status(429).send("⏳ Slow down — try again in 60 seconds.");
    }

    // 3) Add to guild
    const addRes = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${me.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: token.access_token }),
      }
    );

    const addText = await addRes.text();
    if (!addRes.ok) return res.status(400).send("ADD ERROR: " + addText);

    res.send(`✅ Joined! Added ${me.username}.`);
  } catch (e) {
    res.status(500).send("Server error: " + e.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
