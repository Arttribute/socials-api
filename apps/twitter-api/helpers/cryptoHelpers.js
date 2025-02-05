// cryptoHelpers.js
const crypto = require('crypto');

// Must be 32 bytes if using AES-256
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 characters long');
}

const ALGORITHM = 'aes-256-cbc'; // or consider aes-256-gcm for added integrity checks

/**
 * Encrypts a string using AES-256-CBC with a random IV
 * Returns base64-encoded data that includes the IV + encrypted text
 */
function encrypt(plaintext) {
  // Generate a random 16-byte IV
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Combine IV and encrypted text into a single base64 string:
  // We'll prefix the ciphertext with the IV.
  const ivBase64 = iv.toString('base64');
  const payload = ivBase64 + ':' + encrypted;

  return payload;
}

/**
 * Decrypts a string that was encrypted with encrypt()
 */
function decrypt(payload) {
  // Extract the IV from the front
  const [ivBase64, encryptedData] = payload.split(':');
  const iv = Buffer.from(ivBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
