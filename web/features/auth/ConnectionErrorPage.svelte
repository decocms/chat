<script lang="ts">
  import type { AuthPageMetadata } from "../../../shared/authPage";
  import AuthFrame from "./AuthFrame.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  let {
    lang,
    failure,
    href,
  }: {
    lang: "en" | "pt";
    failure: NonNullable<AuthPageMetadata["connectionFailure"]>;
    href: string;
  } = $props();
  const copy = {
    en: {
      title: "Could not sign in to the connection",
      failed:
        "Sign-in could not be completed. Return to deco.chat and try again from Apps.",
      forbidden: "You must be a member of this room to use its connections.",
      missing: "This connection is unavailable or has been removed.",
      rate: "Too many attempts. Wait a minute before trying again.",
      "signed-out":
        "Your deco.chat session has ended. Return to deco.chat and sign in before trying again from Apps.",
      back: "Back to deco.chat",
    },
    pt: {
      title: "Não deu pra entrar na conexão",
      failed:
        "Não foi possível concluir o login. Volte ao deco.chat e tente novamente pela aba Apps.",
      forbidden: "Você precisa estar nesta sala para usar as conexões dela.",
      missing: "Esta conexão não está disponível ou foi removida.",
      rate: "Muitas tentativas. Espere um minuto antes de tentar novamente.",
      "signed-out":
        "Sua sessão do deco.chat terminou. Volte ao deco.chat e entre antes de tentar novamente pela aba Apps.",
      back: "Voltar ao deco.chat",
    },
  } as const;
  const room = $derived(
    new URL(href).pathname.match(
      /^\/api\/books\/([a-z0-9]{6,40})\/connections\//,
    )?.[1],
  );
  const back = $derived(room ? `/b/${room}` : "/");
</script>

<AuthFrame title={copy[lang].title}>
  <p role="alert" class="m-0 text-muted-foreground">
    {copy[lang][failure]}
  </p>
  <a class={buttonVariants()} href={back}>{copy[lang].back}</a>
</AuthFrame>
