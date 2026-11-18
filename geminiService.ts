import type { MarkType, MathResult } from './types';

export async function analyzeMathQuestion(
  images: string[],
  marks: MarkType,
  signal: AbortSignal,
): Promise<MathResult> {
  let response: Response;
  try {
    response = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        images: images.map(image => image.slice(image.indexOf(',') + 1)),
        marks,
      }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Could not connect. Check your connection and try again.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.latexCode) {
    throw new Error(data?.error ?? 'The solver is temporarily unavailable. Try again in a moment.');
  }
  return data;
}
