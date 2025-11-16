import { NextRequest, NextResponse } from 'next/server';

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
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}