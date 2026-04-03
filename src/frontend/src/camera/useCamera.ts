import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraConfig {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  quality?: number;
  format?: "image/jpeg" | "image/png" | "image/webp";
}

export interface CameraError {
  type: "permission" | "not-supported" | "not-found" | "unknown";
  message: string;
}

function isLocalhostHost(): boolean {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
  );
}

export const useCamera = (config: CameraConfig = {}) => {
  const {
    facingMode = "environment",
    width = 1920,
    height = 1080,
    quality = 0.8,
    format = "image/jpeg",
  } = config;

  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    const hasMedia = !!navigator.mediaDevices?.getUserMedia;
    const secure = window.isSecureContext || isLocalhostHost();
    const supported = hasMedia && secure;

    console.debug("[camera] support check", {
      hasMediaDevices: hasMedia,
      secureContext: window.isSecureContext,
      protocol: window.location.protocol,
      host: window.location.host,
      localhostException: isLocalhostHost(),
      supported,
    });

    setIsSupported(supported);
    if (!supported) {
      setError({
        type: "not-supported",
        message:
          "Camera requires HTTPS (or localhost) and a supported browser.",
      });
    }
  }, []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const waitForVideoElement =
    useCallback(async (): Promise<HTMLVideoElement | null> => {
      const start = Date.now();
      while (Date.now() - start < 1500) {
        if (videoRef.current) return videoRef.current;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return null;
    }, []);

  const createMediaStream = useCallback(
    async (facing: "user" | "environment") => {
      try {
        const constraints = {
          video: {
            facingMode: facing,
            width: { ideal: width },
            height: { ideal: height },
          },
        };

        console.debug("[camera] requesting getUserMedia", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.debug("[camera] getUserMedia success", {
          tracks: stream.getTracks().map((t) => t.kind),
        });

        if (!isMountedRef.current) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return null;
        }

        return stream;
      } catch (err: any) {
        console.error("[camera] getUserMedia failed", err);

        let errorType: CameraError["type"] = "unknown";
        let errorMessage = "Failed to access camera";

        if (err?.name === "NotAllowedError") {
          errorType = "permission";
          errorMessage =
            "Camera permission denied. Please allow camera access in browser settings.";
        } else if (err?.name === "NotFoundError") {
          errorType = "not-found";
          errorMessage = "No camera device found";
        } else if (err?.name === "NotSupportedError") {
          errorType = "not-supported";
          errorMessage = "Camera is not supported in this browser";
        } else if (err?.name === "NotReadableError") {
          errorType = "unknown";
          errorMessage = "Camera is already in use by another application";
        }

        throw { type: errorType, message: errorMessage };
      }
    },
    [width, height],
  );

  const setupVideo = useCallback(
    async (stream: MediaStream) => {
      const video = await waitForVideoElement();
      if (!video) {
        console.error("[camera] video element not mounted in time");
        return false;
      }

      video.srcObject = stream;

      return new Promise<boolean>((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("error", onError);

          video
            .play()
            .then(() => {
              console.debug("[camera] video playback started");
              resolve(true);
            })
            .catch((err) => {
              console.warn("[camera] video play() failed", err);
              resolve(true);
            });
        };

        const onError = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("error", onError);
          console.error("[camera] video element error");
          resolve(false);
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("error", onError);

        if (video.readyState >= 1) {
          onLoadedMetadata();
        }
      });
    },
    [waitForVideoElement],
  );

  const startCamera = useCallback(async (): Promise<boolean> => {
    console.debug("[camera] startCamera called");

    if (isSupported === false || isLoading) {
      console.warn("[camera] start blocked", { isSupported, isLoading });
      if (isSupported === false) {
        setError({
          type: "not-supported",
          message:
            "Camera is unavailable. Use HTTPS (or localhost) and a modern browser.",
        });
      }
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      cleanup();

      const stream = await createMediaStream(currentFacingMode);
      if (!stream) return false;

      streamRef.current = stream;
      const success = await setupVideo(stream);

      if (success && isMountedRef.current) {
        setIsActive(true);
        return true;
      }

      cleanup();
      return false;
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err);
      }
      cleanup();
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    isSupported,
    isLoading,
    cleanup,
    createMediaStream,
    currentFacingMode,
    setupVideo,
  ]);

  const stopCamera = useCallback(async (): Promise<void> => {
    if (isLoading) return;

    setIsLoading(true);
    cleanup();
    setError(null);

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (isMountedRef.current) {
      setIsLoading(false);
    }
  }, [isLoading, cleanup]);

  const switchCamera = useCallback(
    async (newFacingMode?: "user" | "environment"): Promise<boolean> => {
      if (isSupported === false || isLoading) {
        return false;
      }

      const targetFacingMode =
        newFacingMode ||
        (currentFacingMode === "user" ? "environment" : "user");

      setIsLoading(true);
      setError(null);

      try {
        cleanup();
        setCurrentFacingMode(targetFacingMode);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const stream = await createMediaStream(targetFacingMode);
        if (!stream) return false;

        streamRef.current = stream;
        const success = await setupVideo(stream);

        if (success && isMountedRef.current) {
          setIsActive(true);
          return true;
        }

        cleanup();
        return false;
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err);
        }

        cleanup();
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      isSupported,
      isLoading,
      currentFacingMode,
      cleanup,
      createMediaStream,
      setupVideo,
    ],
  );

  const retry = useCallback(async (): Promise<boolean> => {
    if (isLoading) return false;

    setError(null);
    await stopCamera();
    await new Promise((resolve) => setTimeout(resolve, 200));
    return startCamera();
  }, [isLoading, stopCamera, startCamera]);

  const capturePhoto = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current || !isActive) {
        resolve(null);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      if (currentFacingMode === "user") {
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0);
      } else {
        ctx.drawImage(video, 0, 0);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const extension = format.split("/")[1];
            const file = new File([blob], `photo_${Date.now()}.${extension}`, {
              type: format,
            });
            resolve(file);
          } else {
            resolve(null);
          }
        },
        format,
        quality,
      );
    });
  }, [isActive, format, quality, currentFacingMode]);

  return {
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    retry,
    videoRef,
    canvasRef,
  };
};
