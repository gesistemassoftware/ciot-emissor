# Emissor de CIOT (multi-tenant)

Plataforma de emissão de CIOT (Código Identificador da Operação de Transporte)
integrada **diretamente com a ANTT**, via webservice PEF do programa
"CIOT Para Todos" — gratuito, mas restrito a ETC com frota própria vinculada
ao RNTRC.

Cada conta cadastrada representa uma transportadora (cliente). Isso é
obrigatório pela própria regra da ANTT: o certificado ICP-Brasil usado para
autenticar a emissão tem que ser o do CNPJ do transportador que está
declarando a operação — não existe "emitir em nome de vários clientes" com um
certificado só.

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000, crie uma conta em `/cadastro` e faça login.
Sem `DATABASE_URL` configurado, os dados ficam num banco Postgres embarcado
(PGlite) salvo em `./data/pglite` — zero setup para desenvolver.

## Fluxo da plataforma

1. Cliente cria conta em `/cadastro` (razão social, CNPJ, RNTRC, tipo de
   transportador).
2. Em `/configuracoes`, o cliente escolhe o ambiente (homologação/produção) e
   envia o próprio certificado ICP-Brasil (.pfx) + senha. Isso fica
   criptografado no banco (AES-256-GCM) e só é decifrado no momento da
   chamada à ANTT.
3. Sem certificado cadastrado, a emissão em `/` roda em **modo simulado**
   (gera um CIOT fake), permitindo testar o fluxo sem depender da ANTT.
4. Com certificado, cada emissão chama de verdade o webservice
   `DeclaracaoOperacaoTransporte` da ANTT, usando o certificado e os dados de
   transportador daquela conta.
5. Cada emissão também informa **Contratado/Proprietário do Veículo**,
   **Destinatário** e **Tomador do Serviço** — cadastros reutilizáveis por
   CPF/CNPJ (a transportadora pode subcontratar motoristas/veículos diferentes
   a cada operação, ex: TAC-Agregado). Ao digitar um CPF/CNPJ já usado antes,
   os demais campos são preenchidos automaticamente; só o CPF/CNPJ (e RNTRC,
   no caso do contratado) é enviado à ANTT — o resto (endereço, contato) fica
   guardado na plataforma só para reaproveitamento, no mesmo padrão usado por
   sistemas de operadoras de CIOT.
6. Quando **Composição veicular = sim**, aparece a seção **Implemento**
   (reboque/semirreboque) — vira uma segunda entrada no array `Veiculos` da
   declaração.
7. Depois de emitido (status EMITIDO, fora do modo simulado), cada linha do
   histórico ganha ações **Cancelar**, **Encerrar** e **Consultar status**,
   que chamam `CancelamentoOperacaoTransporte`, `EncerramentoOperacaoTransporte`
   e `ConsultarCIOTGerado` na ANTT.
8. Tipo de operação e datas da viagem ficam no topo da tela; o restante da
   "Operação de transporte" é dividido em duas abas — **Carga** (frete, peso,
   natureza e tipo de carga) e **Viagens** (origem/destino por busca de
   cidade, distância) — para reduzir a quantidade de campos visíveis de uma
   vez.

## Integrações auxiliares

- **Busca de CNPJ (ReceitaWS)** e **CEP (ViaCEP)**: preenchem automaticamente
  razão social/endereço nos cadastros de contratado/destinatário/tomador.
  APIs públicas gratuitas, sem chave — a ReceitaWS tem limite de ~3
  requisições/minuto no plano gratuito.
- **Roteirizador (distância entre municípios)**: código IBGE → nome do
  município (API do IBGE) → coordenadas (Nominatim/OpenStreetMap) → distância
  rodoviária (OSRM, servidor de demonstração público). Estimativa útil para
  preencher rápido, mas os servidores públicos do Nominatim/OSRM têm limite de
  uso e não são garantidos para produção em volume — para escala, troque por
  um provedor pago (Google, HERE, Mapbox) ou OSRM auto-hospedado. Ver
  `src/lib/distancia.ts`.
- **Piso Mínimo de Frete (ANTT)**: a
  [calculadora oficial](https://calculadorafrete.antt.gov.br) não expõe API
  JSON — é um formulário ASP.NET clássico. `src/lib/pisoMinimo.ts` automatiza
  o mesmo fluxo que um navegador faria (captura token anti-forgery + cookie,
  envia o formulário, lê o HTML de resposta). Funciona hoje, mas **depende da
  estrutura HTML do site da ANTT** — se eles reformularem o site, essa
  integração quebra e precisa ser ajustada.

## Pré-requisitos reais (fora do código) — por cliente

1. **Ser ETC com frota própria** e RNTRC ativo — o webservice direto da ANTT
   não atende TAC/CTC nem ETC sem frota própria.
2. **Certificado digital ICP-Brasil A1 ou A3** emitido para o CNPJ da própria
   empresa.
3. **Solicitar à ANTT o host e contexto exatos** de cada serviço. O
   [Documento de Contrato de Serviço (DCS) PEF v1.1](https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/documentos-tecnicos)
   informa textualmente que isso precisa ser pedido à ANTT durante a
   implementação — não está documentado publicamente. Os domínios usados aqui
   (`appservices[-hml].antt.gov.br/pefServices`) são os únicos citados no
   próprio DCS; confirme o caminho completo de `DeclaracaoOperacaoTransporte`
   com a ANTT antes de apontar clientes para produção.
4. Testar primeiro no **ambiente de homologação**.

### Códigos e tabelas oficiais da ANTT

- `codigoMunicipioOrigem` / `codigoMunicipioDestino`: buscados por nome da
  cidade na aba "Viagens" (autocomplete), a partir de `src/lib/data/municipios.json`
  (snapshot da lista de municípios do IBGE — 5.571 registros).
- `codigoNaturezaCarga`: buscado por descrição ou código na aba "Carga"
  (autocomplete), a partir de `src/lib/data/naturezaCarga.json` — os 3 códigos
  especiais definidos pela ANTT (0001 carga diversa, 0002 embalagens/paletes
  vazios usados, 0003 embalagens contaminadas vazias) mais os 957 códigos de
  4 dígitos ("posição") do Sistema Harmonizado (NCM), conforme instruções de
  cadastramento da ANTT. Gerado a partir da tabela oficial do Siscomex/CAMEX;
  como a NCM é atualizada periodicamente por resolução, revalide esse
  snapshot de tempos em tempos.

## Deploy no Vercel

1. Suba este repositório no GitHub e importe o projeto em
   https://vercel.com/new.
2. Crie um banco Postgres (na própria Vercel: aba Storage → Create Database →
   Postgres/Neon) e conecte ao projeto — isso preenche `DATABASE_URL`
   automaticamente.
3. Em Settings → Environment Variables, defina:
   - `CERT_ENCRYPTION_KEY` — string aleatória forte (`openssl rand -hex 32`).
     **Obrigatório**: sem isso o upload de certificado é recusado em produção.
   - `SESSION_SECRET` — outra string aleatória forte.
4. Faça o deploy. Na primeira requisição, o schema do banco é criado
   automaticamente (`migrar()` em `src/lib/db.ts`).
5. Cada cliente acessa a URL pública, cria a própria conta e cadastra o
   próprio certificado em `/configuracoes`.

Se a chave de criptografia (`CERT_ENCRYPTION_KEY`) for perdida ou trocada, os
certificados já salvos deixam de poder ser decifrados — os clientes
precisariam reenviar o arquivo.

## Estrutura

- `src/lib/db.ts` — conexão com banco (Postgres real ou PGlite local) e migração do schema
- `src/lib/crypto.ts` — criptografia AES-256-GCM do certificado/senha em repouso
- `src/lib/auth/` — sessão (JWT em cookie httpOnly) e repositório de contas
- `src/lib/ciot/types.ts` — tipos do domínio, alinhados ao schema `DeclaracaoOperacaoTransporte` da ANTT
- `src/lib/ciot/anttClient.ts` — integração real com a ANTT (TLS mútuo com certificado do cliente); inclui declaração, cancelamento, encerramento e consulta
- `src/lib/ciot/credenciais.ts` — monta as credenciais ANTT (baseUrl + certificado) de uma conta
- `src/lib/ciot/provider.ts` — escolhe entre chamada real e modo simulado
- `src/lib/ciot/store.ts` — emissões persistidas no banco, escopadas por conta
- `src/lib/ciot/terceiros.ts` — cadastro reutilizável de contratado/destinatário/tomador por CPF/CNPJ
- `src/lib/distancia.ts` — roteirizador (distância entre municípios via IBGE + Nominatim + OSRM)
- `src/lib/pisoMinimo.ts` — integração com a calculadora de Piso Mínimo de Frete da ANTT
- `src/lib/data/municipios.ts` + `municipios.json` — busca de município por nome (autocomplete)
- `src/lib/data/naturezaCarga.ts` + `naturezaCarga.json` — busca de natureza da carga por código/descrição (autocomplete)
- `src/proxy.ts` — protege as rotas, redireciona para `/login` sem sessão (convenção "Proxy" do Next.js 16, antigo `middleware.ts`)
- `src/app/cadastro`, `src/app/login` — telas de conta
- `src/app/configuracoes` — perfil da transportadora + upload de certificado
- `src/app/page.tsx` — formulário de emissão + histórico (escopado à conta logada)
