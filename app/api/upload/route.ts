import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, addDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

export const runtime = 'nodejs';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel(
  { model: 'text-embedding-004' },
  { apiVersion: 'v1' }
);

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 20);
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const result = await extractText(new Uint8Array(buffer));
  return result.text.join(' ');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
    if (!userId) return Response.json({ error: 'No userId provided' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawText = await extractTextFromPDF(buffer);

    if (!rawText || rawText.trim().length < 10) {
      return Response.json({ error: 'Could not extract text from PDF' }, { status: 422 });
    }

    const chunks = chunkText(rawText);

    const allEmbeddings: number[][] = [];
    for (const chunk of chunks) {
      const result = await embeddingModel.embedContent(chunk);
      allEmbeddings.push(result.embedding.values);
    }

    const chunksRef = collection(db, 'chunks');
    const oldDocsSnap = await getDocs(query(chunksRef, where('userId', '==', userId)));
    await Promise.all(oldDocsSnap.docs.map((d) => deleteDoc(d.ref)));

    await Promise.all(
      chunks.map((chunk, idx) =>
        addDoc(chunksRef, {
          userId,
          text: chunk,
          embedding: allEmbeddings[idx],
          chunkIndex: idx,
          fileName: file.name,
          createdAt: Date.now(),
        })
      )
    );

    return Response.json({ success: true, chunkCount: chunks.length });
  } catch (err) {
    console.error('[upload] error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}