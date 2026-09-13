// Seed Supabase — con limpieza previa y batches pequeños
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://zepewgqjqbcnfsmbqsad.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcGV3Z3FqcWJjbmZzbWJxc2FkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODcwODc2NiwiZXhwIjoyMTA0Mjg0NzY2fQ.a-p3p985vo_EL-qgsUcsq7ghFW0fEiJ6_ZeEKtEdZR8';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
};

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

async function deleteWithRetry(tabla, attempt = 1) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=not.is.null`, {
    method: 'DELETE',
    headers,
  });
  if (resp.status === 204 || resp.status === 200) return true;
  if ((resp.status === 504 || resp.status === 503) && attempt <= 3) {
    console.log(`   ⏳ ${tabla} timeout, retry ${attempt}/3...`);
    await sleep(attempt * 2000);
    return deleteWithRetry(tabla, attempt + 1);
  }
  console.log(`   ${tabla}: ${resp.status} ${await resp.text()}`);
  return false;
}

async function insertWithRetry(batch, attempt = 1) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(batch),
  });
  
  if (resp.ok) return true;
  
  if ((resp.status === 504 || resp.status === 503) && attempt <= 3) {
    const wait = attempt * 3000;
    console.log(`\n   ⏳ Timeout, retry ${attempt}/3 en ${wait/1000}s...`);
    await sleep(wait);
    return insertWithRetry(batch, attempt + 1);
  }
  
  const text = await resp.text();
  console.error(`\n❌ Error: ${resp.status} ${text}`);
  return false;
}

async function main() {
  console.log('📋 Parsing seed.sql...');
  const clientes = parseSeedSQL();
  console.log(`   ${clientes.length} clientes\n`);

  // 1. Limpiar en orden (dependencias primero)
  console.log('🧹 Limpiando tablas...');
  for (const tabla of ['acuerdos', 'turnos', 'conversaciones', 'clientes']) {
    const ok = await deleteWithRetry(tabla);
    console.log(`   ${tabla}: ${ok ? '✅' : '⚠️ (puede estar vacía)'}`);
    await sleep(500);
  }

  // 2. Insertar de 10 en 10
  console.log('\n📥 Insertando clientes...');
  const BATCH = 10;
  let inserted = 0;
  
  for (let i = 0; i < clientes.length; i += BATCH) {
    const batch = clientes.slice(i, i + BATCH);
    const ok = await insertWithRetry(batch);
    if (!ok) {
      console.error(`\nFallo en batch ${i}. Insertados: ${inserted}`);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`\r   ${inserted}/${clientes.length}`);
    await sleep(300);
  }
  
  // 3. Verificar
  console.log('\n\n✅ Verificación:');
  await sleep(1000);
  
  const countResp = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*`, {
    headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' },
  });
  console.log(`   Total: ${countResp.headers.get('content-range')}`);
  
  const sampleResp = await fetch(
    `${SUPABASE_URL}/rest/v1/clientes?select=slug,nombre,riesgo_banda&slug=in.(karla,jose,wilber,sandra,rosa,nelson,tito,marta)&order=slug`,
    { headers }
  );
  const sample = await sampleResp.json();
  console.log('   Personajes del pitch:');
  sample.forEach(c => console.log(`     ${c.slug}: ${c.nombre} (${c.riesgo_banda})`));
  
  console.log('\n🎉 ¡Seed completado!');
}

main().catch(console.error);
