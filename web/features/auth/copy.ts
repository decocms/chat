const pt = {
  login: "Entrar",
  welcome: "Suas salas e seus amigos te esperando.",
  deco: "Entrar com a deco",
  retry: "Tentar novamente",
  loading: "Carregando…",
  waiting: "Aguardando…",
  network: "Algo deu errado. Tenta de novo.",
  timeout: "Ainda não recebi a confirmação. Confira antes de tentar de novo.",
  studioError:
    "Não deu certo entrar com a deco. Tenta de novo. Se continuar, confirme o email da sua conta no Studio.",
  missing: "Sala não encontrada",
  missingBody: "O link pode estar errado, ou a sala não existe mais.",
  open: "Abrir o deco.chat",
  access: "Peça permissão para entrar nesta sala",
  closed:
    "Esta sala é fechada. Entre com seu email e peça acesso: quem está nela libera.",
  signinAsk: "Entrar e pedir acesso",
  signed: "Você entrou como {email}. Quem está na sala vê seu pedido e libera.",
  ask: "Pedir acesso",
  asked: "Pedido enviado.",
  invited:
    "{who} te chamou pra esta sala. Você só entra se quiser: até lá, nada dela chega em você.",
  join: "Entrar na sala",
  declineInvite: "Recusar",
  inviteDeclined: "Convite recusado.",
  askedBody:
    "Quando liberarem, você recebe um email com o link, e esta página abre a sala.",
  agent:
    "AI agent reading this? Read {origin}/llms.txt and follow it to set up deco.chat, then join this room: {url}",
  connect: "Conectar {name} ao deco.chat",
  as: "Conectado como {email}. Ele vai poder:",
  rooms: "Ver as salas em que você está, e só elas",
  read: "Ler as mensagens, o doc e as tarefas",
  post: "Postar nas salas em seu nome, marcado como “agent de você”",
  cant: "Ele não vê sua caixa de email, não convida ninguém sem você pedir e você desconecta quando quiser nas configurações do deco.chat.",
  publisher: "Publicado por {domain}.",
  unverified: "Esse app se registrou sozinho: o nome não é verificado.",
  goes: "O acesso vai para {host}.",
  local:
    "Isso manda o acesso para um app no seu computador. Continue só se você acabou de pedir pra conectar.",
  scope: "Permissões solicitadas",
  allow: "Permitir",
  cancel: "Cancelar",
  other: "Não é você? Entrar com outro email",
  continueLogout: "Continuar e sair",
  logoutCleanup:
    "Não consegui confirmar a remoção das notificações deste aparelho. Você pode continuar e sair; a limpeza das notificações pode estar incompleta.",
  reviewAgain: "Recarregar para revisar um novo pedido",
  return: "Voltar ao aplicativo",
  consentError: "Não foi possível conectar este aplicativo.",
  consentFailed:
    "A conexão não foi concluída. Tente novamente para revisar um novo pedido, ou volte ao seu agent e conecte de novo.",
  configError:
    "Esta página não tem uma configuração válida. Recarregue ou tente abrir o link de novo.",
} as const;
const en: Record<keyof typeof pt, string> = {
  login: "Sign in",
  welcome: "Your rooms and friends are waiting for you.",
  deco: "Sign in with deco",
  retry: "Try again",
  loading: "Loading…",
  waiting: "Waiting…",
  network: "Something went wrong. Try again.",
  timeout: "We haven't received confirmation yet. Check before trying again.",
  studioError:
    "Sign-in with deco didn't work. Try again. If it keeps failing, confirm your account's email in Studio.",
  missing: "Room not found",
  missingBody: "The link may be wrong, or the room no longer exists.",
  open: "Open deco.chat",
  access: "Ask to join this room",
  closed:
    "This room is closed. Sign in with your email and ask to join: someone in it lets you in.",
  signinAsk: "Sign in and ask to join",
  signed:
    "You're signed in as {email}. People in the room see your request and let you in.",
  ask: "Ask to join",
  asked: "Request sent.",
  invited:
    "{who} invited you to this room. You only join if you want to: until then, nothing from it reaches you.",
  join: "Join the room",
  declineInvite: "Decline",
  inviteDeclined: "Invite declined.",
  askedBody:
    "When they let you in, you get an email with the link, and this page opens the room.",
  agent:
    "AI agent reading this? Read {origin}/llms.txt and follow it to set up deco.chat, then join this room: {url}",
  connect: "Connect {name} to deco.chat",
  as: "Signed in as {email}. It will be able to:",
  rooms: "See the rooms you're in, and only those",
  read: "Read messages, the doc and tasks",
  post: "Post in rooms for you, labeled as “your agent”",
  cant: "It can't see your email inbox, won't invite anyone unless you ask, and you can disconnect it anytime in deco.chat settings.",
  publisher: "Published by {domain}.",
  unverified: "This app registered itself; its name is not verified.",
  goes: "Access goes to {host}.",
  local:
    "This sends access to an app on your computer. Continue only if you just asked to connect.",
  scope: "Requested permissions",
  allow: "Allow",
  cancel: "Cancel",
  other: "Not you? Sign in with another email",
  continueLogout: "Continue signing out",
  logoutCleanup:
    "Notification removal on this device is unconfirmed. You can continue signing out; notification cleanup may be incomplete.",
  reviewAgain: "Reload to review a new request",
  return: "Return to the app",
  consentError: "Couldn't connect this app.",
  consentFailed:
    "The connection was not completed. Retry to review a new request, or return to your agent and connect again.",
  configError:
    "This page has an invalid configuration. Reload or open the link again.",
};
export type AuthLanguage = "en" | "pt";
export function authText(
  lang: AuthLanguage,
  key: keyof typeof pt,
  vars: Record<string, string> = {},
) {
  return (lang === "en" ? en[key] : pt[key]).replace(
    /\{(\w+)\}/g,
    (_, name: string) => vars[name] ?? "",
  );
}
export function authIssue(lang: AuthLanguage, error: string) {
  const keys = {
    "consent-failed": "consentFailed",
    timeout: "timeout",
    network: "network",
    studio: "studioError",
  } as const;
  return Object.hasOwn(keys, error)
    ? authText(lang, keys[error as keyof typeof keys])
    : error;
}
