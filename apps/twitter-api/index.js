require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TwitterApi } = require('twitter-api-v2');
const { createClient } = require('@supabase/supabase-js');

// 1. Connect to Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // or service_role key
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Initialize Express
const app = express();
const PORT = process.env.PORT || 8080;

// 3. Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// 4. Middleware to parse JSON
app.use(express.json());

// ============ ROUTES ============

/**
 * (A) POST /api/credentials
 * Store new Twitter credentials for a user
 */
app.post('/api/credentials', async (req, res) => {
  try {
    const { ownerUserId, apiKey, apiSecret, accessToken, accessSecret } = req.body;

    // Validate input
    if (!ownerUserId || !apiKey || !apiSecret || !accessToken || !accessSecret) {
      return res.status(400).json({ error: 'All credentials are required.' });
    }

    // Insert new row into "twitter_accounts" table
    const { data, error } = await supabase
      .from('twitter_accounts')
      .insert([{
        id: uuidv4(),
        owner_user_id: ownerUserId,
        twitter_api_key: apiKey,
        twitter_api_secret: apiSecret,
        twitter_access_token: accessToken,
        twitter_access_secret: accessSecret
      }])
      .select('*')  // Return inserted row(s)

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to store credentials in Supabase' });
    }

    return res.status(200).json({ success: true, account: data[0] });
  } catch (err) {
    console.error('Error storing credentials:', err);
    return res.status(500).json({ error: 'Failed to store credentials' });
  }
});

/**
 * (B) GET /api/credentials/:ownerUserId
 * Retrieve all Twitter accounts for a particular owner user
 */
app.get('/api/credentials/:ownerUserId', async (req, res) => {
  try {
    const { ownerUserId } = req.params;

    // Fetch accounts from Supabase
    const { data, error } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('owner_user_id', ownerUserId);

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(500).json({ error: 'Failed to fetch credentials from Supabase' });
    }

    // Return all accounts for that user
    return res.status(200).json({ accounts: data });
  } catch (err) {
    console.error('Error fetching credentials:', err);
    return res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

/**
 * (C) POST /api/tweet/:accountId
 * Post a tweet (with optional images or one video) for a specific Twitter account
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

    // 1. Retrieve the specified Twitter account from Supabase
    const { data: accounts, error } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('id', accountId)
      .limit(1)
      .single();

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(404).json({ error: 'Bot credentials not found' });
    }

    if (!accounts) {
      return res.status(404).json({ error: 'Bot credentials not found' });
    }

    // 2. Initialize a Twitter client with these credentials
    const dynamicTwitterClient = new TwitterApi({
      appKey: accounts.twitter_api_key,
      appSecret: accounts.twitter_api_secret,
      accessToken: accounts.twitter_access_token,
      accessSecret: accounts.twitter_access_secret,
    });

    const rwClient = dynamicTwitterClient.readWrite;

    // 3. Handle images or video
    let mediaIds = [];

    // Images
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        const mediaId = await rwClient.v1.uploadMedia(file.path);
        mediaIds.push(mediaId);
        fs.unlinkSync(file.path); // remove temp file
      }
    }

    // Video
    if (videoFile && videoFile.length > 0) {
      if (mediaIds.length > 0) {
        return res.status(400).json({ error: 'Cannot upload both images and videos in a single tweet.' });
      }

      console.log('Uploading video:', videoFile[0].path);
      const mediaId = await rwClient.v1.uploadMedia(videoFile[0].path, { mimeType: 'video/mp4' });
      mediaIds.push(mediaId);
      fs.unlinkSync(videoFile[0].path);
    }

    // 4. Post the tweet
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
  res.send('Welcome to the multi-bot Twitter API server with Supabase!');
});

// ============ START THE SERVER ============

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
