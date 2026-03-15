import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Square, Play, Pause, Trash2, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitVoiceMemo } from '../services/api';

const MAX_SECONDS = 120; // 2 minute cap

export default function VoiceRecorder() {
  const [phase, setPhase] = useState('idle'); // idle | requesting | recording | preview | analyzing
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mimeType, setMimeType] = useState('audio/webm');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const navigate = useNavigate();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  function stopStream() {
    const stream = mediaRecorderRef.current?.stream;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  async function startRecording() {
    setError(null);
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mime = preferred.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      setMimeType(mime || 'audio/webm');

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setPhase('preview');
        stopStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect chunks every 250ms
      setSeconds(0);
      setPhase('recording');

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access in your browser settings.'
          : err.name === 'NotFoundError'
          ? 'No microphone found. Please connect a microphone and try again.'
          : `Could not start recording: ${err.message}`;
      setError(msg);
      setPhase('idle');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function discard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setSeconds(0);
    setIsPlaying(false);
    setError(null);
    setPhase('idle');
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }

  async function handleAnalyze() {
    if (!audioBlob) return;
    if (seconds < 1) {
      setError('Recording is too short. Please record at least 1 second.');
      return;
    }
    setPhase('analyzing');
    setError(null);
    try {
      const result = await submitVoiceMemo(audioBlob, mimeType);
      navigate(`/mail/${result.id}`);
    } catch (err) {
      setError(err.message);
      setPhase('preview');
    }
  }

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="voice-recorder">
      {phase === 'idle' && (
        <div className="voice-idle">
          <div className="voice-icon-ring">
            <Mic size={36} />
          </div>
          <p className="voice-hint">Tap to start recording your reminder</p>
          <p className="voice-hint-sub">Speak naturally — Robin will extract the date, amount, and key details</p>
          <button className="btn btn-primary voice-start-btn" onClick={startRecording}>
            <Mic size={20} /> Start Recording
          </button>
        </div>
      )}

      {phase === 'requesting' && (
        <div className="voice-idle">
          <Loader2 size={36} className="spin voice-loader" />
          <p className="voice-hint">Requesting microphone access…</p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="voice-recording">
          <div className="voice-waveform">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="voice-bar" style={{ animationDelay: `${(i * 50) % 500}ms` }} />
            ))}
          </div>
          <div className="voice-timer">{formatTime(seconds)}</div>
          <p className="voice-hint recording-hint">Recording… speak your reminder</p>
          {seconds >= MAX_SECONDS - 10 && (
            <p className="voice-limit-warn">Max 2 minutes — finalizing soon</p>
          )}
          <button className="btn btn-danger voice-stop-btn" onClick={stopRecording}>
            <Square size={18} fill="currentColor" /> Stop Recording
          </button>
        </div>
      )}

      {(phase === 'preview' || phase === 'analyzing') && (
        <div className="voice-preview">
          <div className="voice-preview-header">
            <Mic size={20} />
            <span>Recording complete — {formatTime(seconds)}</span>
          </div>

          {/* Hidden audio element for playback */}
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />

          <div className="voice-playback-bar">
            <button
              className="btn btn-secondary voice-play-btn"
              onClick={togglePlayback}
              disabled={phase === 'analyzing'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'Pause' : 'Play back'}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="voice-preview-actions">
            <button
              className="btn btn-ghost"
              onClick={discard}
              disabled={phase === 'analyzing'}
            >
              <Trash2 size={16} /> Discard
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={phase === 'analyzing'}
            >
              {phase === 'analyzing' ? (
                <><Loader2 size={18} className="spin" /> Analyzing…</>
              ) : (
                <><Sparkles size={18} /> Analyze & Save</>
              )}
            </button>
          </div>

          {phase === 'analyzing' && (
            <p className="voice-analyzing-hint">
              Robin is transcribing your memo and extracting reminder details…
            </p>
          )}
        </div>
      )}

      {error && phase === 'idle' && (
        <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>
      )}
    </div>
  );
}
