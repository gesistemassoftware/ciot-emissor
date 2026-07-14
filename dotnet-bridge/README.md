# Ponte .NET — geração do IdOperacaoTransporte

O DCS PEF v1.1 exige que o campo `IdOperacaoTransporte` da declaração seja
"ID da administradora + dígito verificador" — um código que só a própria
ANTT gera (não é um cálculo local). A ANTT disponibiliza isso via um DLL
oficial, baixado de:

- Homologação: https://appservices-hml.antt.gov.br/pefServices/Downloads/GeradorCIOT_DLL.zip
- Produção: https://appservices.antt.gov.br/pefServices/Downloads/GeradorCIOT_DLL.zip

O DLL (`GeradorCIOTShared.dll`, em `lib/`) internamente chama
`.../pefServices/token` e `.../pefServices/gerar` na própria ANTT — a versão
de homologação já vem com uma chave de acesso de teste embutida, então
funciona sem nenhuma credencial extra. **A versão de produção deve ser
baixada separadamente e provavelmente exige o credenciamento formal da
empresa como administradora junto à ANTT** — troque o arquivo em `lib/`
por essa versão antes de usar em produção, e reteste.

## O que tem aqui

- `GeradorCiot/` — projeto .NET 8 (console) que referencia o DLL e expõe
  uma CLI simples: `GeradorCiot <cpfCnpj>` → imprime `{"ok":true,"ciot":"..."}`
  ou `{"ok":false,"erro":"..."}` no stdout.
- `lib/GeradorCIOTShared.dll` — o DLL oficial da ANTT (homologação).
- `bin/linux-x64/GeradorCiot` — binário self-contained (runtime .NET
  embutido) para produção no Render.
- `bin/win-x64/GeradorCiot.exe` — idem, para desenvolvimento local no
  Windows.

Node chama o binário do sistema operacional correspondente via
`child_process` (veja `src/lib/ciot/geradorCiotBridge.ts`) — não precisa
instalar .NET no Render, o runtime já está embutido no binário.

## Como reconstruir (se o DLL for atualizado, ex: trocar para produção)

```bash
# 1. Baixe o dotnet SDK 8 (https://dot.net) se não tiver.
# 2. Substitua lib/GeradorCIOTShared.dll pela versão desejada.
cd dotnet-bridge/GeradorCiot
dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -o ../bin/linux-x64-novo
dotnet publish -c Release -r win-x64   --self-contained true -p:PublishSingleFile=true -o ../bin/win-x64-novo
# depois mova os executáveis para bin/linux-x64/GeradorCiot e bin/win-x64/GeradorCiot.exe
```
