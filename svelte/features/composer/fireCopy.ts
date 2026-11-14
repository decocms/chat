const en = {
  retry: "Try sending again",
  discard: "Discard this utterance",
  title: "Fire mode",
  micHint:
    "Tap to dictate · hold 3 s (or Space with the box empty) to talk live with your Claude",
  switching: "switching your Claude to Haiku…",
  ready: "ready",
  failed: "couldn't switch the model",
  leaving: "going back to the previous model…",
  talking: "talking…",
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
    "The previous model hasn't been confirmed. Leave Fire again to request restoration.",
};
const pt: typeof en = {
  retry: "Tentar mandar de novo",
  discard: "Descartar esta fala",
  title: "Modo Fire",
  micHint:
    "Toque pra ditar · segure 3 s (ou espaço com a caixa vazia) pra falar ao vivo com teu Claude",
  switching: "trocando teu Claude pro Haiku…",
  ready: "pronto",
  failed: "não troquei o modelo",
  leaving: "voltando pro modelo de antes…",
  talking: "falando…",
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
    "O modelo anterior ainda não foi confirmado. Saia do Fire de novo para pedir a restauração.",
};
export const fireCopy = (lang: string | undefined) =>
  lang?.startsWith("en") ? en : pt;
