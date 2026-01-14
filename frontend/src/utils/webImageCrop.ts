export type CropPixels = { x: number; y: number; width: number; height: number };

export async function loadImageWeb(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const Img = (globalThis as unknown as { Image: new () => HTMLImageElement }).Image;
    const img = new Img();
    // For public CDN URLs this avoids tainting the canvas; for local file/blob URLs it’s harmless.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function blobToDataUrlWeb(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Failed to read image'));
    r.onload = () => resolve(String(r.result || ''));
    r.readAsDataURL(blob);
  });
}

/**
 * Convert a percent crop (relative to the *viewport*) into natural image pixels,
 * accounting for `object-fit: cover|contain`.
 */
export function percentCropToPixelsWeb(args: {
  img: HTMLImageElement;
  percentCrop: { x: number; y: number; width: number; height: number };
  objectFit?: 'cover' | 'contain';
}): CropPixels | null {
  const { img, percentCrop } = args;
  const rect = img.getBoundingClientRect();
  const viewW = Math.max(1, rect.width);
  const viewH = Math.max(1, rect.height);
  const natW = Math.max(1, img.naturalWidth);
  const natH = Math.max(1, img.naturalHeight);

  const fit = args.objectFit ?? 'cover';
  const scale =
    fit === 'contain' ? Math.min(viewW / natW, viewH / natH) : Math.max(viewW / natW, viewH / natH);
  const scaledW = natW * scale;
  const scaledH = natH * scale;
  // cover: scaled image can overflow view; offset is how much is cropped away (>=0)
  // contain: view can have letterbox; offset is how much empty padding exists (>=0)
  const offsetX =
    fit === 'contain' ? Math.max(0, (viewW - scaledW) / 2) : Math.max(0, (scaledW - viewW) / 2);
  const offsetY =
    fit === 'contain' ? Math.max(0, (viewH - scaledH) / 2) : Math.max(0, (scaledH - viewH) / 2);

  const xView = (percentCrop.x / 100) * viewW;
  const yView = (percentCrop.y / 100) * viewH;
  const wView = (percentCrop.width / 100) * viewW;
  const hView = (percentCrop.height / 100) * viewH;

  const xNat = fit === 'contain' ? (xView - offsetX) / scale : (xView + offsetX) / scale;
  const yNat = fit === 'contain' ? (yView - offsetY) / scale : (yView + offsetY) / scale;
  const wNat = wView / scale;
  const hNat = hView / scale;

  if (![xNat, yNat, wNat, hNat].every((n) => Number.isFinite(n))) return null;

  return {
    x: Math.max(0, Math.floor(xNat)),
    y: Math.max(0, Math.floor(yNat)),
    width: Math.max(1, Math.floor(Math.min(wNat, natW - xNat))),
    height: Math.max(1, Math.floor(Math.min(hNat, natH - yNat))),
  };
}

export async function cropToJpegBlobWeb(args: {
  imageSrc: string;
  cropPixels: CropPixels;
  outWidth: number;
  outHeight: number;
  quality: number;
}): Promise<Blob> {
  const img = await loadImageWeb(args.imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = args.outWidth;
  canvas.height = args.outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const c = args.cropPixels;
  ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, args.outWidth, args.outHeight);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create image blob'))),
      'image/jpeg',
      args.quality,
    );
  });
}

export function centeredAspectCropPixels(args: {
  img: HTMLImageElement;
  aspect: number;
}): CropPixels {
  const natW = Math.max(1, args.img.naturalWidth);
  const natH = Math.max(1, args.img.naturalHeight);
  const aspect = args.aspect;
  const currentAspect = natW / natH;

  let w = natW;
  let h = natH;
  if (currentAspect > aspect) {
    // too wide
    h = natH;
    w = Math.floor(h * aspect);
  } else {
    // too tall
    w = natW;
    h = Math.floor(w / aspect);
  }

  return {
    x: Math.floor((natW - w) / 2),
    y: Math.floor((natH - h) / 2),
    width: Math.max(1, w),
    height: Math.max(1, h),
  };
}
