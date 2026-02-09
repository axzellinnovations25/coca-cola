const bcrypt = require('bcrypt');
const crypto = require('crypto');

function generateRandomPassword(length = 12) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateResetTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateRandomPassword,
  hashPassword,
  generateResetToken,
  generateResetTokenHash,
}; 