# Vespucc.tweet - Local Twitter Bot

A local application that uses Groq to generate and post tweets to Twitter. This application runs entirely on your local machine without requiring Firebase or cloud services.

## Features

- Twitter OAuth 2.0 authentication
- Local token storage using JSON files
- AI-generated tweets using Groq
- Simple web interface

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the `.env.example` template and fill in your credentials:
   - Get Twitter API credentials from the [Twitter Developer Portal](https://developer.twitter.com/)
   - Get Groq API key from [Groq](https://console.groq.com/)

## Usage

1. Start the application:
   ```
   npm start
   ```
2. Open your browser and navigate to `http://localhost:3000`
3. Click "Authenticate with Twitter" to connect your Twitter account
4. After authentication, click "Generate and Post a Tweet" to create and post an AI-generated tweet

## How It Works

1. The application uses Express.js to create a local web server
2. Authentication data is stored in a local JSON file in the `data` directory
3. The Twitter API is used for authentication and posting tweets
4. Groq's API generates tweet content

## File Structure

- `index.js` - Main application file with Express server and API endpoints
- `package.json` - Project dependencies and scripts
- `.env` - Environment variables (create this from `.env.example`)
- `data/tokens.json` - Local storage for authentication tokens (created automatically)

## Notes

- This application uses the Twitter API v2
- The Groq model used is llama3-8b-8192, but you can modify the code to use other available models
- Make sure to keep your `.env` file secure and never commit it to version control
