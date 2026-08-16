import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hydrateLlave, serializeLlaveLines } from '@/lib/circuitAnalysis';

export async function GET() {
  try {
    const { data: sedsData, error: sedsError } = await supabase.from('seds').select('*');
    if (sedsError) throw sedsError;
    
    const { data: llavesData, error: llavesError } = await supabase.from('llaves').select('*');
    if (llavesError) throw llavesError;
    
    const db = {};
    sedsData.forEach(sed => {
      db[sed.id] = {
        id: sed.id,
        name: sed.name,
        sedCoord: sed.sed_coord,
        llaves: {}
      };
    });
    
    llavesData.forEach(llave => {
      if (db[llave.sed_id]) {
        db[llave.sed_id].llaves[llave.llave_code] = hydrateLlave(llave);
      }
    });
    
    return NextResponse.json(db);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = await request.json();
    const sedsBatch = [];
    const llavesBatch = [];

    for (const sedId in db) {
      const sed = db[sedId];
      sedsBatch.push({
        id: sedId,
        name: sed.name || `SED ${sedId}`,
        sed_coord: sed.sedCoord || null
      });

      if (sed.llaves) {
        for (const llaveCode in sed.llaves) {
          const llave = sed.llaves[llaveCode];
          llavesBatch.push({
            sed_id: sedId,
            llave_code: llaveCode,
            name: llave.name || llaveCode,
            lines_data: serializeLlaveLines(llave)
          });
        }
      }
    }

    const CHUNK_SIZE = 500;

    // Inserción en lote (Bulk Upsert) de SEDs
    for (let i = 0; i < sedsBatch.length; i += CHUNK_SIZE) {
      const chunk = sedsBatch.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('seds').upsert(chunk);
      if (error) throw error;
    }

    // Inserción en lote (Bulk Upsert) de Llaves
    for (let i = 0; i < llavesBatch.length; i += CHUNK_SIZE) {
      const chunk = llavesBatch.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('llaves').upsert(chunk, { onConflict: 'sed_id,llave_code' });
      if (error) throw error;
    }

    return NextResponse.json({ success: true, countSeds: sedsBatch.length, countLlaves: llavesBatch.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sedId = searchParams.get('sed_id');
    const llaveCode = searchParams.get('llave_code');
    
    if (sedId && llaveCode) {
      const { error } = await supabase.from('llaves').delete().match({ sed_id: sedId, llave_code: llaveCode });
      if (error) throw error;
    } else if (sedId) {
      const { error } = await supabase.from('seds').delete().eq('id', sedId);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Falta sed_id' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
