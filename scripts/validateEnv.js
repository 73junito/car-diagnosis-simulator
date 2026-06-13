#!/usr/bin/env node

// Validate Environment Variables for Production Readiness  
const fs = require('fs');
const path = require('path');

console.log("🔍 Checking environment variables...\n");

/** Define required env vars (expand this list as needed) */ const REQUIRED_VARS = [
  'DATABASE_URL',          // Supabase/database connection string
  'NEXT_PUBLIC_SUPABASE_URL', 
  'NEXT_PUBLIC_APP_URL'    // Vercel deployment root URL  
]; 

// Check if .env.local exists to load optional local vars for testing  
let envVars = {}; try { const dotenvPath = path.resolve(__dirname, '../.env'); fs.accessSync(dotenvPath); require('dotenv').config({ path: dotenvPath }); } catch (err) {}  

function validate() { 
  const missing = REQUIRED_VARS.filter(key => !process.env[key]); 
  
  if (missing.length === 0 ) { console.log("✅ All required environment variables are set."); return true;  
} else { 
    console.error(`❌ Missing the following env vars:\n${missing.join('\n')}`); process.exit(1 ); } } validate();