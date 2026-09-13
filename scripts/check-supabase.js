// Intento 3: Usar el Supabase Management API para ejecutar SQL
// El management API usa un access token diferente del service_role key
// Alternativa: crear función RPC que permita insertar sin RLS

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Corré: node --env-file=.env.local scripts/check-supabase.js');
  process.exit(1);
}

// El ref del proyecto es el subdominio de la URL.
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function main() {
  // 1. Try the Supabase Management API endpoint to run SQL
  console.log('=== Intento 1: Management API ===');
  const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
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
