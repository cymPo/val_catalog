import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolved = (await searchParams) ?? {};
  const nextParam = resolved.next;
  const nextPath = typeof nextParam === "string" && nextParam.length > 0 ? nextParam : "/dashboard";

  return <LoginForm nextPath={nextPath} />;
}

