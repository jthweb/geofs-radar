import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const activeViewers = new Map<string, number>();
const VIEWER_TIMEOUT = 30000;

function cleanupExpiredViewers(): void {
  const now = Date.now();
  for (const [id, timestamp] of activeViewers.entries()) {
    if (now - timestamp > VIEWER_TIMEOUT) {
      activeViewers.delete(id);
    }
  }
}

export function GET(): NextResponse {
  cleanupExpiredViewers();
  
  return NextResponse.json({
    activeViewers: activeViewers.size,
    hasViewers: activeViewers.size > 0,
    lastActivity: activeViewers.size > 0 ? new Date().toISOString() : null,
  }, {
    headers: CORS_HEADERS,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { viewerId } = body as { viewerId?: string };
    
    cleanupExpiredViewers();
    
    const id = viewerId || `viewer_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    activeViewers.set(id, now);
    
    return NextResponse.json({
      success: true,
      viewerId: id,
      activeViewers: activeViewers.size,
    }, {
      headers: CORS_HEADERS,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { 
        status: 400,
        headers: CORS_HEADERS,
      }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}