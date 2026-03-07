import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, Loader2, X, ImagePlus, FileText, Clipboard } from 'lucide-react';
import { scanMail } from '../services/api';

export default function Scanner() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
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
            // Give the blob a readable filename
            const ext = item.type.split('/')[1] || 'png';
            const named = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: item.type });
            handleFile(named);
          }
          return;
        }
      }
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setError(null);
  }

  async function handleScan() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await scanMail(file);
      // Mail is now processing in the background — go to dashboard
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isPdf = file?.type === 'application/pdf';

  return (
    <div className="scanner">
      <h2>Scan Your Mail</h2>
      <p className="subtitle">Take a photo or upload an image of your postal mail</p>

      {!file ? (
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={48} strokeWidth={1.5} />
          <p>Drop an image or PDF here, or tap to browse</p>
          <p className="paste-hint"><Clipboard size={14} /> or press <kbd>Ctrl+V</kbd> to paste a screenshot</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            hidden
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="preview-container">
          <button className="clear-btn" onClick={clearFile} title="Remove">
            <X size={18} />
          </button>
          {isPdf ? (
            <div className="pdf-preview">
              <FileText size={48} strokeWidth={1.5} />
              <p>{file.name}</p>
            </div>
          ) : (
            <img src={preview} alt="Mail preview" className="preview-image" />
          )}
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
          onChange={(e) => handleFile(e.target.files[0])}
        />

        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={!file || loading}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>Scan & Analyze</span>
            </>
          )}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
