/**
 * Voice provider abstraction — Web Speech API implementation.
 * ─────────────────────────────────────────────────────────────
 * Deliberately isolated behind a small, named-export interface
 * (isSpeechRecognitionSupported, isSpeechSynthesisSupported, createRecognizer,
 * speak, cancelSpeaking) so Live Interview never talks to `window.speech*`
 * directly. Swapping to a cloud STT/TTS vendor later means writing a new
 * file with this same interface — nothing in InterviewPreparation.jsx
 * would need to change.
 *
 * Zero backend involvement, zero cost, zero external credentials — this is
 * 100% browser-native and works (or gracefully doesn't) independent of
 * Gemini/API keys. Every function fails soft: if the browser doesn't
 * support something, callers get `null`/a no-op back, never a throw — the
 * UI always has a working text fallback regardless of what this reports.
 */

function SpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return !!SpeechRecognitionCtor();
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

/**
 * Creates a one-shot speech recognizer. Returns null if unsupported —
 * callers must treat that as "no voice input here, text only" rather than
 * erroring.
 *
 * @param {object} opts
 * @param {(r:{final:string, interim:string}) => void} opts.onResult
 * @param {(errorCode:string) => void} opts.onError
 * @param {() => void} opts.onEnd
 * @param {string} [opts.lang]
 * @returns {SpeechRecognition|null} — caller calls .start() / .stop()
 */
export function createRecognizer({ onResult, onError, onEnd, lang = "en-US" } = {}) {
  const Ctor = SpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognizer = new Ctor();
  recognizer.lang = lang;
  recognizer.interimResults = true;
  recognizer.continuous = false;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    let final = "";
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    onResult?.({ final, interim });
  };
  recognizer.onerror = (event) => onError?.(event.error || "unknown_error");
  recognizer.onend = () => onEnd?.();

  return recognizer;
}

/**
 * Speaks text aloud. No-ops (and immediately fires onEnd) if unsupported or
 * text is empty — callers don't need to branch on support themselves.
 */
export function speak(text, { lang = "en-US", rate = 1, onStart, onEnd, onError } = {}) {
  if (!isSpeechSynthesisSupported() || !text) {
    onEnd?.();
    return null;
  }
  // Never let two questions overlap in speech.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (event) => onError?.(event.error || "unknown_error");
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function cancelSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
