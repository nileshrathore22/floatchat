"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import { 
  Github, 
  Mail, 
  Lock, 
  Loader2, 
  ChevronRight,
  Sparkles,
  Phone,
  KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "phone">("login");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/");
      }
    });
    return () => unsub();
  }, [router]);

  const syncUser = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user found");
    const token = await user.getIdToken();

    const res = await fetch("/api/user/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Sync failed");
  };

  const onEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      await syncUser();
      router.push("/");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onSocialLogin = async (providerName: "google" | "github" | "linkedin") => {
    setErr(null);
    setLoading(true);
    try {
      let provider;
      if (providerName === "google") {
        provider = new GoogleAuthProvider();
      } else if (providerName === "github") {
        provider = new GithubAuthProvider();
      } else if (providerName === "linkedin") {
        provider = new OAuthProvider("linkedin.com");
      } else {
        throw new Error("Unknown authentication provider requested.");
      }

      await signInWithPopup(auth, provider);
      await syncUser();
      router.push("/");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
  };

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const cleanNumber = phoneNumber.replace(/\D/g, "");
      const fullPhone = `${countryCode}${cleanNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (e: any) {
      console.error(e);
      setErr("Failed to send SMS. Ensure your Firebase project supports phone auth, and you included the country code (e.g. +1 555-555-5555).");
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (!confirmationResult) throw new Error("No confirmation result found");
      await confirmationResult.confirm(otp);
      await syncUser();
      router.push("/");
    } catch (e: any) {
      setErr("Invalid confirmation code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 transition-transform hover:scale-110 duration-300">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">FloatChat</h1>
          <p className="text-slate-400 mt-2 text-center text-sm">
            Experience the next generation of AI-powered conversations.
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex p-1 bg-slate-950 rounded-xl mb-8">
            <button
              onClick={() => { setMode("login"); setErr(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "login" || mode === "phone" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setMode("signup"); setErr(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "signup" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign up
            </button>
          </div>

          <div id="recaptcha-container"></div>

          {mode === "phone" ? (
            !otpSent ? (
               <form onSubmit={onSendOtp} className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative shrink-0 w-36">
                      <select 
                        value={countryCode} 
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full h-11 appearance-none bg-slate-950 border border-slate-800 rounded-xl text-white pl-3 text-sm focus:ring-blue-500/20 focus:outline-none"
                      >
                        <option value="+91">🇮🇳 +91 (IN)</option>
                        <option value="+1">🇺🇸 +1 (US)</option>
                        <option value="+44">🇬🇧 +44 (UK)</option>
                        <option value="+61">🇦🇺 +61 (AU)</option>
                        <option value="+81">🇯🇵 +81 (JP)</option>
                        <option value="+49">🇩🇪 +49 (DE)</option>
                        <option value="+33">🇫🇷 +33 (FR)</option>
                        <option value="+55">🇧🇷 +55 (BR)</option>
                        <option value="+971">🇦🇪 +971 (UAE)</option>
                      </select>
                      <div className="absolute right-2 top-3 pointer-events-none text-slate-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                    <div className="relative group flex-1">
                      <Phone className="absolute left-3 top-[14px] w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                      <Input
                        type="tel"
                        placeholder="Phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="pl-10 h-11 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                  </div>
                  {err && (
                    <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{err}</div>
                  )}
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white h-11 rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send SMS Code"}
                  </Button>
               </form>
            ) : (
               <form onSubmit={onVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative group">
                      <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                      <Input
                        type="text"
                        placeholder="6-digit confirmation code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:ring-blue-500/20 text-center tracking-widest text-lg font-bold"
                        required
                      />
                    </div>
                  </div>
                  {err && (
                    <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20">{err}</div>
                  )}
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white h-11 rounded-xl font-semibold shadow-lg shadow-green-600/20 transition-all active:scale-[0.98]">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                  </Button>
               </form>
            )
          ) : (
            <form onSubmit={onEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <div className="relative group">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              {err && (
                <div className="text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20 animate-in fade-in slide-in-from-top-1">
                  {err}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white h-11 rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === "signup" ? "Create Account" : "Sign In"}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          )}

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900/50 px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onSocialLogin("google")}
              disabled={loading}
              className="flex items-center justify-center p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors group disabled:opacity-50"
              title="Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  className="text-[#4285F4]"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  className="text-[#34A853]"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                  className="text-[#FBBC05]"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  className="text-[#EA4335]"
                />
              </svg>
            </button>
            <button
              onClick={() => onSocialLogin("github")}
              disabled={loading}
              className="flex items-center justify-center p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors group text-white disabled:opacity-50"
              title="GitHub"
            >
              <Github className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setMode("phone"); setOtpSent(false); setErr(null); }}
              disabled={loading}
              className="flex items-center justify-center p-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors group text-white disabled:opacity-50"
              title="Phone Authentication"
            >
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
