/**
 * Arquivos de requisicaoimagem guardados no S3 do apLIS.
 *
 * A réplica MySQL só traz o blob (`Img`) das fotos do tipo 10; pedido, frasco,
 * guia, CPF e os demais tipos ficam só no bucket do apLIS, em
 * `lab/Arquivos/Foto/<4 primeiros dígitos>/<NomArquivo>.<EXT>` (o NomArquivo
 * começa pelo CodRequisicao). O bucket recebe as fotos na sincronização diária
 * (~05:03 UTC), o mesmo atraso da réplica. Mesmo layout lido pelo
 * projeto-admissao (backend/src/clients/s3Client.ts).
 *
 * Variáveis de ambiente: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, AWS_REGION
 * (padrão sa-east-1) e S3_BUCKET_NAME (padrão aplis2).
 */

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

let cliente: S3Client | null = null;

function bucket(): string {
  return process.env.S3_BUCKET_NAME?.trim() || 'aplis2';
}

export function s3AplisConfigurado(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim());
}

function s3(): S3Client {
  if (!cliente) {
    cliente = new S3Client({
      region: process.env.AWS_REGION?.trim() || 'sa-east-1',
      credentials: {
        accessKeyId: (process.env.AWS_ACCESS_KEY_ID ?? '').trim(),
        secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY ?? '').trim(),
      },
    });
  }
  return cliente;
}

async function baixar(chave: string): Promise<Buffer> {
  const resposta = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: chave }));
  if (!resposta.Body) throw new Error(`S3 sem corpo para ${chave}`);
  return Buffer.from(await resposta.Body.transformToByteArray());
}

function ehNaoEncontrado(err: unknown): boolean {
  const nome = (err as { name?: string })?.name;
  return nome === 'NoSuchKey' || nome === 'NotFound';
}

/**
 * Bytes de `<nomArquivo>.<extensao>` no bucket, ou null se não estiver lá.
 * Tenta a chave exata; se não existir, lista a pasta do CodRequisicao e compara
 * sem diferenciar maiúsculas (extensão em caixa diferente, ou o arquivo numa
 * subpasta com o código da requisição).
 */
export async function lerArquivoAplisS3(nomArquivo: string, extensao: string | null): Promise<Buffer | null> {
  const nome = extensao ? `${nomArquivo}.${extensao}` : nomArquivo;
  const codRequisicao = nomArquivo.split('_')[0];
  if (codRequisicao.length < 4) return null;
  const pasta = `lab/Arquivos/Foto/${codRequisicao.slice(0, 4)}/`;

  try {
    return await baixar(`${pasta}${nome}`);
  } catch (err) {
    if (!ehNaoEncontrado(err)) throw err;
  }

  const lista = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: `${pasta}${codRequisicao}` }));
  const alvo = nome.toLowerCase();
  const chave = (lista.Contents ?? [])
    .map((obj) => obj.Key ?? '')
    .find((k) => k.split('/').pop()?.toLowerCase() === alvo);
  return chave ? baixar(chave) : null;
}
