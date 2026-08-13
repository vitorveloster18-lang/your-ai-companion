# Avatar abstrato + memória local + múltiplos agentes

Substituir a dependência de vídeos por um avatar abstrato animado, guardar tudo no
navegador (sem backend) e permitir conectar vários agentes.

## 1. Orb abstrato (substitui os vídeos)

Novo componente `AvatarOrb` desenhado em canvas:
- Círculo com anéis de ondas concêntricas que reagem ao áudio (amplitude real do
  microfone quando o usuário fala, e da fala sintetizada quando o agente responde).
- Estados: standby (respiração lenta), listening (ondas puxadas para dentro),
  thinking (partículas orbitando), speaking (ondas pulsando com a voz).
- Cores por humor: alegre (âmbar/coral), triste (azul), surpresa (ciano), raiva
  (vermelho), calma/standby (violeta suave). Transição suave entre paletas.
- O palco de vídeo continua existindo como opção; um seletor em Configurações
  escolhe "Orb" (padrão) ou "Vídeo".

## 2. Memória sem backend

Memória local em IndexedDB/localStorage:
- Histórico de conversa por agente, com limite configurável.
- "Fatos" lembrados (nome do usuário, preferências) extraídos manualmente ou por
  comando, enviados como contexto no prompt.
- Botões: ver, editar e limpar memória em Configurações. Exportar/importar JSON.

## 3. Múltiplos agentes

Nova aba "Agentes" nas configurações, lista salva localmente:
- Tipo **Supabase**: URL do projeto, anon key, nome da função — várias instâncias.
- Tipo **Local (Python)**: URL base (ex. `http://localhost:8000/chat`), método,
  cabeçalhos opcionais.
- Tipo **Lovable AI** (opcional, usa o gateway já disponível).
- Seletor rápido de agente ativo na tela principal.
- Nota: agentes locais precisam liberar CORS no servidor Python.

## 4. Voz

- Manter Web Speech (grátis, offline).
- Adicionar opção **Kokoro**: campo de URL da API + chave, com fallback automático
  para Web Speech se falhar. Funciona com qualquer endpoint Kokoro (self-host ou
  provedor) — não existe API Kokoro pública oficial gratuita.
- O áudio retornado alimenta a animação do orb.

## 5. Fora do escopo agora

- **Ícone flutuante sobre outros apps**: só é possível em app nativo Android
  (permissão de sobreposição). Um site/PWA não pode desenhar por cima de outros
  apps. Alternativa possível: instalar como PWA em tela cheia e, no desktop,
  usar Picture-in-Picture para manter o orb visível sobre outras janelas.
- **MCP**: os conectores MCP são ferramentas do ambiente de desenvolvimento, não
  algo que o app publicado consome. Se o objetivo é o agente usar ferramentas
  externas, o caminho é um endpoint de agente (Supabase ou Python) que já fale
  MCP do lado dele.

## Detalhes técnicos

- `src/components/AvatarOrb.tsx`: canvas 2D + `requestAnimationFrame`,
  `AnalyserNode` da Web Audio API para amplitude; paleta via tokens CSS.
- `src/lib/agents.ts`: tipos e CRUD dos agentes em localStorage.
- `src/lib/memory.ts`: histórico + fatos, persistidos localmente.
- `src/lib/tts.ts`: abstração Web Speech / Kokoro.
- `SettingsPanel` ganha as seções Agentes, Memória e Aparência (Orb/Vídeo).
