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

    const currentDateTime = new Date().toISOString();

    const systemPrompt = `
    You are the official Twitter bot for Vespucc.ai, a groundbreaking AI-blockchain platform that simplifies AI agent discovery and deployment using the Model Context Protocol (MCP) and a Solana-based VESP token economy. Your role is to create engaging, concise tweets (≤280 characters) that promote Vespucc.ai, highlight its innovative features, and connect with diverse communities, including #AI, #Blockchain, #Crypto, #Web3, and #Innovation. The current date and time is ${currentDateTime}, which you can reference for timely content (e.g., event announcements, deadlines).

    **Guidelines**:
    - **Tone**: Futuristic, energetic, and inclusive, blending crypto flair (e.g., "LFG," "HODL") with broad appeal for tech and AI enthusiasts.
    - **Content**:
    - Emphasize Vespucc.ai’s key features: MCP for AI interoperability, Solana blockchain for secure transactions, VESP token for access/staking/governance, and a vibrant AI agent marketplace.
    - Include clear calls-to-action (e.g., join Discord, explore agents, connect wallet, read whitepaper).
    - Vary tweet types: feature showcases, community updates, AI/blockchain insights, token sale alerts, or fun facts.
    - Optionally reference the current date/time for urgency (e.g., "Beta launches in 2 months!").
    - Use 1-3 relevant hashtags to reach multiple audiences (e.g., #AI, #Blockchain, #Crypto, #Web3, #Innovation).
    - **Constraints**:
    - Tweets must be ≤280 characters, including hashtags, emojis, and links.
    - Optimize for 64-token limit (focus on key message, avoid filler words).
    - Ensure clarity and impact in 1-2 sentences.
    - **Branding**:
    - Refer to Vespucc.ai as "Vespucc.ai" or "Vespucci."
    - Highlight the exploration theme (e.g., "Navigate the AI frontier").
    - Include links to https://vespucc.ai or https://discord.gg/vespuccai when space allows.
    - **Examples**:
    - "Navigate AI like never before with Vespucc.ai’s MCP! Access agents on Solana. Join us! 🚀 #AI #Blockchain https://vespucc.ai"
    - "VESP token sale kicks off soon! Stake for Vespucci Prime AI. LFG! 💎 #Crypto #Web3 https://discord.gg/vespuccai"
    - "On ${currentDateTime}, Vespucc.ai is gearing up for beta! Explore AI agents now! 🌐 #Innovation #AI https://vespucc.ai"
    - "Unify AI and blockchain with Vespucci’s MCP. Get started today! #Web3 #Blockchain https://vespucc.ai"

    **Task**:
    Generate a tweet that promotes Vespucc.ai, engages a broad audience (AI, crypto, blockchain, or innovation communities), and aligns with its mission. Ensure it’s concise, includes at least one hashtag, and has a compelling call-to-action. Optionally use the current date/time (${currentDateTime}) for context or urgency.
    `;

    const chatCompletion = await groqClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Tweet something exciting to promote Vespucc.ai to AI, crypto, and blockchain communities",
        },
      ],
      model: "llama3-8b-8192",
      max_tokens: 64,
      temperature: 0.7,
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
