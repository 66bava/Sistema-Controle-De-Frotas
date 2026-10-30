import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { temaDocumento as cor } from './documentoModel.js';
const regular = fileURLToPath(
  new URL('../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff', import.meta.url)
);
const medium = fileURLToPath(
  new URL('../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff', import.meta.url)
);
function textoPdf(value) {
  return String(value).replace(/→/g, ' > ').replace(/↔/g, ' < > ');
}
export function gerarPdf(modelo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: modelo.codigo + ' · Ocorrências diárias de transporte',
        Author: 'Controle de Frotas',
        Subject: 'Registro de viagem',
      },
    });
    const buffers = [];
    doc.on('data', (data) => buffers.push(data));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    try {
      doc.registerFont('Regular', regular);
      doc.registerFont('Medium', medium);
      const x = 40,
        width = doc.page.width - 80;
      let y = 40;
      function text(
        value,
        left,
        top,
        { size = 10, font = 'Regular', color = cor.grafite, w = width, align = 'left' } = {}
      ) {
        doc
          .font(font)
          .fontSize(size)
          .fillColor(color)
          .text(textoPdf(value), left, top, { width: w, lineBreak: false, align });
      }
      function continued() {
        text('Controle de Frotas', x, 34, { size: 10, font: 'Medium' });
        text(modelo.codigo + ' · continuação', x + 270, 34, {
          size: 9,
          w: width - 270,
          align: 'right',
          color: cor.textoSecundario,
        });
        doc
          .moveTo(x, 55)
          .lineTo(x + width, 55)
          .lineWidth(2)
          .stroke(cor.verde);
        y = 74;
      }
      function ensure(height) {
        if (y + height > doc.page.height - 64) {
          doc.addPage();
          continued();
        }
      }
      function linhas(value, w, size = 10, font = 'Regular') {
        doc.font(font).fontSize(size);
        const result = [];
        for (const paragraph of textoPdf(value).split(/\r?\n/)) {
          let line = '';
          for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const tentativa = line ? line + ' ' + word : word;
            if (doc.widthOfString(tentativa) <= w) {
              line = tentativa;
              continue;
            }
            if (line) {
              result.push(line);
              line = '';
            }
            for (const char of Array.from(word)) {
              if (line && doc.widthOfString(line + char) > w) {
                result.push(line);
                line = '';
              }
              line += char;
            }
          }
          result.push(line);
        }
        return result;
      }
      function heading(label) {
        ensure(70);
        text(label.toUpperCase(), x, y, { size: 8, font: 'Medium', color: cor.textoSecundario });
        y += 19;
      }
      function grid(values, cols, { size = 10 } = {}) {
        const cell = width / cols;
        for (let i = 0; i < values.length; i += cols) {
          const row = values.slice(i, i + cols),
            wrapped = row.map((pair) => linhas(pair[1], cell - 24, size));
          const height = Math.max(49, 28 + Math.max(...wrapped.map((lines) => lines.length)) * 13);
          ensure(height);
          row.forEach(([label], j) => {
            doc
              .save()
              .strokeOpacity(0.25)
              .lineWidth(0.5)
              .rect(x + j * cell, y, cell, height)
              .stroke(cor.textoSecundario)
              .restore();
            text(label.toUpperCase(), x + j * cell + 12, y + 10, {
              size: 7,
              font: 'Medium',
              color: cor.textoSecundario,
              w: cell - 24,
            });
            wrapped[j].forEach((line, n) =>
              text(line, x + j * cell + 12, y + 25 + n * 13, { size, w: cell - 24 })
            );
          });
          y += height;
        }
      }
      doc.roundedRect(x, y, width, 112, 12).fill(cor.grafite);
      doc.roundedRect(x + 16, y + 16, 26, 26, 7).fill(cor.verde);
      text('F', x + 24, y + 20, { size: 17, font: 'Medium', color: cor.verdeEscuro, w: 20 });
      text('Controle de Frotas', x + 52, y + 20, {
        size: 10,
        font: 'Medium',
        color: cor.textoClaro,
        w: 250,
      });
      text(modelo.codigo, x + width - 150, y + 20, {
        size: 12,
        font: 'Medium',
        color: cor.verde,
        w: 134,
        align: 'right',
      });
      text('OCORRÊNCIAS DIÁRIAS', x + 17, y + 57, {
        size: 17,
        font: 'Medium',
        color: cor.textoClaro,
        w: width - 34,
      });
      text('DE TRANSPORTE', x + 17, y + 79, {
        size: 17,
        font: 'Medium',
        color: cor.textoClaro,
        w: width - 34,
      });
      y += 127;
      const statusLines = linhas(modelo.status, width - 24, 9, 'Medium');
      doc.roundedRect(x, y, width, 20 + statusLines.length * 12, 7).fill(cor.verde);
      statusLines.forEach((line, n) =>
        text(line, x + 12, y + 9 + n * 12, {
          size: 9,
          font: 'Medium',
          color: cor.verdeEscuro,
          w: width - 24,
        })
      );
      y += 32 + statusLines.length * 12;
      heading('Identificação');
      grid(modelo.identificacao, 2);
      y += 17;
      heading('Dados da viagem · horário de Brasília');
      grid(modelo.horarios, 4, { size: 9 });
      grid(modelo.quilometragem, 3, { size: 11 });
      y += 17;
      heading('Itinerário');
      for (const line of linhas(modelo.itinerario, width, 10)) {
        ensure(14);
        text(line, x, y, { size: 10 });
        y += 14;
      }
      y += 17;
      heading('Passageiros');
      for (const nome of modelo.passageiros.length
        ? modelo.passageiros
        : ['Nenhum passageiro informado.']) {
        const nomeLinhas = linhas(nome, width - 12, 10);
        ensure(nomeLinhas.length * 14 + 3);
        for (const line of nomeLinhas) {
          text(line, x + 8, y, { size: 10, w: width - 8 });
          y += 14;
        }
        y += 3;
      }
      y += 14;
      const assinaturaLinhas = linhas(modelo.assinaturaInfo, width, 8);
      ensure(19 + (modelo.assinatura ? 119 : 46) + assinaturaLinhas.length * 12);
      heading('Assinatura do condutor');
      if (modelo.assinatura) {
        doc
          .save()
          .strokeOpacity(0.25)
          .lineWidth(0.5)
          .roundedRect(x, y, width, 108, 8)
          .stroke(cor.textoSecundario)
          .restore();
        doc.image(modelo.assinatura, x + 12, y + 8, {
          fit: [width - 24, 92],
          align: 'left',
          valign: 'center',
        });
        y += 119;
      } else {
        doc
          .moveTo(x, y + 34)
          .lineTo(x + width, y + 34)
          .lineWidth(0.5)
          .stroke(cor.textoSecundario);
        y += 46;
      }
      for (const line of assinaturaLinhas) {
        ensure(12);
        text(line, x, y, { size: 8, color: cor.textoSecundario });
        y += 12;
      }
      const range = doc.bufferedPageRange();
      for (let p = 0; p < range.count; p++) {
        doc.switchToPage(p);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .moveTo(x, doc.page.height - 47)
          .lineTo(x + width, doc.page.height - 47)
          .lineWidth(0.5)
          .stroke(cor.textoSecundario);
        text(modelo.codigo + ' · Revisão ' + modelo.revisao, x, doc.page.height - 39, {
          size: 7,
          w: 180,
          color: cor.textoSecundario,
        });
        text('Emitido em ' + modelo.emissao + ' · Brasília', x + 160, doc.page.height - 39, {
          size: 7,
          w: width - 160,
          color: cor.textoSecundario,
          align: 'right',
        });
        text(modelo.nota, x, doc.page.height - 25, {
          size: 6.7,
          w: width - 85,
          color: cor.textoSecundario,
        });
        text('Página ' + (p + 1) + ' de ' + range.count, x + width - 85, doc.page.height - 25, {
          size: 7,
          w: 85,
          color: cor.textoSecundario,
          align: 'right',
        });
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
