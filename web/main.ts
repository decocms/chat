import "./styles";

if (document.querySelector('meta[name="vb-page"]')) {
  const target = document.getElementById("app");
  if (!target) throw new Error("Missing page root");
  const { mountAuthPage } = await import("./features/auth/mount");
  mountAuthPage(target, document);
} else {
  const target = document.getElementById("app");
  if (!target) throw new Error("Missing application root");
  const { mountApplication } = await import("./features/application/mount");
  mountApplication(target, document);
}
