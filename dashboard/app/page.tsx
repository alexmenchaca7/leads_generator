import { redirect } from "next/navigation";

// La raíz solo redirige; el middleware decide login vs dashboard según la sesión.
export default function Home() {
  redirect("/dashboard");
}
