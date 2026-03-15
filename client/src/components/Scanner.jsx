import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, Loader2, X, ImagePlus, FileText, Clipboard, Plus, Mic } from 'lucide-react';
import { scanMail } from '../services/api';
import VoiceRecorder from './VoiceRecorder';

export default function Scanner() {
  const [mode, setMode] = useState('scan'); // 'scan' | 'voice'
  const [pages, setPages] = useState([]); // Array of { file, preview }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const addPageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const navigate = useNavigate();

  // Listen for Ctrl+V paste from clipboard (e.g. Windows Snipping Tool)
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const named = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: item.type });
            addPage(named);
          }
          return;
        }
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [pages]);

  function addPage(f) {
    if (!f || pages.length >= 10) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPages((prev) => [...prev, { file: f, preview: e.target.result }]);
    };
    reader.readAsDataURL(f);
  }

  function addMultipleFiles(fileList) {
    const remaining = 10 - pages.length;
    Array.from(fileList).slice(0, remaining).forEach(addPage);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addMultipleFiles(e.dataTransfer.files);
  }

  function removePage(index) {
    setPages((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function clearAll() {
    setPages([]);
    setError(null);
  }

  async function handleScan() {
    if (pages.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await scanMail(pages.map((p) => p.file));
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const hasPages = pages.length > 0;

  return (
    <div className="scanner">
      <h2>Scan Your Mail</h2>

      {/* Mode toggle */}
      <div className="scanner-mode-tabs">
        <button
          className={`scanner-mode-tab ${mode === 'scan' ? 'active' : ''}`}
          onClick={() => setMode('scan')}
        >
          <ImagePlus size={16} /> Document Scan
        </button>
        <button
          className={`scanner-mode-tab ${mode === 'voice' ? 'active' : ''}`}
          onClick={() => setMode('voice')}
        >
          <Mic size={16} /> Voice Reminder
        </button>
      </div>

      {mode === 'voice' ? (
        <VoiceRecorder />
      ) : (
        <>
      <p className="subtitle">
        {hasPages
          ? `${pages.length} page${pages.length > 1 ? 's' : ''} added — add more or scan now`
          : 'Take a photo or upload images of your mail'}
      </p>

      {!hasPages ? (
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={48} strokeWidth={1.5} />
          <p>Drop images or PDF here, or tap to browse</p>
          <p className="paste-hint"><Clipboard size={14} /> or press <kbd>Ctrl+V</kbd> to paste a screenshot</p>
          <p className="paste-hint">Multi-page documents: select multiple files at once</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            hidden
            onChange={(e) => addMultipleFiles(e.target.files)}
          />
        </div>
      ) : (
        <div className="pages-container">
          <div className="pages-grid">
            {pages.map((page, i) => {
              const isPdf = page.file?.type === 'application/pdf';
              return (
                <div className="page-thumb" key={i}>
                  <span className="page-number">{i + 1}</span>
                  <button className="page-remove" onClick={() => removePage(i)} title="Remove page">
                    <X size={14} />
                  </button>
                  {isPdf ? (
                    <div className="page-pdf">
                      <FileText size={28} strokeWidth={1.5} />
                      <span>{page.file.name}</span>
                    </div>
                  ) : (
                    <img src={page.preview} alt={`Page ${i + 1}`} />
                  )}
                </div>
              );
            })}

            {pages.length < 10 && (
              <button
                className="page-thumb add-page"
                onClick={() => addPageInputRef.current?.click()}
                title="Add another page"
              >
                <Plus size={28} strokeWidth={1.5} />
                <span>Add Page</span>
              </button>
            )}
          </div>
          <input
            ref={addPageInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            hidden
            onChange={(e) => addMultipleFiles(e.target.files)}
          />
          <button className="btn-link clear-all" onClick={clearAll}>Clear all pages</button>
        </div>
      )}

      <div className="scanner-actions">
        <button
          className="btn btn-secondary"
          onClick={() => cameraInputRef.current?.click()}
          disabled={loading}
        >
          <Camera size={20} />
          <span>Camera</span>
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => { if (e.target.files[0]) addPage(e.target.files[0]); }}
        />

        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={pages.length === 0 || loading}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>Scan {pages.length > 1 ? `${pages.length} Pages` : '& Analyze'}</span>
            </>
          )}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
        </>
      )}
    </div>
  );
}
