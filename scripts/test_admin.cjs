const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load API_KEY from scripts/secrets.json
const fs = require('fs');
const secrets = JSON.parse(fs.readFileSync('scripts/secrets.json', 'utf8')).secrets;
const apiKey = secrets.find(s => s.key === 'API_KEY').id; // Wait, value is not in `id`, it's not exposed!
