'use strict';

const { submitMamaAnswers } = require('../_lib/mama-send.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    const result = await submitMamaAnswers(req, body);
    return res.status(200).json(result);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || 'server error' });
  }
};
