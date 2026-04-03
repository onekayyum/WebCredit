import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "customer-photos-v2";
const MAX_DIMENSION = 400;
const JPEG_QUALITY = 0.75;

function getPhotoMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePhotoMap(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > height) {
        if (width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

export function useCustomerPhoto(customerId: bigint) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const customerKey = customerId.toString();

  useEffect(() => {
    const map = getPhotoMap();
    const data = map[customerKey];
    if (data) setPhotoUrl(data);
    else setPhotoUrl(null);
  }, [customerKey]);

  const uploadPhoto = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const dataUrl = await compressImage(file);
        const map = getPhotoMap();
        map[customerKey] = dataUrl;
        savePhotoMap(map);
        setPhotoUrl(dataUrl);
      } finally {
        setIsUploading(false);
      }
    },
    [customerKey],
  );

  return { photoUrl, uploadPhoto, isUploading };
}
