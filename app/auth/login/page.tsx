"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Mail,
  Lock,
  User,
  Fingerprint,
  Building2,
  Smartphone,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Check,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Globe,
} from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Simulated flows
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [activeFlow, setActiveFlow] = useState<
    "credentials" | "sso" | "passkey" | "device-auth"
  >("credentials")

  // Inputs
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [ssoDomain, setSsoDomain] = useState("")
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""])

  // Passkey simulated message
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null)

  // Better-Auth Event Handlers
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignUp) {
      if (password !== confirmPassword) {
        alert("Passwords do not match!")
        return
      }
      await authClient.signUp.email(
        {
          email,
          password,
          name,
        },
        {
          onRequest: () => setLoadingProvider("email"),
          onSuccess: () => {
            setLoadingProvider(null)
            alert("Account created successfully! You can now log in.")
            setIsSignUp(false)
            setPassword("")
            setConfirmPassword("")
          },
          onError: (ctx) => {
            setLoadingProvider(null)
            alert(ctx.error.message || "Failed to create account")
          },
        }
      )
    } else {
      await authClient.signIn.email(
        {
          email,
          password,
        },
        {
          onRequest: () => setLoadingProvider("email"),
          onSuccess: (ctx) => {
            setLoadingProvider(null)
            router.push("/admin")
          },
          onError: (ctx) => {
            setLoadingProvider(null)
            toast.error(ctx.error.message || "Invalid credentials")
          },
        }
      )
    }
  }

  const handleSocialLogin = async (provider: string) => {
    await authClient.signIn.social(
      {
        provider: provider as "google" | "github",
        callbackURL: "/admin",
      },
      {
        onRequest: () => setLoadingProvider(provider),
        onError: (ctx) => {
          setLoadingProvider(null)
          toast.error(ctx.error.message || `Failed to sign in with ${provider}`)
        },
      }
    )
  }

  const handlePasskeyTrigger = async () => {
    setPasskeyMessage("Waiting for security key or biometric scan...")
    setLoadingProvider("passkey")
    await authClient.signIn.passkey(
      {},
      {
        onSuccess: () => {
          setLoadingProvider(null)
          setPasskeyMessage("Passkey verified successfully!")
          setTimeout(() => {
            setPasskeyMessage(null)
            router.push("/admin")
          }, 800)
        },
        onError: (ctx) => {
          setLoadingProvider(null)
          setPasskeyMessage(null)
          toast.error(
            ctx.error.message ||
              "Passkey authentication failed. Verify that your device supports passkeys and you have registered one."
          )
        },
      }
    )
  }

  const handleSsoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ssoDomain) return
    setLoadingProvider("sso")
    setTimeout(() => {
      setLoadingProvider(null)
      alert(`Simulated Enterprise SSO redirect for domain: ${ssoDomain}`)
    }, 1500)
  }

  const handleTotpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = totpCode.join("")
    if (code.length !== 6) return
    setLoadingProvider("totp")
    setTimeout(() => {
      setLoadingProvider(null)
      alert(`Simulated Multi-Factor Authentication code verified! (${code})`)
      setTotpCode(["", "", "", "", "", ""])
      setActiveFlow("credentials")
    }, 1500)
  }

  const handleTotpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    const newCode = [...totpCode]
    newCode[index] = value
    setTotpCode(newCode)

    // Move to next input automatically
    if (value && index < 5) {
      const nextInput = document.getElementById(`totp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleTotpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !totpCode[index] && index > 0) {
      const prevInput = document.getElementById(`totp-${index - 1}`)
      prevInput?.focus()
    }
  }

  return (
    <div className="grid min-h-svh bg-background text-foreground transition-colors duration-300 lg:grid-cols-2">
      {/* Left Column: Visual/Marketing Panel (Hidden on mobile) */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-radial from-neutral-900 to-black p-12 text-white lg:flex dark:border-neutral-800">
        {/* Animated ambient blob */}
        <div className="pointer-events-none absolute top-[-20%] left-[-20%] h-[80%] w-[80%] animate-pulse rounded-full bg-primary/10 blur-[120px] duration-10000" />
        <div className="pointer-events-none absolute right-[-20%] bottom-[-25%] h-[70%] w-[70%] rounded-full bg-neutral-800/20 blur-[100px]" />

        {/* Branding header */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white font-extrabold text-black shadow-md">
            B
          </div>
          <span className="text-xl font-semibold tracking-tight">
            BIWD Secure
          </span>
        </div>

        {/* Dynamic value prop / Carousel of features */}
        <div className="relative z-10 my-auto max-w-lg">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
            <Sparkles className="size-3.5 text-primary" /> Powered by
            Better-Auth
          </div>
          <h1 className="mb-6 text-4xl leading-[1.15] font-bold tracking-tight md:text-5xl">
            Secure, passwordless and seamless authentication.
          </h1>
          <p className="mb-8 text-base leading-relaxed font-light text-neutral-400">
            Experience advanced security layers, biometric sign-ins, and
            standard OAuth integrations designed to safeguard enterprise
            identity.
          </p>

          {/* Features check grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              {
                title: "WebAuthn Passkeys",
                desc: "Biometric fingerprint & FaceID",
              },
              { title: "Enterprise SSO", desc: "SAML 2.0 & OIDC support" },
              { title: "Social Logins", desc: "Google, GitHub, and Apple" },
              { title: "Device MFA", desc: "Multi-Factor verification" },
            ].map((feat, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/5 p-3.5 backdrop-blur-sm transition-all duration-300 hover:border-white/10"
              >
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <div>
                  <h4 className="font-medium text-white/90">{feat.title}</h4>
                  <p className="mt-0.5 text-xs text-neutral-400">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer meta info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-neutral-500">
          <span suppressHydrationWarning>
            &copy; {new Date().getFullYear()} BIWD Corp.
          </span>
          <div className="flex gap-4">
            <a href="#" className="transition-colors hover:text-neutral-300">
              Privacy Policy
            </a>
            <a href="#" className="transition-colors hover:text-neutral-300">
              Terms of Service
            </a>
          </div>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="flex flex-col justify-center px-6 py-12 md:px-12 lg:px-16 xl:px-24">
        {/* Top bar for theme note / layout helper */}
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
            Press <kbd className="font-mono text-[10px] font-bold">d</kbd> to
            toggle Dark Mode
          </span>
        </div>

        <div className="mx-auto w-full max-w-md">
          {/* Logo on Mobile */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-foreground font-extrabold text-background shadow-sm">
              B
            </div>
            <span className="text-xl font-bold tracking-tight">
              BIWD Secure
            </span>
          </div>

          {/* Title state */}
          <div className="mb-8 space-y-2">
            {activeFlow === "credentials" && (
              <>
                <h2 className="text-3xl font-bold tracking-tight">
                  {isSignUp ? "Create your account" : "Sign in to account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isSignUp
                    ? "Get started with your security credentials today."
                    : "Enter your email below to log into your secure dashboard."}
                </p>
              </>
            )}
            {activeFlow === "sso" && (
              <>
                <button
                  onClick={() => setActiveFlow("credentials")}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3" /> Back to default login
                </button>
                <h2 className="text-3xl font-bold tracking-tight">
                  Single Sign-On (SSO)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter your enterprise domain to authenticate through your
                  Identity Provider.
                </p>
              </>
            )}
            {activeFlow === "passkey" && (
              <>
                <button
                  onClick={() => setActiveFlow("credentials")}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3" /> Back to default login
                </button>
                <h2 className="text-3xl font-bold tracking-tight">
                  Biometric Passkey
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign in instantly using Touch ID, Face ID, Windows Hello, or a
                  hardware security key.
                </p>
              </>
            )}
            {activeFlow === "device-auth" && (
              <>
                <button
                  onClick={() => setActiveFlow("credentials")}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3" /> Back to default login
                </button>
                <h2 className="text-3xl font-bold tracking-tight">
                  Device Authenticator
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit TOTP code from your mobile authenticator app
                  (e.g. Google Authenticator).
                </p>
              </>
            )}
          </div>

          {/* Render Flow forms */}
          {activeFlow === "credentials" && (
            <div className="space-y-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative" suppressHydrationWarning>
                      <User className="absolute top-2.5 left-3 h-4.5 w-4.5 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="John Doe"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-10 border-border pl-9"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute top-2.5 left-3 h-4.5 w-4.5 text-muted-foreground" />
                    <Input
                      id="email"
                      placeholder="name@example.com"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 border-border pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <a
                        href="#"
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <div className="relative" suppressHydrationWarning>
                    <Lock className="absolute top-2.5 left-3 h-4.5 w-4.5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 border-border pr-10 pl-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative" suppressHydrationWarning>
                      <Lock className="absolute top-2.5 left-3 h-4.5 w-4.5 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-10 border-border pr-10 pl-9"
                      />
                    </div>
                  </div>
                )}

                {!isSignUp && (
                  <div className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      id="remember"
                      className="h-4 w-4 cursor-pointer rounded border-input text-primary accent-primary focus:ring-primary/20"
                    />
                    <label
                      htmlFor="remember"
                      className="cursor-pointer text-xs leading-none text-muted-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Remember this device for 30 days
                    </label>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loadingProvider === "email"}
                  className="mt-2 h-10 w-full cursor-pointer font-medium"
                >
                  {loadingProvider === "email" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating account..." : "Signing in..."}
                    </>
                  ) : isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In with Email"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social Login Row */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  disabled={loadingProvider !== null}
                  className="h-10 cursor-pointer border-border hover:bg-accent dark:hover:bg-neutral-800"
                >
                  {loadingProvider === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="mr-2 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  Google
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleSocialLogin("github")}
                  disabled={loadingProvider !== null}
                  className="h-10 cursor-pointer border-border hover:bg-accent dark:hover:bg-neutral-800"
                >
                  {loadingProvider === "github" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="mr-2 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                  )}
                  GitHub
                </Button>
              </div>

              {/* Advanced Auth Grid */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Enterprise & Advanced Security
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setActiveFlow("passkey")}
                    className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card p-3 text-center transition-all hover:bg-accent dark:hover:bg-neutral-800"
                  >
                    <Fingerprint className="size-5 text-primary transition-transform duration-200 group-hover:scale-110" />
                    <span className="text-xs font-medium">Passkey</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFlow("sso")}
                    className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card p-3 text-center transition-all hover:bg-accent dark:hover:bg-neutral-800"
                  >
                    <Building2 className="size-5 text-primary transition-transform duration-200 group-hover:scale-110" />
                    <span className="text-xs font-medium">SSO Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFlow("device-auth")}
                    className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card p-3 text-center transition-all hover:bg-accent dark:hover:bg-neutral-800"
                  >
                    <Smartphone className="size-5 text-primary transition-transform duration-200 group-hover:scale-110" />
                    <span className="text-xs font-medium">MFA App</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Render SSO Flow */}
          {activeFlow === "sso" && (
            <form onSubmit={handleSsoSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ssoDomain">
                  Enterprise Domain / Workspace URL
                </Label>
                <div className="relative" suppressHydrationWarning>
                  <Globe className="absolute top-2.5 left-3 h-4.5 w-4.5 text-muted-foreground" />
                  <Input
                    id="ssoDomain"
                    placeholder="company.com or workspace-id"
                    type="text"
                    required
                    value={ssoDomain}
                    onChange={(e) => setSsoDomain(e.target.value)}
                    className="h-10 border-border pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact your IT administrator if you do not know your
                  workspace ID.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loadingProvider === "sso"}
                className="h-10 w-full cursor-pointer font-medium"
              >
                {loadingProvider === "sso" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting to IdP...
                  </>
                ) : (
                  <>
                    Continue with SSO <ChevronRight className="ml-1 size-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Render Passkey Flow */}
          {activeFlow === "passkey" && (
            <div className="flex flex-col items-center space-y-5 py-6">
              <div className="flex size-16 animate-pulse items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <Fingerprint className="size-8 text-primary" />
              </div>

              {passkeyMessage ? (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {passkeyMessage}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Do not close this window
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Better-Auth supports WebAuthn Passkeys. Verify your hardware
                    key or device biometrics.
                  </p>
                </div>
              )}

              <Button
                type="button"
                onClick={handlePasskeyTrigger}
                disabled={loadingProvider === "passkey"}
                className="h-10 w-full cursor-pointer font-medium"
              >
                {loadingProvider === "passkey" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Waiting for credentials...
                  </>
                ) : (
                  "Scan Face / Fingerprint"
                )}
              </Button>
            </div>
          )}

          {/* Render Device Auth (MFA TOTP) Flow */}
          {activeFlow === "device-auth" && (
            <form
              onSubmit={handleTotpSubmit}
              className="flex flex-col items-center space-y-6"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="size-6 text-primary" />
              </div>

              {/* 6 Digit Block Inputs */}
              <div className="flex gap-2" suppressHydrationWarning>
                {totpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`totp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleTotpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleTotpKeyDown(idx, e)}
                    className="size-11 rounded-lg border border-input bg-background text-center text-lg font-bold transition-all outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 md:size-12"
                  />
                ))}
              </div>

              <p className="max-w-xs text-center text-xs text-muted-foreground">
                Open your authenticator app and enter the active 6-digit code
                for your BIWD account.
              </p>

              <Button
                type="submit"
                disabled={
                  loadingProvider === "totp" || totpCode.join("").length !== 6
                }
                className="h-10 w-full cursor-pointer font-medium"
              >
                {loadingProvider === "totp" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying code...
                  </>
                ) : (
                  "Verify Authenticator Code"
                )}
              </Button>
            </form>
          )}

          {/* Bottom Switcher: If Don't Have Account, Toggle Button */}
          {activeFlow === "credentials" && (
            <div className="mt-8 border-t border-border/80 pt-4 text-center">
              <p className="text-sm text-muted-foreground">
                {isSignUp
                  ? "Already have an account?"
                  : "Don't have an account yet?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setEmail("")
                  setPassword("")
                  setName("")
                  setConfirmPassword("")
                }}
                className="mt-2 cursor-pointer text-sm font-semibold text-primary underline-offset-4 hover:underline focus:outline-none"
              >
                {isSignUp
                  ? "Sign in to existing account"
                  : "Create a new account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
