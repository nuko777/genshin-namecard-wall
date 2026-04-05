import html2canvas from 'html2canvas';

export async function exportPreview(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#fafafa',
    scale: 2,
  });
  return canvas.toDataURL('image/png');
}
