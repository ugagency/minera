import { redirect } from "next/navigation";

// O middleware já redireciona "/" por auth+role (login ou home do papel).
// Este fallback só é alcançado se o matcher do middleware não pegar a rota.
export default function Home() {
  redirect("/login");
}
