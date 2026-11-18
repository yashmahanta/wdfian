import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { MarkType, MathResult } from './types';
import Header from './components/Header';
import MarksSelector from './components/MarksSelector';
import ImageUpload from './components/ImageUpload';
import ResultView from './components/ResultView';
import { analyzeMathQuestion } from './geminiService';
import { MAX_IMAGES } from './limits';

const ImageCropper = lazy(() => import('./components/ImageCropper'));

interface CompletedProof {
  images: string[];
  marks: MarkType;
  result: MathResult;
}

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [marks, setMarks] = useState<MarkType>(4);
  const [file, setFile] = useState<File | null>(null);
  const activeFile = useRef<File | null>(null);
  const [proof, setProof] = useState<CompletedProof | null>(null);
  const lastProof = useRef<CompletedProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Add a photo of your math question.');
  const activeRequest = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function scrollToOutput() {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  }

  function openCrop(nextFile: File) {
    if (loading || activeFile.current || images.length >= MAX_IMAGES) return;
    setError('');
    activeFile.current = nextFile;
    setFile(nextFile);
  }

  function closeCrop() {
    activeFile.current = null;
    setFile(null);
  }

  function updateImages(nextImages: string[]) {
    setImages(nextImages);
    setProof(null);
    lastProof.current = null;
    setError('');
    setStatus(nextImages.length ? `${nextImages.length} question ${nextImages.length === 1 ? 'image' : 'images'} ready.` : 'Add a photo of your math question.');
  }

  function handleCropComplete(cropped: string, source: File) {
    if (activeFile.current !== source) return;
    updateImages([...images, cropped]);
    closeCrop();
  }

  function stopRequest() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
  }

  async function handleAnalyze() {
    if (!images.length || activeRequest.current || activeFile.current) return;
    setError('');

    const previous = lastProof.current;
    if (previous?.images === images && previous.marks === marks) {
      setProof(previous);
      setStatus('Solution ready.');
      scrollToOutput();
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setProof(null);
    setStatus('Uploading crops and generating your solution…');

    try {
      const result = await analyzeMathQuestion(images, marks, controller.signal);
      if (activeRequest.current !== controller) return;
      const completed = { images, marks, result };
      lastProof.current = completed;
      setProof(completed);
      setStatus('Solution ready.');
      scrollToOutput();
    } catch (issue) {
      if (activeRequest.current !== controller) return;
      setError(issue instanceof Error ? issue.message : 'Could not solve the question. Try again.');
      setStatus('Could not complete the request.');
      scrollToOutput();
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fcfdfe]">
      <Header />

      {file && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/95 text-sm text-white" role="status">
            Opening crop editor…
          </div>
        }>
          <ImageCropper file={file} onCropComplete={cropped => handleCropComplete(cropped, file)} onCancel={closeCrop} />
        </Suspense>
      )}

      <main className="mx-auto w-full max-w-5xl flex-grow px-4 py-5 sm:py-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 lg:col-span-5">
            <div className="space-y-5 rounded-[2.5rem] border border-slate-100 bg-white p-5 shadow-2xl shadow-slate-200/40 sm:p-6 lg:sticky lg:top-8">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Question Workspace</h2>
                <span className="text-right text-[10px] font-bold text-slate-600">Gemini 3.8 Flash</span>
              </div>

              <ImageUpload
                onImageSelect={openCrop}
                onRemoveImage={index => updateImages(images.filter((_, position) => position !== index))}
                onClearAll={() => updateImages([])}
                images={images}
                disabled={loading || !!file}
              />

              <MarksSelector
                selected={marks}
                onChange={next => {
                  if (next === marks) return;
                  setMarks(next);
                  setProof(null);
                  setError('');
                  setStatus(`Solution depth set to ${next} ${next === 1 ? 'mark' : 'marks'}.`);
                }}
                disabled={loading}
              />

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading || !images.length || !!file}
                  className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-black uppercase tracking-tight text-white shadow-xl transition-all hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none"
                >
                  {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />}
                  {loading ? 'Solving…' : 'Generate Proof'}
                  {!loading && <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>}
                </button>
                {loading ? (
                  <button
                    type="button"
                    onClick={() => { stopRequest(); setStatus('Request canceled. Your crops are ready to retry.'); }}
                    className="min-h-11 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs font-bold uppercase text-amber-900"
                  >
                    Cancel Solve
                  </button>
                ) : images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { updateImages([]); setMarks(4); }}
                    className="min-h-11 w-full rounded-2xl border border-red-200 bg-red-50 px-4 text-[10px] font-black uppercase tracking-widest text-red-700 shadow-sm transition-colors hover:bg-red-100"
                  >
                    Clear Workspace
                  </button>
                )}
              </div>

              <div role="status" className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                <span>{status}</span>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${loading ? 'animate-pulse bg-amber-500' : error ? 'bg-red-500' : 'bg-slate-300'}`} aria-hidden="true" />
              </div>
            </div>
          </div>

          <section ref={resultRef} aria-label="Solution output" aria-busy={loading} className="min-w-0 scroll-mt-4 lg:col-span-7">
            {error && (
              <div role="alert" className="rounded-[2.5rem] border border-red-100 bg-red-50 p-6 text-red-800">
                <h3 className="mb-2 text-xs font-black uppercase tracking-widest">Couldn’t Generate a Solution</h3>
                <p className="break-words text-sm">{error}</p>
              </div>
            )}

            {!proof && !error && (
              <div className="flex min-h-[215px] flex-col items-center justify-center rounded-[3rem] border border-slate-100 bg-white p-8 text-center shadow-sm lg:min-h-[550px]">
                <div className="mb-5 rounded-full bg-slate-50 p-5 lg:mb-8 lg:p-10" aria-hidden="true">
                  {loading ? (
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-emerald-500 lg:h-16 lg:w-16" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-12 w-12 text-slate-300 lg:h-16 lg:w-16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">{loading ? 'Generating Solution' : 'Solution Preview'}</h3>
              </div>
            )}

            {proof && <ResultView result={proof.result} marks={proof.marks} />}
          </section>
        </div>
      </main>

      <footer className="mt-8 border-t border-slate-100 bg-white px-4 py-7 sm:mt-16">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:justify-between">
          <span>BSc Synthesis Lab</span>
          <span>57mm Thermal LaTeX</span>
        </div>
      </footer>
    </div>
  );
}
