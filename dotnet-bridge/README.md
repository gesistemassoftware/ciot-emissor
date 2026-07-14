# Ponte .NET — geração do IdOperacaoTransporte

O DCS PEF v1.1 exige que o campo `IdOperacaoTransporte` da declaração seja
"ID da administradora + dígito verificador" — um código que só a própria
ANTT gera (não é um cálculo local). A ANTT disponibiliza isso via um DLL
oficial, baixado de:

- Homologação: https://appservices-hml.antt.gov.br/pefServices/Downloads/GeradorCIOT_DLL.zip
- Produção: https://appservices.antt.gov.br/pefServices/Downloads/GeradorCIOT_DLL.zip

O DLL internamente chama `.../pefServices/token` e `.../pefServices/gerar`
na própria ANTT. A versão de **homologação** já vem com uma chave de
acesso de teste embutida, então funciona sem nenhuma credencial extra —
testado e confirmado. A versão de **produção** não expõe nenhuma URL/chave
nas strings do binário (diferente da de homologação) — ainda não foi
testada contra o servidor real; muito provavelmente exige o
credenciamento formal da empresa como administradora junto à ANTT antes
de funcionar (mesma pendência do chamado aberto com o suporte técnico).

A plataforma já escolhe automaticamente qual DLL/binário usar com base no
ambiente configurado pela conta (Homologação/Produção em Configurações) —
não precisa trocar nada manualmente.

## O que tem aqui

- `GeradorCiot/` — projeto .NET 8 (console) que referencia o DLL e expõe
  uma CLI simples: `GeradorCiot <cpfCnpj>` → imprime `{"ok":true,"ciot":"..."}`
  ou `{"ok":false,"erro":"..."}` no stdout. A propriedade de build
  `Ambiente` (`homologacao` ou `producao`) escolhe qual DLL é embutido.
- `lib/homologacao/GeradorCIOTShared.dll` e `lib/producao/GeradorCIOTShared.dll`
  — os DLLs oficiais da ANTT, um por ambiente.
- `bin/<linux-x64|win-x64>/<homologacao|producao>/GeradorCiot[.exe]` —
  binários self-contained (runtime .NET embutido) já publicados, um para
  cada combinação de sistema operacional × ambiente.

Node chama o binário certo (sistema operacional + ambiente da conta) via
`child_process` (veja `src/lib/ciot/geradorCiotBridge.ts` e
`src/lib/ciot/credenciais.ts`) — não precisa instalar .NET no Render, o
runtime já está embutido em cada binário.

## Como reconstruir (se algum DLL for atualizado)

```bash
# 1. Baixe o dotnet SDK 8 (https://dot.net) se não tiver.
# 2. Substitua lib/<ambiente>/GeradorCIOTShared.dll pela versão desejada.
cd dotnet-bridge/GeradorCiot

dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -p:Ambiente=homologacao -o ../bin/linux-x64/homologacao
dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -p:Ambiente=producao    -o ../bin/linux-x64/producao
dotnet publish -c Release -r win-x64   --self-contained true -p:PublishSingleFile=true -p:Ambiente=homologacao -o ../bin/win-x64/homologacao
dotnet publish -c Release -r win-x64   --self-contained true -p:PublishSingleFile=true -p:Ambiente=producao    -o ../bin/win-x64/producao
```

Depois de publicar, apague os `.pdb` gerados (símbolos de depuração, não
são necessários) antes de commitar.
