require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TwitterApi } = require('twitter-api-v2');

const app = express();

// Optional: load PORT from .env
const PORT = process.env.PORT || 8080;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to parse JSON body
app.use(express.json());

/**
 * Helper function: Read db.json
 */
function readDB() {
  const dbPath = path.join(__dirname, 'db.json');
  const file = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(file);
}

/**
 * Helper function: Write db.json
 */
function writeDB(data) {
  const dbPath = path.join(__dirname, 'db.json');
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

/**
 * 1. POST /api/credentials
 *    Store new Twitter credentials for a user in db.json
 */
app.post('/api/credentials', (req, res) => {
  try {
    const { ownerUserId, apiKey, apiSecret, accessToken, accessSecret } = req.body;

    // Validate the input
    if (!ownerUserId || !apiKey || !apiSecret || !accessToken || !accessSecret) {
      return res.status(400).json({ error: 'All credentials are required.' });
    }

    // Read existing data
    const dbData = readDB();

    // Create a new account object
    const newAccount = {
      id: uuidv4(),               // Unique ID for this account
      owner_user_id: ownerUserId,
      twitter_api_key: apiKey,
      twitter_api_secret: apiSecret,
      twitter_access_token: accessToken,
      twitter_access_secret: accessSecret,
      created_at: new Date().toISOString()
    };

    // Add to the array
    dbData.twitter_accounts.push(newAccount);

    // Write back to db.json
    writeDB(dbData);

    return res.status(200).json({ success: true, account: newAccount });
  } catch (error) {
    console.error('Error storing credentials:', error);
    return res.status(500).json({ error: 'Failed to store credentials' });
  }
});

/**
 * 2. GET /api/credentials/:ownerUserId
 *    Retrieve all Twitter accounts for a particular owner user.
 */
app.get('/api/credentials/:ownerUserId', (req, res) => {
  try {
    const { ownerUserId } = req.params;

    const dbData = readDB();
    // Filter by owner_user_id
    const accounts = dbData.twitter_accounts.filter(
      (acct) => acct.owner_user_id === ownerUserId
    );

    return res.status(200).json({ accounts });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

/**
 * 3. POST /api/tweet/:accountId
 *    Post a tweet (with optional images or one video) for a specific Twitter account (bot).
 */
app.post('/api/tweet/:accountId', upload.fields([
  { name: 'images', maxCount: 4 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { accountId } = req.params;
    const { text } = req.body;
    const imageFiles = req.files['images'];
    const videoFile = req.files['video'];

    if (!text) {
      return res.status(400).json({ error: 'Tweet text is required' });
    }

    // 1. Read db.json & find the specified account
    const dbData = readDB();
    const botAccount = dbData.twitter_accounts.find((acct) => acct.id === accountId);

    if (!botAccount) {
      return res.status(404).json({ error: 'Bot credentials not found' });
    }

    // 2. Initialize a Twitter client with these credentials
    const dynamicTwitterClient = new TwitterApi({
      appKey: botAccount.twitter_api_key,
      appSecret: botAccount.twitter_api_secret,
      accessToken: botAccount.twitter_access_token,
      accessSecret: botAccount.twitter_access_secret
    });
    const rwClient = dynamicTwitterClient.readWrite;

    // 3. Handle images/videos
    let mediaIds = [];

    // Images
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        const mediaId = await rwClient.v1.uploadMedia(file.path);
        mediaIds.push(mediaId);

        // Delete file after upload
        fs.unlinkSync(file.path);
      }
    }

    // Video
    if (videoFile && videoFile.length > 0) {
      // Disallow mixing images & video
      if (mediaIds.length > 0) {
        return res.status(400).json({ error: 'Cannot upload both images and videos in a single tweet.' });
      }

      console.log('Uploading video:', videoFile[0].path);
      const mediaId = await rwClient.v1.uploadMedia(videoFile[0].path, { mimeType: 'video/mp4' });
      mediaIds.push(mediaId);

      // Delete file after upload
      fs.unlinkSync(videoFile[0].path);
    }

    // 4. Post tweet
    const tweet = await rwClient.v2.tweet(text, {
      media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined,
    });

    console.log('Tweet successfully posted:', tweet);
    return res.status(200).json({ success: true, tweet });
  } catch (error) {
    console.error('Error posting tweet:', error);
    return res.status(500).json({ error: 'Failed to post tweet', details: error.message });
  }
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.send('Welcome to the multi-bot Twitter API server (JSON-based)!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
