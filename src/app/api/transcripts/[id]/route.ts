import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { TranscriptRepository } from '@/server/repositories/transcript-repository';

/**
 * GET /api/transcripts/:id
 * Fetches transcript, current insights state, and job status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = req.headers.get('x-user-id') || 'user_alex_pm';
    const transcript = await TranscriptRepository.findById(params.id, userId);

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    return NextResponse.json({ transcript });
  } catch (error: any) {
    console.error(`Error in GET /api/transcripts/${params.id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/transcripts/:id
 * Irreversibly deletes transcript and cascades database child records (FR-29).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = req.headers.get('x-user-id') || 'user_alex_pm';
    const deleted = await TranscriptRepository.deleteTranscript(params.id, userId);

    if (!deleted) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Transcript permanently deleted.',
    });
  } catch (error: any) {
    console.error(`Error in DELETE /api/transcripts/${params.id}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
