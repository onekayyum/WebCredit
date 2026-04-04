import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useI18n } from "../i18n";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function LoginScreen() {
  const { t } = useI18n();
  const { login, signup, isLoggingIn, loginError } = useInternetIdentity();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      toast.error("Username and password are required");
      return;
    }

    const ok =
      mode === "login"
        ? await login(username.trim(), password)
        : await signup(username.trim(), password);

    if (ok) {
      toast.success(mode === "login" ? "Logged in" : "Account created");
    } else if (loginError) {
      toast.error(loginError.message);
    } else {
      toast.error("Authentication failed");
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-4">
        <h1 className="text-xl font-semibold">{t("app_name")}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? `${t("login")} to continue` : "Create your account"}
        </p>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
        />
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleSubmit();
            }
          }}
        />
        <Button className="w-full" onClick={() => void handleSubmit()} disabled={isLoggingIn}>
          {isLoggingIn ? "Please wait..." : mode === "login" ? t("login") : t("signup")}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
        >
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Login"}
        </Button>
      </div>
    </div>
  );
}
