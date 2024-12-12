const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../db');
require('dotenv').config();

// This route handles login and fetching user details.
// We assume the frontend uses Supabase Auth for sign-in/up.
// When the user is logged in from frontend using Supabase Auth,
// we fetch user role from the database and generate a JWT for backend access.

router.post('/get-token', async (req, res) => {
  const { user_id, email } = req.body;
  // user_id and email are obtained by frontend after user logs in with Supabase
  // Here we just trust the frontend. In a real app, you might implement a more secure flow.
  
  // Fetch user role from 'users' table
  const { data: userData, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user_id)
    .single();

  if (error || !userData) {
    return res.status(400).json({ error: 'User not found in database.' });
  }

  const token = jwt.sign(
    { user_id: userData.id, email: userData.email, role: userData.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, role: userData.role });
});

module.exports = router;
