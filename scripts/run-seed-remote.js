// Script para poblar Supabase - Intenta con service_role, si falla intenta
// crear RLS policies temporales y luego insertar
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Corré: node --env-file=.env.local scripts/run-seed-remote.js');
  process.exit(1);
}

// Check if we have a real service_role key (different from anon)
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_KEY = (SERVICE_KEY && SERVICE_KEY !== SUPABASE_KEY) ? SERVICE_KEY : SUPABASE_KEY;

function parseSeedSQL() {
  const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
  const sql = fs.readFileSync(seedPath, 'utf-8');
  const lines = sql.split('\n');
  const clientes = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("('")) {
      let clean = trimmed.replace(/,\s*$/, '').replace(/;\s*$/, '');
      clean = clean.slice(1, -1);
      
      const values = [];
      let i = 0;
      while (i < clean.length) {
        if (clean[i] === "'") {
          let j = i + 1;
          while (j < clean.length) {
            if (clean[j] === "'" && clean[j+1] !== "'") break;
            if (clean[j] === "'" && clean[j+1] === "'") j++;
            j++;
          }
          values.push(clean.slice(i + 1, j));
          i = j + 1;
          while (i < clean.length && (clean[i] === ',' || clean[i] === ' ')) i++;
        } else {
          let j = i;
          while (j < clean.length && clean[j] !== ',') j++;
          const val = clean.slice(i, j).trim();
          if (val === 'null') values.push(null);
          else if (val === 'true') values.push(true);
          else if (val === 'false') values.push(false);
          else if (val.includes('.')) values.push(val);
          else values.push(parseInt(val, 10));
          i = j + 1;
          while (i < clean.length && clean[i] === ' ') i++;
        }
      }
      
      if (values.length >= 17) {
        clientes.push({
          slug: values[0],
          nombre: values[1],
          edad: values[2],
          distrito: values[3],
          segmento: values[4],
          tipo_ingreso: values[5],
          dia_ingreso_1: values[6],
          dia_ingreso_2: values[7],
          dia_remesa: values[8],
          producto: values[9],
          cuota: parseFloat(values[10]),
          saldo: parseFloat(values[11]),
          dia_pago: values[12],
          dias_atraso: values[13],
          tiene_debito_automatico: values[14],
          riesgo_score: values[15],
          riesgo_banda: values[16],
        });
      }
    }
  }
  return clientes;
}

async function insertBatch(clientes, start, batchSize, apiKey) {
  const batch = clientes.slice(start, start + batchSize);
  if (batch.length === 0) return 0;
  
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(batch),
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Error en batch ${start}-${start + batch.length}: ${resp.status}`);
    console.error(text);
    return -1;
  }
  return batch.length;
}

async function main() {
  console.log('Parsing seed.sql...');
  const clientes = parseSeedSQL();
  console.log(`Encontrados ${clientes.length} clientes`);
  console.log('Primer cliente:', JSON.stringify(clientes[0]));
  console.log(`\nUsando key role: ${USE_KEY === SUPABASE_KEY ? 'anon' : 'service_role'}`);
  
  if (USE_KEY === SUPABASE_KEY) {
    console.log('\n⚠️  No se detectó una service_role_key diferente de la anon key.');
    console.log('RLS está activado y bloqueará las inserciones con anon key.');
    console.log('\n📋 SOLUCIÓN: Necesitas la clave service_role real de tu proyecto Supabase.');
    console.log('   1. Ve a https://supabase.com/dashboard/project/TU-PROYECTO/settings/api');
    console.log('   2. Copia la "service_role" key (NO la anon key)');
    console.log('   3. Pégala en .env.local como SUPABASE_SERVICE_ROLE_KEY');
    console.log('   4. Vuelve a ejecutar este script');
    console.log('\n📋 ALTERNATIVA RÁPIDA: Ejecuta el SQL directamente en el SQL Editor:');
    console.log('   1. Ve a https://supabase.com/dashboard/project/TU-PROYECTO/sql/new');
    console.log('   2. Pega el contenido de supabase/seed.sql');
    console.log('   3. Click "Run"');
    console.log('\n📋 ALTERNATIVA MÁS RÁPIDA: Agrega una RLS policy temporal.');
    console.log('   Ejecuta esto en el SQL Editor:');
    console.log('   CREATE POLICY "allow_all_insert" ON clientes FOR INSERT WITH CHECK (true);');
    console.log('   CREATE POLICY "allow_all_select" ON clientes FOR SELECT USING (true);');
    console.log('   Luego vuelve a correr este script.');
    
    // Try inserting anyway (might work if RLS policies already exist)
    console.log('\n🔄 Intentando de todas formas...');
  }
  
  // Clean existing data
  console.log('\nLimpiando datos existentes...');
  for (const tabla of ['acuerdos', 'turnos', 'conversaciones', 'clientes']) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=not.is.null`, {
      method: 'DELETE',
      headers: {
        'apikey': USE_KEY,
        'Authorization': `Bearer ${USE_KEY}`,
      },
    });
    console.log(`  ${tabla}: ${resp.status}`);
  }
  
  // Insert in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  
  for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
    const count = await insertBatch(clientes, i, BATCH_SIZE, USE_KEY);
    if (count === -1) {
      console.error('\n❌ Error insertando datos. Revisa las instrucciones arriba.');
      process.exit(1);
    }
    inserted += count;
    process.stdout.write(`\rInsertados ${inserted}/${clientes.length} clientes...`);
  }
  
  console.log('\n\n=== Verificación ===');
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=slug,nombre,riesgo_banda&limit=5`, {
    headers: {
      'apikey': USE_KEY,
      'Authorization': `Bearer ${USE_KEY}`,
    },
  });
  const data = await resp.json();
  console.log('Primeros 5 clientes:');
  data.forEach(c => console.log(`  ${c.slug}: ${c.nombre} (${c.riesgo_banda})`));
  
  const countResp = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=count`, {
    headers: {
      'apikey': USE_KEY,
      'Authorization': `Bearer ${USE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const range = countResp.headers.get('content-range');
  console.log(`\n✅ Total: ${range}`);
  console.log('🎉 Seed completado!');
}

main().catch(console.error);
