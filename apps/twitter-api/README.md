# Multi-Agent Twitter API

A Node.js/Express application for managing multiple Twitter “agent” accounts. This API securely stores different sets of Twitter credentials (using encryption) and lets users post tweets (including images or a single video) to any of their registered Twitter accounts.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
  - [Tech Stack](#tech-stack)
  - [Data Flow](#data-flow)
- [Security](#security)
  - [Encryption of Credentials](#encryption-of-credentials)
  - [API Key Management](#api-key-management)
- [Installation & Setup](#installation--setup)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation Steps](#installation-steps)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
  - [1. POST /api/credentials](#1-post-apicredentials)
  - [2. GET /api/credentialsowneruserid](#2-get-apicredentialsowneruserid)
  - [3. POST /api/tweetaccountid](#3-post-apitweetaccountid)
- [Working with Images & Videos](#working-with-images--videos)
  - [Uploading Images](#uploading-images)
  - [Uploading Videos](#uploading-videos)
- [Error Handling & Logs](#error-handling--logs)
- [Future Enhancements](#future-enhancements)
- [License](#license)
- [Contact](#contact)

---

## Overview
This API is designed to manage **multiple Twitter accounts (“agents”)** using the [Twitter API v2](https://developer.twitter.com/en/docs). Each agent has its own set of OAuth1.0a credentials (API key/secret, Access token/secret). Users can register their credentials in the system, then post tweets (including text, images, or a single video) under any account they own.

### Why?
- **Centralized Management**: Instead of storing credentials in environment files for every project, store them in a secure database.
- **Multi-Agent Architecture**: Allows multiple user accounts, each managing one or more Twitter agents.

---

## Key Features
1. **Secure Credential Storage**  
   - Credentials are encrypted at rest.
   - Only decrypted at runtime to authenticate requests to Twitter.

2. **Simple Media Uploads**  
   - Supports up to 4 images or 1 video per tweet (under 512MB).
   - Uses [Multer](https://github.com/expressjs/multer) for file uploads.

3. **Easy Scalability**  
   - Store credentials in a database (e.g., Supabase) to handle many agents.

4. **Modular and Extensible**  
   - Add new endpoints or features (e.g., chunked uploads for large videos, scheduled tweets, user authentication) as needed.

---

## Architecture

### Tech Stack
- **Node.js + Express** for the server.
- **`twitter-api-v2`** for interfacing with Twitter’s API.
- **Multer** for handling file uploads.
- **Supabase** (or another DB) for credential storage.
- **AES Encryption** for storing tokens securely.

### Data Flow
1. **Credential Submission**:  
   - User sends their Twitter credentials (API key, secret, etc.) via `POST /api/credentials`.
   - Server encrypts them and stores in DB.
2. **Tweet Creation**:  
   - User calls `POST /api/tweet/:accountId` with text + (optional) images or video.
   - The server fetches the **encrypted** credentials from DB, **decrypts** them, then authenticates to Twitter.
   - The server uploads media (if provided) and posts the tweet.
   - Response includes the tweet data (e.g., tweet ID, text).

---

## Security

### Encryption of Credentials
- **AES-256-CBC** (or GCM) is used to encrypt Twitter credentials at rest.  
- A **32-byte key** (`ENCRYPTION_KEY`) is kept in `.env` or a secure key manager.
- Only the server can decrypt credentials to post on behalf of the user.

### API Key Management
- Each user obtains their **own** Twitter developer keys (`appKey`, `appSecret`, etc.).  
- Our system does **not** provide shared keys; it only stores and uses what the user provides.
- Rate limits are per user/agent account.

---

## Installation & Setup

### Prerequisites
1. **Node.js** >= 14
2. **npm** or **yarn**
3. A **Supabase** project (or other DB).
4. A **Twitter Developer Account** for each account to be managed.

### Environment Variables
Create a `.env` file in the project root with at least:

```bash
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_supabase_anon_or_service_key>
ENCRYPTION_KEY=<32_char_string_or_32_byte_base64>
PORT=8080

# Optional (used if you want a default Twitter account for the app)
TWITTER_API_KEY=<some_key>
TWITTER_API_SECRET=<some_secret>
TWITTER_ACCESS_TOKEN=<some_access_token>
TWITTER_ACCESS_SECRET=<some_access_secret>
```

> **Important**: Ensure `ENCRYPTION_KEY` is exactly 32 bytes if using AES-256 (e.g., `openssl rand -base64 32`).

### Installation Steps

1. **Clone the Repo**  
   ```bash
   git clone https://github.com/your-user/multi-agent-twitter-api.git
   cd multi-agent-twitter-api
   ```
2. **Install Dependencies**  
   ```bash
   npm install
   ```
3. **Configure Database**  
   - Set up your Supabase table `twitter_accounts`:
     ```sql
     create table if not exists twitter_accounts (
       id uuid default gen_random_uuid() primary key,
       owner_user_id text not null,
       twitter_api_key text not null,
       twitter_api_secret text not null,
       twitter_access_token text not null,
       twitter_access_secret text not null,
       created_at timestamp default now()
     );
     ```
4. **Run the Server**  
   ```bash
   npm start
   ```
5. Visit `http://localhost:8080` to confirm the server is running.

---

## Database Schema

**Table**: `twitter_accounts`  
- **id (uuid)**: primary key.  
- **owner_user_id (text)**: user ID in your system.  
- **twitter_api_key (text)**: encrypted.  
- **twitter_api_secret (text)**: encrypted.  
- **twitter_access_token (text)**: encrypted.  
- **twitter_access_secret (text)**: encrypted.  
- **created_at (timestamp)**: auto-generated when row is inserted.

---

## API Endpoints

### 1. POST `/api/credentials`
Store new Twitter credentials for a user.

**Request Body (JSON)**
```json
{
  "ownerUserId": "user-abc",
  "apiKey": "<TWITTER_API_KEY>",
  "apiSecret": "<TWITTER_API_SECRET>",
  "accessToken": "<TWITTER_ACCESS_TOKEN>",
  "accessSecret": "<TWITTER_ACCESS_SECRET>"
}
```

**Response (JSON)**
```json
{
  "success": true,
  "account": {
    "id": "5e648d6f-81b6-47d7-b7d1-c6db49f556f4",
    "owner_user_id": "user-abc",
    "twitter_api_key": "<encrypted>",
    "twitter_api_secret": "<encrypted>",
    "twitter_access_token": "<encrypted>",
    "twitter_access_secret": "<encrypted>",
    "created_at": "2025-02-10T00:00:00.000Z"
  }
}
```
- The credentials returned are **encrypted**.

---

### 2. GET `/api/credentials/:ownerUserId`
Retrieve all Twitter agents belonging to `ownerUserId`.

**Response (JSON)**  
```json
{
  "accounts": [
    {
      "id": "5e648d6f-81b6-47d7-b7d1-c6db49f556f4",
      "owner_user_id": "user-abc",
      "twitter_api_key": "<encrypted>",
      "twitter_api_secret": "<encrypted>",
      "twitter_access_token": "<encrypted>",
      "twitter_access_secret": "<encrypted>",
      "created_at": "2025-02-10T00:00:00.000Z"
    },
    ...
  ]
}
```

---

### 3. POST `/api/tweet/:accountId`
Post a tweet (with optional **up to 4 images** or **1 video**) from a specific account.

**Form Data Fields**
- **`text`** *(string)*: Tweet text  
- **`images`** *(file array, max 4)*: Up to 4 images (PNG, JPG, GIF)  
- **`video`** *(file, max 1)*: Single MP4 or MOV (H.264/AAC)  

**Example using cURL**:
```bash
curl -X POST http://localhost:8080/api/tweet/5e648d6f-81b6-47d7-b7d1-c6db49f556f4 \
  -F "text=Hello from my multi-agent server!" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

**Response (JSON)**:
```json
{
  "success": true,
  "tweet": {
    "data": {
      "id": "1234567890123456789",
      "text": "Hello from my multi-agent server!"
    }
  }
}
```

---

## Working with Images & Videos

### Uploading Images
- You can attach **up to 4** images in a single tweet.  
- Supported formats: JPEG, PNG, GIF.

### Uploading Videos
- **One video** per tweet.  
- Must be **MP4** or **MOV** with **H.264 video + AAC audio**.  
- Maximum size: **512MB** (for large videos, chunked upload is needed—this boilerplate uses the simple single upload method for smaller files).

---

## Error Handling & Logs
- Most errors will return a **400** or **500** status code with a JSON body like:
  ```json
  {
    "error": "Failed to post tweet",
    "details": "Error message from Twitter API or internal logic"
  }
  ```
- **Console Logs**:
  - Server logs tweets when successfully posted:
    ```
    Tweet successfully posted: [Object with Tweet details]
    ```

---

## Future Enhancements
1. **OAuth Flow**: Let users sign in with Twitter directly, avoiding manual credential entry.
2. **Large Video Uploads**: Implement chunked uploads for >15MB or >30s videos.
3. **Scheduled Tweets**: Add a scheduler to post tweets at specific times.
4. **User Authentication**: Add a login system so only authorized users can manage credentials.
5. **Encryption Upgrade**: Switch from AES-CBC to AES-GCM for authenticated encryption.

---

## License
This project is distributed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to modify and reuse in your own projects, keeping in mind you must adhere to [Twitter’s Developer Agreement & Policy](https://developer.twitter.com/en/developer-terms/agreement-and-policy).

---

**Enjoy building with the Multi-Agent Twitter API!**

