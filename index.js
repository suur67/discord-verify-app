import express from "express";
import "dotenv/config";

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

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
