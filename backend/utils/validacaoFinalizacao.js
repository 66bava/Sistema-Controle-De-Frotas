import { PNG } from 'pngjs';
import { ErroHttp } from './erroHttp.js';
import { validarSaida } from './validacaoOcorrencia.js';
function campos(body, nomes) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !nomes.includes(key))
  )
    throw new ErroHttp(422, 'Confira os dados enviados para finalizar a viagem.');
}
export function validarChegada(body) {
  campos(body, ['chegada_em', 'km_final']);
  const km = body.km_final;
  if (
    typeof km !== 'number' ||
    !Number.isFinite(km) ||
    km < 0 ||
    km > 999999999.9 ||
    Math.abs(km * 10 - Math.round(km * 10)) > 0.00001
  )
    throw new ErroHttp(422, 'Informe o km final com até uma casa decimal.');
  let chegada;
  try {
    chegada = validarSaida(body.chegada_em);
  } catch {
    throw new ErroHttp(422, 'Informe uma data e horário de chegada válidos no fuso de Brasília.');
  }
  return { chegada_em: chegada, km_final: km };
}
export function validarAssinatura(body) {
  campos(body, ['assinatura', 'revisao']);
  if (!Number.isInteger(body.revisao) || body.revisao < 1 || body.revisao > 4294967295)
    throw new ErroHttp(422, 'Reabra a ocorrência e confira os dados antes de assinar.');
  const valor = body.assinatura;
  const erro = () => new ErroHttp(422, 'Desenhe uma assinatura válida na área indicada.');
  if (
    typeof valor !== 'string' ||
    valor.length > 350000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(valor)
  )
    throw erro();
  const base64 = valor.slice('data:image/png;base64,'.length);
  const buffer = Buffer.from(base64, 'base64');
  if (
    buffer.length < 33 ||
    buffer.length > 256 * 1024 ||
    buffer.toString('base64') !== base64 ||
    buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  )
    throw erro();
  const width = buffer.readUInt32BE(16),
    height = buffer.readUInt32BE(20);
  if (width < 100 || height < 50 || width > 1600 || height > 800) throw erro();
  let png;
  try {
    png = PNG.sync.read(buffer, { checkCRC: true });
  } catch {
    throw erro();
  }
  let pixels = 0,
    x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        a = png.data[i + 3] / 255;
      const brilho = ((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3) * a + 255 * (1 - a);
      if (brilho < 220) {
        pixels++;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  if (pixels < 24 || pixels > width * height * 0.8 || x1 - x0 < 8 || y1 - y0 < 3) throw erro();
  const imagem = PNG.sync.write(png, { colorType: 6 });
  if (imagem.length > 256 * 1024) throw erro();
  return { imagem, revisao: body.revisao };
}
