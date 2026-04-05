import { useCallback, useEffect, useRef, useState } from "react";
import { isNativePlatform } from "../utils/platform";

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

type NativeCameraPermissionState = "granted" | "limited" | "denied" | "prompt" | string;
type NativeCameraPlugin = {
  requestPermissions?: (options: {
    permissions: string[];
  }) => Promise<{ camera?: NativeCameraPermissionState }>;
  checkPermissions?: () => Promise<{ camera?: NativeCameraPermissionState }>;
};

function getNativeCameraPlugin(): NativeCameraPlugin | null {
  const plugins = (globalThis as { Capacitor?: { Plugins?: { Camera?: NativeCameraPlugin } } })
    ?.Capacitor?.Plugins;
  return plugins?.Camera ?? null;
}

/**
 * Request camera permission via the Capacitor Camera plugin (native)
 * or fall through to the browser prompt (web).
 *
 * Returns true when permission is granted.
 */
async function requestCameraPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const camera = getNativeCameraPlugin();
      if (!camera?.requestPermissions) return false;
      const status = await camera.requestPermissions({
        permissions: ["camera"],
      });
      console.log("[Camera] Capacitor permission status:", status);
      return status.camera === "granted" || status.camera === "limited";
    } catch (err) {
      console.warn("[Camera] Capacitor permission request failed:", err);
      return false;
    }
  }
  // On web the browser handles permission via getUserMedia
  return true;
}

/**
 * Check current camera permission without prompting.
 */
async function checkCameraPermission(): Promise<
  "granted" | "denied" | "prompt"
> {
  if (isNativePlatform()) {
    try {
      const camera = getNativeCameraPlugin();
      if (!camera?.checkPermissions) return "prompt";
      const status = await camera.checkPermissions();
      if (status.camera === "granted" || status.camera === "limited")
        return "granted";
      if (status.camera === "denied") return "denied";
      return "prompt";
    } catch {
      return "prompt";
    }
  }
  // Web: use the Permissions API if available
  try {
    const result = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return result.state as "granted" | "denied" | "prompt";
  } catch {
    return "prompt";
  }
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

  // Check browser / WebView support
  useEffect(() => {
    const check = async () => {
      // On native, camera is always "supported" (native plugin handles it)
      if (isNativePlatform()) {
        setIsSupported(true);
        return;
      }
      const supported = !!navigator.mediaDevices?.getUserMedia;
      setIsSupported(supported);
    };
    check();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
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

        console.log("[Camera] Requesting media stream:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("[Camera] Media stream acquired");

        if (!isMountedRef.current) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return null;
        }

        return stream;
      } catch (err: unknown) {
        const error = err as { name?: string };
        let errorType: CameraError["type"] = "unknown";
        let errorMessage = "Failed to access camera";

        if (error.name === "NotAllowedError") {
          errorType = "permission";
          errorMessage = "Camera permission denied";
        } else if (error.name === "NotFoundError") {
          errorType = "not-found";
          errorMessage = "No camera device found";
        } else if (error.name === "NotSupportedError") {
          errorType = "not-supported";
          errorMessage = "Camera is not supported";
        }

        console.error("[Camera] getUserMedia failed:", errorType, errorMessage);
        throw { type: errorType, message: errorMessage };
      }
    },
    [width, height],
  );

  const setupVideo = useCallback(async (stream: MediaStream) => {
    if (!videoRef.current) return false;

    const video = videoRef.current;
    video.srcObject = stream;

    return new Promise<boolean>((resolve) => {
      const onLoadedMetadata = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);

        // Try to play the video
        video.play().catch((err) => {
          console.warn("[Camera] Video autoplay failed:", err);
        });

        resolve(true);
      };

      const onError = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeEventListener("error", onError);
        resolve(false);
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);

      // Handle case where metadata is already loaded
      if (video.readyState >= 1) {
        onLoadedMetadata();
      }
    });
  }, []);

  const startCamera = useCallback(async (): Promise<boolean> => {
    if (isSupported === false || isLoading) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // On native, request permission via Capacitor first
      if (isNativePlatform()) {
        const permStatus = await checkCameraPermission();
        console.log("[Camera] Current permission:", permStatus);

        if (permStatus === "denied") {
          const granted = await requestCameraPermission();
          if (!granted) {
            throw {
              type: "permission" as const,
              message:
                "Camera permission denied. Please enable it in device settings.",
            };
          }
        } else if (permStatus === "prompt") {
          const granted = await requestCameraPermission();
          if (!granted) {
            throw {
              type: "permission" as const,
              message: "Camera permission is required for scanning.",
            };
          }
        }
        console.log("[Camera] Permission granted, opening stream...");
      }

      // Clean up any existing stream
      cleanup();

      const stream = await createMediaStream(currentFacingMode);
      if (!stream) return false;

      streamRef.current = stream;
      const success = await setupVideo(stream);

      if (success && isMountedRef.current) {
        setIsActive(true);
        console.log("[Camera] Camera started successfully");
        return true;
      }

      cleanup();
      return false;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err as CameraError);
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
    currentFacingMode,
    cleanup,
    createMediaStream,
    setupVideo,
  ]);

  const stopCamera = useCallback(async (): Promise<void> => {
    if (isLoading) return;

    setIsLoading(true);
    cleanup();
    setError(null);

    // Small delay to ensure cleanup is complete
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
        // Clean up current stream
        cleanup();

        // Update facing mode
        setCurrentFacingMode(targetFacingMode);

        // Small delay to ensure cleanup
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
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err as CameraError);
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

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      // Mirror front camera image
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
    // State
    isActive,
    isSupported,
    error,
    isLoading,
    currentFacingMode,

    // Actions
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    retry,

    // Refs for components
    videoRef,
    canvasRef,
  };
};
