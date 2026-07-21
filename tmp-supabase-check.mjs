import { createClient } from '@supabase/supabase-js';

const url = 'https://reblyjkgkyjxwnolljkf.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYmx5amtna3lqeHdub2xsamtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgwOTQsImV4cCI6MjA5OTU5NDA5NH0.1jdjiUldNsMCETjSg7FgjZ6x_YtL0gfsIxP-HUL4RhI';
const service = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqYXNqcnRoaWpweGxhcnJlaWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4MDMwMCwiZXhwIjoyMDkxNzU2MzAwfQ.B8oBuQRGxdkhFnvSrbddtMQ1Abo9YNwexRy1nks3SnM';

const anonClient = createClient(url, anon, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }});
const svcClient = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }});

for (const [label, client] of [['anon', anonClient], ['service', svcClient]]) {
  const { data, error } = await client.from('churches').select('id,accounting_enabled,simple_accounting_enabled').limit(1).maybeSingle();
  console.log(label, JSON.stringify({ data, error }, null, 2));
}
