// File: src/app/auth/login/page.tsx
// Updated to avoid `any` in catch blocks (use `unknown` + narrowing).

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next") ?? "/dashboard";

    const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const supabase = createClient();

        try {
            if (mode === "sign_up") {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;

                setMessage("Account created. You can now sign in.");
                setMode("sign_in");
                return;
            }

            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            router.push(next);
            router.refresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Something went wrong.";
            setMessage(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{mode === "sign_in" ? "Sign in" : "Create account"}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {message && <p className="text-sm text-muted-foreground">{message}</p>}

                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? "Loading..." : mode === "sign_in" ? "Sign in" : "Create account"}
                        </Button>
                    </form>

                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
                    >
                        {mode === "sign_in" ? "No account? Create one" : "Already have an account? Sign in"}
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
