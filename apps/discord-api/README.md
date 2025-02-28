# 🚀 Discord API

This is a **Discord API** built using **Express.js**, **Supabase**, and **Google Cloud Run**. It allows users to securely store their bot credentials and send messages using Discord bots.

---

## **📌 Features**
- Store Discord bot credentials securely in **Supabase**.
- Encrypt bot tokens using **AES encryption**.
- Send messages to Discord channels using stored bot credentials.
- Deploy to **Google Cloud Run** for a scalable and serverless API.

---

## **🛠️ Setup Instructions**

### **1️⃣ Prerequisites**
Before running the API, ensure you have:
- **Node.js (v18 or later)** installed.
- **Docker** installed for containerization.
- **Google Cloud CLI (`gcloud`)** installed.
- A **Google Cloud project** with **Cloud Run enabled**.
- A **Supabase account & project**.

---

### **2️⃣ Clone the Repository**
```sh
git clone https://github.com/your-username/discord-api.git
cd discord-api
```

---

### **3️⃣ Install Dependencies**
```sh
npm install
```

---

### **4️⃣ Configure Environment Variables**
Create a `.env` file in the root directory and add the following:

```ini
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ENCRYPTION_KEY=your_encryption_key
PORT=8080
```

⚠️ **Do not share your `SUPABASE_SERVICE_ROLE_KEY` or `ENCRYPTION_KEY`.**

---

### **5️⃣ Start the Server Locally**
```sh
npm start
```
🚀 Server will run on `http://localhost:8080`

---

## **📌 API Endpoints**

### **1️⃣ Store Discord Bot Credentials**
- **Endpoint:** `POST /store-discord-account`
- **Description:** Encrypts and stores a bot token and channel ID.
- **Request Body:**

```json
{
  "bot_token": "your-discord-bot-token",
  "channel_id": "your-discord-channel-id",
  "user_id": "your-user-id"
}
```

- **Response:**
```json
{
  "success": true,
  "message": "Bot credentials stored securely!"
}
```

---

### **2️⃣ Send Message via Stored Bot**
- **Endpoint:** `POST /send-message/:user_id`
- **Description:** Retrieves the bot token from Supabase, decrypts it, and sends a message.
- **Request Parameters:** `user_id` (Stored user ID)
- **Request Body:**

```json
{
  "content": "Hello from my bot!"
}
```

- **Response:**
```json
{
  "success": true,
  "message": "Message sent!",
  "discordResponse": {
    "id": "123456789012345678",
    "content": "Hello from my bot!",
    "channel_id": "9876543210"
  }
}
```

---

## **🚀 Deploying to Google Cloud Run**

### **1️⃣ Build and Push the Docker Image**
```sh
docker build --platform=linux/amd64 -t gcr.io/socials-api/discord-api .
docker push gcr.io/socials-api/discord-api
```

### **2️⃣ Deploy to Cloud Run**
```sh
gcloud run deploy discord-api \
  --image gcr.io/socials-api/discord-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=your_supabase_url,SUPABASE_SERVICE_ROLE_KEY=your_service_key,ENCRYPTION_KEY=your_encryption_key,PORT=8080"
```

### **3️⃣ Get the API URL**
Once deployed, Google Cloud will return a URL like:
```
https://discord-api-xyz123.a.run.app
```
You can now use this URL to send requests.

---

## **🛠 Troubleshooting**

### **1️⃣ Check Cloud Run Logs**
If deployment fails, view logs:
```sh
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=discord-api" --limit 50
```

### **2️⃣ Extend Cloud Run Startup Timeout**
If your app takes too long to start:
```sh
gcloud run deploy discord-api --timeout=120s --image gcr.io/socials-api/discord-api
```

---

## **🔒 Security Best Practices**
- Use **Google Secret Manager** for storing sensitive API keys.
- Restrict access to the Cloud Run API by using **IAM roles**.
- Regularly rotate **Supabase Service Role Keys**.

---

## **👨‍💻 Contributors**
- **Adala Wanyande (@adala-wanyande)**

---

## **📜 License**
This project is licensed under the **MIT License**.

