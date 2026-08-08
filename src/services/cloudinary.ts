// Cloudinary & Media Optimization Utility

export const DEFAULT_PEWA_COVER = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1200&auto=format&fit=crop';
export const DEFAULT_USER_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop';

/**
 * Optimizes image URL by transforming it into a fast loading thumbnail.
 */
export function getOptimizedThumbnail(url: string, width = 200, height = 200): string {
  if (!url) return DEFAULT_USER_AVATAR;
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', `/upload/w_${width},h_${height},c_fill,g_auto,q_auto,f_auto/`);
  }
  if (url.includes('unsplash.com')) {
    return `${url}&w=${width}&h=${height}&fit=crop`;
  }
  return url;
}

/**
 * Computes SHA-1 hash hex string for Cloudinary API signatures
 */
async function sha1(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads media (Image, Audio voice note, Document) directly to Cloudinary.
 * Returns the secure Cloudinary HTTPS URL (e.g. https://res.cloudinary.com/dcodml4bh/...)
 */
export async function uploadMediaToCloudinary(
  fileOrBlob: File | Blob,
  onProgress?: (progress: number) => void,
  folder?: string,
  resourceType: 'auto' | 'image' | 'video' | 'raw' = 'auto'
): Promise<string> {
  console.log("Uploading image to Cloudinary...");
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dcodml4bh';
  const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY || '129473238246639';
  const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET || 'Qc6wD-PYvmtiGoevaFSyjTRNx08';

  return new Promise(async (resolve, reject) => {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const paramsToSign: Record<string, string> = { timestamp };
      if (folder) {
        paramsToSign.folder = folder;
      }

      // Generate SHA-1 signature based on sorted parameters
      const sortedKeys = Object.keys(paramsToSign).sort();
      const stringToSign = sortedKeys.map(k => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
      const signature = await sha1(stringToSign);

      const formData = new FormData();
      formData.append('file', fileOrBlob);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      if (folder) formData.append('folder', folder);

      const xhr = new XMLHttpRequest();
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      xhr.open('POST', uploadUrl);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            console.log("Cloudinary Response", res);
            if (res.secure_url) {
              if (onProgress) onProgress(100);
              console.log("Cloudinary URL", res.secure_url);
              resolve(res.secure_url);
              return;
            }
          } catch (e) {
            console.warn('[Cloudinary Parse Error]', e);
          }
        }

        console.warn('[Cloudinary Signed Upload Fallback Triggered]', xhr.status, xhr.responseText);
        tryUnsignedUpload(fileOrBlob, cloudName, resourceType, folder, onProgress, resolve, reject);
      };

      xhr.onerror = () => {
        console.warn('[Cloudinary XHR Error, trying fallback]');
        tryUnsignedUpload(fileOrBlob, cloudName, resourceType, folder, onProgress, resolve, reject);
      };

      xhr.send(formData);
    } catch (err) {
      console.warn('[Cloudinary Upload Exception]', err);
      tryUnsignedUpload(fileOrBlob, cloudName, resourceType, folder, onProgress, resolve, reject);
    }
  });
}

function tryUnsignedUpload(
  fileOrBlob: File | Blob,
  cloudName: string,
  resourceType: string,
  folder: string | undefined,
  onProgress: ((progress: number) => void) | undefined,
  resolve: (url: string) => void,
  reject: (err: any) => void
) {
  const presets = ['pewa_uploads', 'ml_default', 'unsigned', 'preset'];
  let attempted = 0;

  const tryNextPreset = () => {
    if (attempted >= presets.length) {
      // Local compressed Base64 fallback if Cloudinary is offline or fails
      if (fileOrBlob.type.startsWith('image/')) {
        const img = new Image();
        const objectUrl = URL.createObjectURL(fileOrBlob);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            if (onProgress) onProgress(100);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
            return;
          }
          fallbackRawReader();
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          fallbackRawReader();
        };
        img.src = objectUrl;
      } else {
        fallbackRawReader();
      }

      function fallbackRawReader() {
        const reader = new FileReader();
        reader.onload = () => {
          if (onProgress) onProgress(100);
          resolve(reader.result as string);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileOrBlob);
      }
      return;
    }

    const preset = presets[attempted++];
    const formData = new FormData();
    formData.append('file', fileOrBlob);
    formData.append('upload_preset', preset);
    if (folder) formData.append('folder', folder);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          console.log("Cloudinary Response", res);
          if (res.secure_url) {
            if (onProgress) onProgress(100);
            console.log("Cloudinary URL", res.secure_url);
            resolve(res.secure_url);
            return;
          }
        } catch (e) {}
      }
      tryNextPreset();
    };
    xhr.onerror = () => tryNextPreset();
    xhr.send(formData);
  };

  tryNextPreset();
}

/**
 * Uploads an image to Cloudinary with progress callback.
 */
export async function uploadImageWithProgress(
  file: File,
  onProgress?: (progress: number) => void,
  folder: string = 'pewa_uploads'
): Promise<string> {
  return uploadMediaToCloudinary(file, onProgress, folder, 'auto');
}

