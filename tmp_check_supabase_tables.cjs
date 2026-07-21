const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env', 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .reduce((acc, line) => {
    const idx = line.indexOf('=');
    if (idx < 0) return acc;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    acc[key] = value;
    return acc;
  }, {});
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
const client = createClient(url, key);
async function testTable(table) {
  try {
    const result = await client.from(table).select('id').limit(1).maybeSingle();
    console.log(table, JSON.stringify(result));
  } catch (err) {
    console.error(table, 'ERROR', err.message || err);
  }
}
(async () => {
  await testTable('companies');
  await testTable('churches');
})();
