const en = {
  retry: "Try sending again",
  discard: "Discard this utterance",
  title: "Fire mode",
  micHint:
    "Tap to dictate · slide up (or hold Space with the box empty) to talk live with your Claude",
  switching: "opening your Haiku…",
  ready: "ready",
  failed: "the Haiku didn't open",
  leaving: "closing the Haiku…",
  talking: "listening…",
  locked: "listening · tap 🎤 to stop",
  hold: "hold Space and talk; let go to send · Esc leaves",
  transcribing: "transcribing…",
  sending: "sending…",
  sent: "sent",
  leave: "Leave Fire",
  unsupported: "This browser can't record audio.",
  permission: "The browser did not allow the microphone.",
  recording: "Couldn't record this utterance.",
  empty: "Didn't catch that, say it again.",
  unconfirmed:
    "The message isn't confirmed. Check the conversation before sending it again.",
  restore:
    "The Fire Claude may still be open. Leave Fire again to request closing it.",
};
const pt: typeof en = {
  retry: "Tentar mandar de novo",
  discard: "Descartar esta fala",
  title: "Modo Fire",
  micHint:
    "Toque pra ditar · arraste pra cima (ou segure espaço com a caixa vazia) pra falar ao vivo com teu Claude",
  switching: "abrindo teu Haiku…",
  ready: "pronto",
  failed: "o Haiku não abriu",
  leaving: "fechando o Haiku…",
  talking: "ouvindo…",
  locked: "ouvindo · toque no 🎤 pra parar",
  hold: "segure espaço e fale; solte pra mandar · Esc sai",
  transcribing: "transcrevendo…",
  sending: "mandando…",
  sent: "mandei",
  leave: "Sair do Fire",
  unsupported: "Este navegador não grava áudio.",
  permission: "O navegador não deixou usar o microfone.",
  recording: "Não deu pra gravar esta fala.",
  empty: "não entendi, fala de novo",
  unconfirmed:
    "A mensagem não foi confirmada. Confira a conversa antes de mandar de novo.",
  restore:
    "O Claude do Fire pode continuar aberto. Saia do Fire de novo para pedir o fechamento.",
};
export const fireCopy = (lang: string | undefined) =>
  lang?.startsWith("en") ? en : pt;
