import { NextRequest, NextResponse } from 'next/server';
import { activeAircraft } from '~/lib/aircraft-store';

export async function DELETE(
  req: NextRequest,
  context: any, 
) {
  try {
    const { aircraftId } = await context.params;

    if (!aircraftId) {
      return NextResponse.json(
        { error: 'Aircraft ID required' },
        { status: 400 }
      );
    }

    const existed = activeAircraft.has(aircraftId);
    activeAircraft.delete(aircraftId);

    return NextResponse.json({
      success: true,
      message: existed ? 'Aircraft cleared' : 'Aircraft not found',
      aircraftId,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  await Promise.resolve()
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}