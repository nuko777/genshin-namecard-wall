import html2canvas from 'html2canvas';

export async function exportPreview(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#fafafa',
    scale: 2,
    onclone: (_document, clonedElement) => {
      const brand = _document.createElement('div');
      brand.style.textAlign = 'left';
      brand.style.marginBottom = '12px';
      brand.style.fontFamily = '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif';

      const titleRow = _document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = '8px';

      const favicon = _document.createElement('img');
      favicon.src = '/export-logo.png';
      favicon.alt = '';
      favicon.style.width = '24px';
      favicon.style.height = '24px';
      favicon.style.flex = '0 0 auto';

      const title = _document.createElement('div');
      title.textContent = '提瓦特色谱';
      title.style.fontSize = '22px';
      title.style.lineHeight = '1.25';
      title.style.fontWeight = '800';
      title.style.letterSpacing = '0.08em';
      title.style.color = '#1f2937';
      titleRow.append(favicon, title);

      const source = _document.createElement('div');
      source.textContent = 'from genshin-ncw.lobo777.top';
      source.style.marginTop = '3px';
      source.style.fontSize = '10px';
      source.style.lineHeight = '1.2';
      source.style.color = '#6b7280';

      brand.append(titleRow, source);
      clonedElement.insertBefore(brand, clonedElement.firstChild);
      return new Promise<void>(resolve => {
        if (favicon.complete && favicon.naturalWidth > 0) {
          resolve();
          return;
        }
        favicon.onload = () => resolve();
        favicon.onerror = () => resolve();
      });
    },
  });
  return canvas.toDataURL('image/png');
}
