'use strict';

const { body, param } = require('express-validator');
const { validate } = require('../middlewares/validate');
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generatePassword() {
  let pw = '';
  for (let i = 0; i < 5; i++) {
    pw += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return pw;
}

const userBodyValidation = [
  body('username').trim().isEmail().withMessage('username must be a valid email'),
  body('name').trim().notEmpty().withMessage('name is required'),
  validate,
];

const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  validate,
];

async function list(_req, res, next) {
  try {
    const users = await userRepo.listRequestors();
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, name } = req.body;
    const existing = await userRepo.findByUsername(username);
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

    const plainPassword = generatePassword();
    const hash = await bcrypt.hash(plainPassword, 12);
    const user = await userRepo.createUser({ username, password: hash, name });
    return res.status(201).json({ ...user, plainPassword });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { username, name } = req.body;
    const existing = await userRepo.findByUsername(username);
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    const user = await userRepo.updateUser(id, { username, name });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}

async function regeneratePassword(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const plainPassword = generatePassword();
    const hash = await bcrypt.hash(plainPassword, 12);
    const user = await userRepo.updatePassword(id, hash);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ plainPassword });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await userRepo.removeUser(id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, create, update, regeneratePassword, remove, userBodyValidation, idParamValidation };
