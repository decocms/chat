const en = {
  close: "Close",
  ios: "On iPhone or iPad, open this site in Safari, share it, choose Add to Home Screen, then open the installed app to enable notifications.",
  install: "Install deco.chat on your phone",
  how: "How to install",
  installNow: "Install app",
  android:
    "Open the browser menu and choose Install app or Add to Home Screen. Open its icon and enable notifications.",
  benefits:
    "Receive alerts when someone mentions you or your agent asks for permission; open the app from your home screen.",
  failed:
    "Notification setup failed. Check browser permission and your connection, then retry.",
  unavailable: "Push notifications are not configured on this server.",
  storage:
    "This browser could not save the preference. It applies only to this tab.",
  notifications: "Notifications",
  notificationsHint:
    "Get notified on this device when someone talks to you, even with the tab closed.",
  sound: "Sound",
  soundHint: "Play a sound for new messages while the app is open.",
  denied:
    "Blocked in your browser. Allow notifications in this site's settings.",
  howAllow: "How to allow",
  allowSteps:
    "Click the lock or settings icon next to the address, open Notifications and choose Allow. Then turn this switch on. On a phone app, use the system settings for deco.chat.",
  iosHint: "Add deco.chat to your Home Screen to get notifications.",
  unsupported: "This browser doesn't support notifications.",
  enabling: "Turning on…",
  enableFailed: "Couldn't turn on notifications on this device.",
  tryAgain: "Try again",
  offer: "Notify you when someone talks to you?",
  offerOn: "Turn on",
  offerOff: "Off on this device",
  offerLater: "Not now",
} as const;
const pt: Record<keyof typeof en, string> = {
  close: "Fechar",
  ios: "No iPhone ou iPad, abra este site no Safari, toque em Compartilhar, escolha Adicionar à Tela de Início e abra o app instalado para ativar notificações.",
  install: "Instale o deco.chat no celular",
  how: "Como instalar",
  installNow: "Instalar o app",
  android:
    "Abra o menu do navegador e escolha Instalar app ou Adicionar à tela inicial. Abra pelo ícone e ative as notificações.",
  benefits:
    "Receba avisos quando alguém te marcar ou seu agent pedir permissão; abra o app pela tela inicial.",
  failed:
    "Não consegui configurar notificações. Confira a permissão e a conexão e tente de novo.",
  unavailable: "As notificações push não estão configuradas neste servidor.",
  storage: "O navegador não salvou a preferência. Ela vale só nesta aba.",
  notifications: "Notificações",
  notificationsHint:
    "Receba avisos neste aparelho quando falarem com você, mesmo com a aba fechada.",
  sound: "Som",
  soundHint: "Toca um som para novas mensagens enquanto o app está aberto.",
  denied:
    "Bloqueadas no navegador. Permita as notificações nas configurações deste site.",
  howAllow: "Como permitir",
  allowSteps:
    "Clique no cadeado ou no ícone de configurações ao lado do endereço, abra Notificações e escolha Permitir. Depois ligue esta chave. No app do celular, use os ajustes do sistema para o deco.chat.",
  iosHint: "Adicione o deco.chat à Tela de Início para receber notificações.",
  unsupported: "Este navegador não tem notificações.",
  enabling: "Ativando…",
  enableFailed: "Não deu para ativar as notificações neste aparelho.",
  tryAgain: "Tentar de novo",
  offer: "Avisar quando falarem com você?",
  offerOn: "Ativar",
  offerOff: "Desligadas aqui",
  offerLater: "Agora não",
};
export const pwaText = (lang: string, key: keyof typeof en) =>
  lang.startsWith("en") ? en[key] : pt[key];
export const pwaLogoutWarning = (lang: string) =>
  lang.startsWith("en")
    ? "Notification cleanup on this device was not confirmed. Signing out will continue. Check this site's notification permission in browser settings if needed."
    : "A limpeza das notificações neste aparelho não foi confirmada. Você continuará saindo. Se precisar, confira a permissão de notificações deste site nas configurações do navegador.";
export const pwaLogoutFailure = (lang: string) =>
  lang.startsWith("en")
    ? "Sign-out was not confirmed. The app will reload to check your session before updating notification settings."
    : "A saída não foi confirmada. O app vai recarregar para conferir sua sessão antes de atualizar as configurações de notificações.";
