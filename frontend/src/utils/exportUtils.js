import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Download a Blob with the given filename
export const downloadBlob = (filename, content, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Export a Chart.js instance via ref to PNG/JPG/PDF
export const exportChartFromRef = (ref, filenameBase = 'chart', format = 'png') => {
  try {
    const inst = ref?.current || ref;
    if (!inst) {
      console.error('exportChartFromRef: chart ref not found');
      return false;
    }
    if (format === 'pdf') {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const img = inst.toBase64Image('image/png', 1);
      const h = w * 0.6;
      pdf.addImage(img, 'PNG', 10, 20, w - 20, h);
      pdf.save(`${filenameBase}.pdf`);
      return true;
    }
    let url = '';
    if (format === 'png') {
      url = inst.toBase64Image('image/png', 1);
    } else if (format === 'jpg' || format === 'jpeg') {
      const canvas = inst.canvas || inst.ctx?.canvas;
      url = canvas?.toDataURL ? canvas.toDataURL('image/jpeg', 0.92) : inst.toBase64Image('image/png', 1);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.${format === 'jpg' ? 'jpg' : 'png'}`;
      a.click();
      return true;
    }
    return false;
  } catch (e) {
    console.error('exportChartFromRef failed:', e);
    return false;
  }
};

// Export a DOM section by element id to PDF/PNG/JPG using html2canvas
export const exportSectionById = async (elId, filenameBase = 'section', format = 'pdf') => {
  try {
    const el = document.getElementById(elId);
    if (!el) {
      console.error('exportSectionById: element not found for id', elId);
      return false;
    }
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone: (doc) => {
        try {
          const node = doc.getElementById(elId);
          if (!node) return;
          // Force a safe white background on the root
          node.style.background = '#ffffff';
          // Global CSS override to avoid modern color functions and complex backgrounds
          const style = doc.createElement('style');
          style.type = 'text/css';
          style.textContent = `
            html, body, *, *::before, *::after {
              background-image: none !important;
              background-color: #ffffff !important;
              color: #111111 !important;
              box-shadow: none !important;
            }
            html, body {
              border-color: #e5e7eb !important;
              outline-color: #e5e7eb !important;
            }
            #${elId}, #${elId} * { 
              background-image: none !important; 
              background: none !important; 
              border-color: #e5e7eb !important; 
              box-shadow: none !important; 
              outline-color: #e5e7eb !important;
            }
            #${elId}::before, #${elId}::after, #${elId} *::before, #${elId} *::after { 
              content: none !important; 
              background: none !important; 
              box-shadow: none !important; 
            }
          `;
          doc.head.appendChild(style);
          const all = node.querySelectorAll('*');
          all.forEach((n) => {
            const win = doc.defaultView || window;
            let cs;
            try { cs = win.getComputedStyle(n); } catch (_) { cs = null; }
            const setIfIncludes = (prop, value) => {
              try {
                const v = cs ? cs.getPropertyValue(prop) : '';
                if (v && /oklch\(/i.test(v)) {
                  n.style.setProperty(prop, value, 'important');
                }
              } catch (_) {}
            };
            // Sanitize properties that may use oklch or gradients
            setIfIncludes('background-color', '#ffffff');
            setIfIncludes('color', '#111111');
            setIfIncludes('border-color', '#e5e7eb');
            // Drop complex backgrounds that may rely on oklch gradients
            try {
              const bg = cs ? cs.getPropertyValue('background-image') : '';
              if (bg && (/oklch\(/i.test(bg) || /gradient\(/i.test(bg))) {
                n.style.setProperty('background-image', 'none', 'important');
              }
            } catch (_) {}
            // Box-shadow can include color; if problematic, neutralize
            try {
              const bs = cs ? cs.getPropertyValue('box-shadow') : '';
              if (bs && /oklch\(/i.test(bs)) {
                n.style.setProperty('box-shadow', 'none', 'important');
              }
            } catch (_) {}
          });
        } catch (e) {
          // Do not throw from onclone
          // eslint-disable-next-line no-console
          console.warn('onclone sanitize failed:', e);
        }
      }
    });
    if (format === 'pdf') {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * (w - 20)) / canvas.width;
      const img = canvas.toDataURL('image/png');
      pdf.addImage(img, 'PNG', 10, 10, w - 20, Math.min(h, 277));
      pdf.save(`${filenameBase}.pdf`);
      return true;
    }
    const url = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.92);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.${format === 'jpg' ? 'jpg' : 'png'}`;
    a.click();
    return true;
  } catch (e) {
    console.error('exportSectionById failed:', e);
    return false;
  }
};

// Export a table (HTMLElement or CSS selector) to CSV
export const exportTableToCSV = (tableOrSelector, filename = 'table.csv') => {
  const table = typeof tableOrSelector === 'string' ? document.querySelector(tableOrSelector) : tableOrSelector;
  if (!table) return;
  const rows = [...table.querySelectorAll('tr')]
    .map(tr => [...tr.children]
      .map(td => String(td.innerText || '').replaceAll(',', ' ').replace(/\s+/g, ' ').trim())
      .join(','))
    .join('\n');
  downloadBlob(filename, rows, 'text/csv;charset=utf-8;');
};

// Export a table (HTMLElement or CSS selector) to Excel by serializing HTML
export const exportTableToExcel = (tableOrSelector, filename = 'table.xls') => {
  const table = typeof tableOrSelector === 'string' ? document.querySelector(tableOrSelector) : tableOrSelector;
  if (!table) return;
  const html = `\uFEFF<html><head><meta charset="UTF-8"></head><body>${table.outerHTML}</body></html>`;
  downloadBlob(filename, html, 'application/vnd.ms-excel');
};
