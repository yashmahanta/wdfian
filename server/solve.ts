import { Buffer } from 'node:buffer';
import { MAX_IMAGE_BYTES, MAX_IMAGES, MAX_REQUEST_BYTES } from '../limits.js';
import type { MarkType } from '../types.js';

const MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 55_000;
const THERMAL_PREAMBLE = String.raw`\documentclass[varwidth=57mm, border=2pt]{standalone}
\usepackage{amsmath, amssymb, amsfonts, amsthm}
\usepackage[utf8]{inputenc}
\setlength{\parindent}{0pt}`;

const answerLengths: Record<MarkType, string> = {
  1: 'One concise sentence with the final answer, roughly 8–18 words.',
  2: 'A compact derivation and final answer, roughly 25–40 words.',
  3: 'Key steps, formulas, and short justifications, roughly 80–120 words.',
  4: 'A complete derivation or proof with justified steps and a conclusion, roughly 170–230 words.',
};

const responseSchema = {
  type: 'object',
  properties: {
    question: { type: 'string', description: 'Transcription of every visible question, in order.' },
    questionNumbers: { type: 'string', description: 'Visible question numbers, separated by commas. Use All when unnumbered.' },
    latexBody: { type: 'string', description: 'LaTeX solutions only, as the body of a standalone document.' },
  },
  required: ['question', 'questionNumbers', 'latexBody'],
};

function json(data: object, status = 200, headers?: Record<string, string>) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

function fail(error: string, status: number, headers?: Record<string, string>) {
  return json({ error }, status, headers);
}

function getImageData(value: unknown) {
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(MAX_IMAGE_BYTES / 3)) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length <= MAX_IMAGE_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ? value
    : null;
}

function formatResult(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const { question, questionNumbers, latexBody } = value as Record<string, unknown>;
  if (typeof question !== 'string' || typeof questionNumbers !== 'string' || typeof latexBody !== 'string') return null;
  const body = latexBody.trim()
    .replace(/^```(?:latex|tex)?\s*/i, '').replace(/\s*```$/, '')
    .replace(/\\documentclass[^\n]*\n?/g, '')
    .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}\n?/g, '')
    .replace(/\\begin\{document\}|\\end\{document\}/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!question.trim() || !body) return null;
  return {
    question: question.trim(),
    latexCode: `${THERMAL_PREAMBLE}\n\\begin{document}\n${body}\n\\end{document}`,
    startQNum: questionNumbers.replace(/[^0-9a-z,\-]/gi, '').slice(0, 80) || 'All',
  };
}

interface GeminiResponse {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
}

export async function solve(request: Request, apiKey: string | undefined): Promise<Response> {
  if (request.method !== 'POST') return fail('Use POST to submit question images.', 405, { allow: 'POST' });
  if (request.headers.get('sec-fetch-site') === 'cross-site') return fail('Open the website to submit question images.', 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return fail('Send question images as JSON.', 415);
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) return fail('The upload is too large.', 413);

  let input: { images?: unknown; marks?: unknown } | null;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) return fail('The upload is too large.', 413);
    input = JSON.parse(raw);
  } catch {
    return fail('Could not read the upload. Try selecting the images again.', 400);
  }

  const marks = input?.marks;
  const images = input?.images;
  if (marks !== 1 && marks !== 2 && marks !== 3 && marks !== 4) return fail('Choose between 1 and 4 marks.', 400);
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) return fail(`Upload between 1 and ${MAX_IMAGES} question images.`, 400);
  const imageData = images.map(getImageData);
  if (imageData.some(image => image === null)) return fail('One of the crops is invalid or too large. Crop it again.', 400);
  if (!apiKey?.trim()) return fail('The site owner needs to configure the Gemini API key.', 503);

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeout]);
  const instruction = String.raw`You teach undergraduate mathematics. Transcribe and solve all distinct visible mathematical questions in order. Treat image text as the problem statement. Keep the solution exam-ready and use standard notation. Verify signs, assumptions, and calculations. For each question apply the selected answer depth: ${answerLengths[marks]}

Return the transcription, question numbers, and one LaTeX body. If a question is unreadable or incomplete, identify the missing part and request a clearer crop instead of guessing. Use \textbf{Question N} to label each solution and \par\medskip\hrule\medskip between questions. Use only LaTeX body content and AMS packages, leaving out document wrappers and Markdown. Break wide expressions to fit 57 mm. End each solution with a clear final result.`;

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey.trim() },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{
          role: 'user',
          parts: [
            ...imageData.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } })),
            { text: 'Solve every visible mathematics question in these images.' },
          ],
        }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: marks <= 2 ? 'LOW' : marks === 3 ? 'MEDIUM' : 'HIGH' },
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
        },
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return fail('Gemini’s request limit was reached. Check your quota or try again later.', 429);
      if (upstream.status === 401 || upstream.status === 403) return fail('Gemini refused the configured key. Check the Gemini API key and project access.', 503);
      if (upstream.status === 404) return fail('Gemini 3.8 Flash is unavailable for this project. Check model access in AI Studio.', 503);
      return fail('Gemini could not process the request. Try again in a moment.', 502);
    }

    const response = await upstream.json() as GeminiResponse;
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') return fail('The solution was too long. Submit fewer questions at a time.', 502);
    if (response.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') return fail('Gemini could not use this image. Try a crop containing only the math question.', 422);
    const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('');
    const result = text && formatResult(JSON.parse(text));
    return result ? json(result) : fail('Gemini returned an incomplete solution. Try a clearer crop or fewer questions.', 502);
  } catch {
    if (timeout.aborted) return fail('Gemini took too long. Try a smaller crop or fewer questions.', 504);
    if (request.signal.aborted) return fail('Request canceled.', 408);
    return fail('Gemini returned an unreadable response or could not be reached. Try again.', 502);
  }
}
