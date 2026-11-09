/**
 * Reads an image file from the user's local disk, optionally scales it down
 * to a reasonable maximum dimension (default 800x800) and compresses it,
 * returning a lightweight Base64 data URL suitable for local storage.
 */
export async function readAndCompressImage(file: File, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Il file selezionato non è un\'immagine valida.'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Errore durante la lettura del file.'));

    reader.onload = () => {
      const result = reader.result as string;

      // If in browser environment with Image and Canvas, downscale if needed
      if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          // Only downscale if larger than maxWidth or maxHeight
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            // Fallback to raw base64 if canvas context fails
            resolve(result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // High quality JPEG compression for optimal storage size
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.86);
          resolve(compressedDataUrl);
        };

        img.onerror = () => {
          // Fallback to original base64 if loading image fails
          resolve(result);
        };

        img.src = result;
      } else {
        resolve(result);
      }
    };

    reader.readAsDataURL(file);
  });
}
