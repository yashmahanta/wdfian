# BSc Math Exam Assistant — Gemini 3.8 Flash

Upload or take up to four question photos, crop each one, choose the marks, then generate a BSc-level solution with Google Gemini 3.8 Flash. The app produces compact LaTeX for a 57 mm thermal printer, clipboard copy, and Overleaf export.

## Run locally

Use Node.js 22 or 24.

```bash
npm ci
cp .env.example .env.local
```

Create an API key in [Google AI Studio](https://aistudio.google.com/api-keys). Add it to `.env.local` as `GEMINI_API_KEY`, then run `npm run dev` and open the localhost URL printed in the terminal.

```bash
npm run typecheck
npm run build
npm run preview
```

The API key is read only by the same-origin server function. It is never placed in the browser bundle.

## Deploy to the existing Vercel project

1. Commit this source to the repository connected to the Vercel project. Use this app directory as the project root and the Vite framework preset.
2. In Vercel project settings, add `GEMINI_API_KEY` for Preview and Production.
3. Deploy a preview and test one representative question on a phone.
4. Check the solution, LaTeX, clipboard copy, and Overleaf export before promoting the deployment to production.

The Vercel Node.js function in `api/solve.ts` calls Gemini 3.8 Flash. The site resizes crops before upload, lazy-loads the crop editor, and reuses the last successful result when the images and marks are unchanged.

- [Gemini 3.8 Flash](https://aistudio.google.com/docs/models/gemini-3.8-flash)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash)
- [Gemini API keys](https://aistudio.google.com/api-keys)
