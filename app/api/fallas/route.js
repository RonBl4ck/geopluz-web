import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sedId = searchParams.get('sed_id');
  
  let query = supabase.from('fallas').select('*');
  if (sedId) {
    query = query.eq('sed_id', sedId);
  }
  
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase.from('fallas').insert(body).select();
    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    
    const { data, error } = await supabase.from('fallas').update(updates).eq('id', id).select();
    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    
    const { error } = await supabase.from('fallas').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
