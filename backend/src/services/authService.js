'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');

async function login(username, password) {
  const user = await userRepo.findByUsername(username);
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return null;
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role, name: user.name || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: 'HS256' }
  );

  return { token, username: user.username, role: user.role, name: user.name || null };
}

module.exports = { login };
