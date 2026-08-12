import { redirect } from "next/navigation";

// F0: raiz aponta para a amostra visual. Na F1 passa a redirecionar por role.
export default function Home() {
  redirect("/design");
}
