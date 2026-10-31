#!/bin/zsh
# Instala dependências e abre o VoiceStudio (gerado pelo Claude)
cd "$(dirname "$0")"
export PATH="$HOME/.bun/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  echo "==> Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash || exit 1
  export PATH="$HOME/.bun/bin:$PATH"
fi
echo "==> bun $(bun --version)"
echo "==> bun install"
bun install || { echo "FALHOU: bun install"; read; exit 1; }
echo "==> bun run setup:api (pode demorar vários minutos)"
bun run setup:api || { echo "FALHOU: setup:api"; read; exit 1; }
echo "==> Iniciando VoiceStudio (bun run dev)"
bun run dev
