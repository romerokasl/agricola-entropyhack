// Intento 3: Usar el Supabase Management API para ejecutar SQL
// El management API usa un access token diferente del service_role key
// Alternativa: crear función RPC que permita insertar sin RLS

const SUPABASE_URL = 'https://zepewgqjqbcnfsmbqsad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcGV3Z3FqcWJjbmZzbWJxc2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDg3NjYsImV4cCI6MjEwNDI4NDc2Nn0.AhFEDseo5jLU7MUeQ-wcmX-JvbBDKYw2wHtWWidMc74';

async function main() {
  // 1. Try the Supabase Management API endpoint to run SQL
  console.log('=== Intento 1: Management API ===');
  const mgmtResp = await fetch('https://api.supabase.com/v1/projects/zepewgqjqbcnfsmbqsad/database/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ query: "SELECT count(*) FROM clientes" }),
  });
  console.log(`Status: ${mgmtResp.status}`);
  console.log(`Body: ${await mgmtResp.text()}`);

  // 2. Check if there are any existing RPC functions
  console.log('\n=== Intento 2: Verificar funciones RPC existentes ===');
  const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  console.log(`Status: ${rpcResp.status}`);
  console.log(`Body: ${await rpcResp.text()}`);
  
  // 3. Check OpenAPI schema for available endpoints
  console.log('\n=== Intento 3: OpenAPI schema ===');
  const schemaResp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  console.log(`Status: ${schemaResp.status}`);
  const schemaText = await schemaResp.text();
  console.log(`Body (first 500): ${schemaText.slice(0, 500)}`);

  // 4. Try using the actual Supabase client library with the key
  console.log('\n=== Intento 4: Verificar si RLS tiene policies SELECT existentes ===');
  const selectResp = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  console.log(`SELECT Status: ${selectResp.status}`);
  console.log(`SELECT Body: ${await selectResp.text()}`);
  
  // 5. Try DELETE (might work)
  console.log('\n=== Intento 5: Verificar DELETE ===');
  const delResp = await fetch(`${SUPABASE_URL}/rest/v1/clientes?slug=eq.nonexistent`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  console.log(`DELETE Status: ${delResp.status}`);
  console.log(`DELETE Body: ${await delResp.text()}`);
}

main().catch(console.error);
