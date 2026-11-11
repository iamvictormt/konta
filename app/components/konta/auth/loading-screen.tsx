import Image from "next/image";

export function LoadingScreen() {
  return <main className="auth-screen"><div className="auth-card auth-loading"><div className="brand-logo-frame auth-logo-frame"><Image src="/images/konta-logo.svg" alt="Kontá" width={1152} height={512} sizes="260px" loading="eager" /></div><strong>A preparar os dados da loja…</strong><span>O armazenamento local está a ser aberto.</span></div></main>;
}
