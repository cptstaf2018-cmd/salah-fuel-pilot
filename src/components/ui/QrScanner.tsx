"use client";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

type QrScannerProps = {
  /** Called once per successful read; the scanner stops itself first. */
  onResult: (payload: string) => void;
};

/**
 * Reads a citizen's QR from the operator's phone camera.
 *
 * Decoding is done in JavaScript rather than through the native
 * BarcodeDetector, which Android has and iOS does not — station staff use
 * whatever phone they own, so one code path that works on both is worth more
 * than the native speed on half of them.
 */
export function QrScanner({ onResult }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // Releasing the camera on unmount matters: a forgotten stream keeps the
  // phone's camera light on and drains the battery through a whole shift.
  useEffect(() => stop, [stop]);

  async function start() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("هذا المتصفح لا يدعم الكاميرا. استخدم الإدخال اليدوي بالأسفل.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // The back camera is the one pointed at the citizen's phone.
        video: { facingMode: { ideal: "environment" } }
      });

      streamRef.current = stream;
      setScanning(true);

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const tick = () => {
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height, {
              inversionAttempts: "dontInvert"
            });

            if (found?.data) {
              stop();
              onResult(found.data.trim());
              return;
            }
          }
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch {
      setError("تعذر فتح الكاميرا. تأكد من منح الإذن، أو استخدم الإدخال اليدوي بالأسفل.");
      stop();
    }
  }

  return (
    <div className="scanner">
      {error && (
        <p className="banner" data-tone="critical" role="alert">
          {error}
        </p>
      )}

      <div className="scanner-stage" data-active={scanning}>
        <video ref={videoRef} playsInline muted aria-label="معاينة الكاميرا" />
        {scanning && <span className="scanner-reticle" aria-hidden />}
        {!scanning && <p className="scanner-hint">وجّه الكاميرا إلى رمز QR الخاص بالمواطن</p>}
      </div>

      <canvas ref={canvasRef} hidden />

      {scanning ? (
        <button type="button" className="btn" onClick={stop}>
          إيقاف الكاميرا
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => void start()}>
          ◎ فتح الكاميرا ومسح الرمز
        </button>
      )}
    </div>
  );
}
