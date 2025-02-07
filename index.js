require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TwitterApi } = require('twitter-api-v2');
const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt } = require('./helpers/cryptoHelpers');  // from the snippet above

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


// /**
//  * Root endpoint
//  */
app.get('/', (req, res) => {
  res.send('Welcome to the multi-bot Twitter API server with Supabase!');
});

/**
 * (A) POST /api/credentials
 * Store new Twitter credentials for a user
 */
app.post('/api/credentials', async (req, res) => {
  try {
    const { ownerUserId, apiKey, apiSecret, accessToken, accessSecret } = req.body;

    if (!ownerUserId || !apiKey || !apiSecret || !accessToken || !accessSecret) {
      return res.status(400).json({ error: 'All credentials are required.' });
    }

    // Encrypt each credential
    const encryptedApiKey = encrypt(apiKey);
    const encryptedApiSecret = encrypt(apiSecret);
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedAccessSecret = encrypt(accessSecret);

    // Insert into Supabase
    const { data, error } = await supabase
      .from('twitter_accounts')
      .insert([{
        owner_user_id: ownerUserId,
        twitter_api_key: encryptedApiKey,
        twitter_api_secret: encryptedApiSecret,
        twitter_access_token: encryptedAccessToken,
        twitter_access_secret: encryptedAccessSecret
      }])
      .select('*');

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

    // 1. Fetch the encrypted credentials from Supabase
    const { data: account, error } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(404).json({ error: 'Bot credentials not found' });
    }
    if (!account) {
      return res.status(404).json({ error: 'Bot credentials not found' });
    }

    // 2. Decrypt the credentials (assuming you have a decrypt() helper)
    const decryptedApiKey = decrypt(account.twitter_api_key);
    const decryptedApiSecret = decrypt(account.twitter_api_secret);
    const decryptedAccessToken = decrypt(account.twitter_access_token);
    const decryptedAccessSecret = decrypt(account.twitter_access_secret);

    // 3. Initialize the Twitter client with decrypted credentials
    const dynamicTwitterClient = new TwitterApi({
      appKey: decryptedApiKey,
      appSecret: decryptedApiSecret,
      accessToken: decryptedAccessToken,
      accessSecret: decryptedAccessSecret,
    });

    const rwClient = dynamicTwitterClient.readWrite;

    // 4. Handle image or video uploads
    let mediaIds = [];

    // If images are provided
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        const mediaId = await rwClient.v1.uploadMedia(file.path);
        mediaIds.push(mediaId);

        // Delete the temp file after upload
        fs.unlinkSync(file.path);
      }
    }

    // If a video is provided
    if (videoFile && videoFile.length > 0) {
      if (mediaIds.length > 0) {
        return res
          .status(400)
          .json({ error: 'Cannot upload both images and videos in a single tweet.' });
      }

      console.log('Uploading video:', videoFile[0].path);
      const mediaId = await rwClient.v1.uploadMedia(videoFile[0].path, { mimeType: 'video/mp4' });
      mediaIds.push(mediaId);

      // Delete the temp file after upload
      fs.unlinkSync(videoFile[0].path);
    }

    // 5. Post the tweet with optional media
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



// ============ START THE SERVER ============

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;