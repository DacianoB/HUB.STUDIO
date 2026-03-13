'use client';

const DEFAULT_PDF_PREVIEW_WIDTH = 960;

function readPdfPreviewWorkerUrl() {
  return new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
}

export async function createPdfPreviewImageFile(file: File) {
  if (typeof window === 'undefined') {
    return null;
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = readPdfPreviewWorkerUrl();
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  });
  let pdfDocument: Awaited<typeof loadingTask.promise> | null = null;

  try {
    pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.max(1, DEFAULT_PDF_PREVIEW_WIDTH / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      background: '#ffffff'
    }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    page.cleanup();

    if (!blob) {
      return null;
    }

    const previewName = `${file.name.replace(/\.pdf$/i, '') || 'document'}-preview.png`;

    return new File([blob], previewName, {
      type: 'image/png',
      lastModified: Date.now()
    });
  } finally {
    if (pdfDocument) {
      await pdfDocument.destroy();
    } else {
      await loadingTask.destroy();
    }
  }
}
