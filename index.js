// Load environment variables
require("dotenv").config();

// Express server setup
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// File system for local storage
const fs = require("fs-extra");
const path = require("path");

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, "data");
fs.ensureDirSync(DATA_DIR);
const TOKEN_FILE = path.join(DATA_DIR, "tokens.json");

// Initialize token storage if it doesn't exist
if (!fs.existsSync(TOKEN_FILE)) {
  fs.writeJSONSync(TOKEN_FILE, {});
}

// Helper functions for token storage
const saveTokenData = async (data) => {
  await fs.writeJSON(TOKEN_FILE, data);
};

const getTokenData = async () => {
  try {
    return await fs.readJSON(TOKEN_FILE);
  } catch (error) {
    console.error("Error reading token file:", error);
    return {};
  }
};

// Twitter API init
const TwitterApi = require("twitter-api-v2").default;
const twitterClient = new TwitterApi({
  clientId: process.env.TWITTER_CLIENT_ID || "YOUR_CLIENT_ID",
  clientSecret: process.env.TWITTER_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
});

// Update callback URL for local development
const callbackURL = "http://localhost:3000/callback";

// Groq API init
const Groq = require("groq-sdk");
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY",
});

// STEP 1 - Auth URL
app.get("/auth", async (req, res) => {
  try {
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
      callbackURL,
      { scope: ["tweet.read", "tweet.write", "users.read", "offline.access"] }
    );

    // Store verifier locally
    await saveTokenData({ codeVerifier, state });

    res.redirect(url);
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication error");
  }
});

// STEP 2 - Verify callback code, store access_token
app.get("/callback", async (req, res) => {
  try {
    const { state, code } = req.query;

    const tokenData = await getTokenData();
    const { codeVerifier, state: storedState } = tokenData;

    if (state !== storedState) {
      return res.status(400).send("Stored tokens do not match!");
    }

    const {
      client: loggedClient,
      accessToken,
      refreshToken,
    } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackURL,
    });

    await saveTokenData({ accessToken, refreshToken });

    const { data } = await loggedClient.v2.me();
    res.send(data);
  } catch (error) {
    console.error("Callback error:", error);
    res.status(500).send("Callback processing error");
  }
});

// STEP 3 - Refresh tokens and post tweets
app.get("/tweet", async (req, res) => {
  try {
    const tokenData = await getTokenData();
    const { refreshToken } = tokenData;

    if (!refreshToken) {
      return res
        .status(400)
        .send("No refresh token found. Please authenticate first.");
    }

    const {
      client: refreshedClient,
      accessToken,
      refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await saveTokenData({ accessToken, refreshToken: newRefreshToken });

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        { role: "user", content: "tweet something cool for #techtwitter" },
      ],
      model: "llama3-8b-8192",
      max_tokens: 64,
    });

    const { data } = await refreshedClient.v2.tweet(
      chatCompletion.choices[0].message.content
    );

    res.send(data);
  } catch (error) {
    console.error("Tweet error:", error);
    res.status(500).send("Error posting tweet");
  }
});

// Home route
app.get("/", (req, res) => {
  res.send(`
    <h1>Twitter Bot with Groq</h1>
    <p>A local application for posting AI-generated tweets</p>
    <ul>
      <li><a href="/auth">Authenticate with Twitter</a></li>
      <li><a href="/tweet">Generate and Post a Tweet</a></li>
    </ul>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
