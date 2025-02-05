require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const PORT = 8080;

// Configure multer for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to parse JSON body
app.use(express.json());

// Initialize Twitter API client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
});

const rwClient = twitterClient.readWrite;

// Define API endpoint for posting tweets with images or videos
app.post('/api/tweet', upload.fields([{ name: 'images', maxCount: 4 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { text } = req.body;
        const imageFiles = req.files['images']; // Array of image files
        const videoFile = req.files['video']; // Array with single video file

        if (!text) {
            return res.status(400).json({ error: 'Tweet text is required' });
        }

        let mediaIds = [];

        // Handle image uploads (if provided)
        if (imageFiles && imageFiles.length > 0) {
            for (const file of imageFiles) {
                const mediaId = await rwClient.v1.uploadMedia(file.path);
                mediaIds.push(mediaId);

                // Delete temp file after upload
                fs.unlinkSync(file.path);
            }
        }

        // Handle video upload (if provided)
        if (videoFile && videoFile.length > 0) {
            if (mediaIds.length > 0) {
                return res.status(400).json({ error: 'Cannot upload both images and videos in a single tweet.' });
            }

            console.log('Uploading video:', videoFile[0].path);
            const mediaId = await rwClient.v1.uploadMedia(videoFile[0].path, { mimeType: 'video/mp4' });
            mediaIds.push(mediaId);

            // Delete temp file after upload
            fs.unlinkSync(videoFile[0].path);
        }

        // Post tweet with media
        const tweet = await rwClient.v2.tweet(text, {
            media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined,
        });

        console.log('Tweet successfully posted:', tweet);
        res.status(200).json({ success: true, tweet });

    } catch (error) {
        console.error('Error posting tweet:', error);
        res.status(500).json({ error: 'Failed to post tweet', details: error.message });
    }
});

// Define root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Twitter API server!');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
