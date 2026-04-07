# Atlas Corp v2.1.0

Atlas Corp agora e tratado como um produto chat-first.

## O que esta versao entrega

- Electron + React + TypeScript + Vite
- chat principal como centro do produto
- backend local protegido
- threads persistentes
- streaming preparado na arquitetura
- execucao Windows via build local
- boot defensivo do backend embutido
- fallback honesto quando a camada local degrada

## Principios

- menos cockpit
- mais conversa funcionando
- menos scaffold
- mais operacao real
- menos remendo
- mais causa-raiz corrigida

## Desenvolvimento

Use Node instalado no Windows. Quando o shim `npm.cmd` estiver instavel, rode o npm via `node.exe` apontando para `npm-cli.js`.

## Build

- `npm run build`
- `npm run dist`

## Seguranca

A API key nao deve ficar no frontend nem versionada no repositorio.
Use variavel de ambiente local ou arquivo de configuracao local fora do versionamento.

## Direcao

A base canonica do Atlas deve ser:
- chat-first
- backend obrigatorio
- chave protegida
- streaming real
- persistencia por thread
- UI sobria e utilizavel