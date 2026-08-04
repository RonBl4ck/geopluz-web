import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
        db[llave.sed_id].llaves[llave.llave_code] = {
          name: llave.name,
          lines: llave.lines_data || []
        };
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
    for (const sedId in db) {
      const sed = db[sedId];
      await supabase.from('seds').upsert({
        id: sedId,
        name: sed.name || `SED ${sedId}`,
        sed_coord: sed.sedCoord || null
      });
      
      for (const llaveCode in sed.llaves) {
        const llave = sed.llaves[llaveCode];
        await supabase.from('llaves').upsert({
          sed_id: sedId,
          llave_code: llaveCode,
          name: llave.name || llaveCode,
          lines_data: llave.lines || []
        }, { onConflict: 'sed_id,llave_code' });
      }
    }
    return NextResponse.json({ success: true });
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
