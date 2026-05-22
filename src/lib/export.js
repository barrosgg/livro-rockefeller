/* Utilitário para baixar um elemento DOM como PNG. */
import html2canvas from 'html2canvas';

export async function baixarComoPng(elemento, filename) {
  if (!elemento) return;
  const canvas = await html2canvas(elemento, {
    backgroundColor: null,
    scale: 2,           // qualidade retina
    useCORS: true,
    logging: false,
  });
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, 'image/png');
}
