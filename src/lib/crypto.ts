import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Criptografia em repouso para o certificado ICP-Brasil e a senha dele.
 * AES-256-GCM com chave derivada de CERT_ENCRYPTION_KEY.
 *
 * Sem essa variável definida, cai numa chave de desenvolvimento — o que é
 * inseguro e bloqueado explicitamente em produção (veja checarChaveEmProducao).
 */

const CHAVE_DEV = "chave-de-desenvolvimento-nao-use-em-producao";

function obterChave(): Buffer {
  const segredo = process.env.CERT_ENCRYPTION_KEY ?? CHAVE_DEV;
  return scryptSync(segredo, "ciot-emissor-salt", 32);
}

export function checarChaveEmProducao() {
  if (process.env.NODE_ENV === "production" && !process.env.CERT_ENCRYPTION_KEY) {
    throw new Error(
      "CERT_ENCRYPTION_KEY não configurado em produção. Defina uma chave forte antes de aceitar certificados de clientes."
    );
  }
}

export function encrypt(dado: Buffer): { dados: Buffer; iv: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", obterChave(), iv);
  const cifrado = Buffer.concat([cipher.update(dado), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { dados: Buffer.concat([cifrado, tag]), iv };
}

export function decrypt(dados: Buffer, iv: Buffer): Buffer {
  const tag = dados.subarray(dados.length - 16);
  const cifrado = dados.subarray(0, dados.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", obterChave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]);
}
