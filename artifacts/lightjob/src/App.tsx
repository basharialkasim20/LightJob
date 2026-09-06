import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router, Switch, useLocation, useParams } from 'wouter';
import { ClerkProvider, getToken, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  Filter,
  Gift,
  HandCoins,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  getGetAdminOverviewQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetMeQueryKey,
  getGetTaskQueryKey,
  getGetWalletSummaryQueryKey,
  getListAdminDepositsQueryKey,
  getListAdminUsersQueryKey,
  getListAdminWithdrawalsQueryKey,
  getListDepositsQueryKey,
  getListSubmissionsQueryKey,
  getListTasksQueryKey,
  getListTransactionsQueryKey,
  getListWithdrawalsQueryKey,
  getGetReferralSummaryQueryKey,
  setAuthTokenGetter,
  useCreateTask,
  useCreateDeposit,
  useCreateWithdrawal,
  useGetAdminOverview,
  useGetDashboardSummary,
  useGetMe,
  useGetReferralSummary,
  useGetTask,
  useGetWalletSummary,
  useListAdminUsers,
  useListAdminDeposits,
  useListAdminWithdrawals,
  useListDeposits,
  useListSubmissions,
  useListTasks,
  useListTransactions,
  useListWithdrawals,
  useReviewSubmission,
  useReviewDeposit,
  useReviewWithdrawal,
  useSubmitTask,
  useUpdateUserRole,
  type Activity,
  type AdminDeposit,
  type AdminUser,
  type DashboardSummary,
  type Deposit,
  type Referral,
  type Submission,
  type Task,
  type Transaction,
  type UserProfile,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(165 45% 30%)',
    colorForeground: 'hsl(210 30% 17%)',
    colorMutedForeground: 'hsl(210 13% 44%)',
    colorDanger: 'hsl(3 61% 49%)',
    colorBackground: 'hsl(44 42% 98%)',
    colorInput: 'hsl(42 32% 94%)',
    colorInputForeground: 'hsl(210 30% 17%)',
    colorNeutral: 'hsl(39 24% 83%)',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8ed] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#27313a] font-extrabold',
    headerSubtitle: 'text-[#5f6a70]',
    socialButtonsBlockButtonText: 'text-[#27313a] font-semibold',
    formFieldLabel: 'text-[#27313a] font-semibold',
    footerActionLink: 'text-[#1d6654] font-bold',
    footerActionText: 'text-[#5f6a70]',
    dividerText: 'text-[#5f6a70]',
    identityPreviewEditButton: 'text-[#1d6654]',
    formFieldSuccessText: 'text-[#1d6654]',
    alertText: 'text-[#a33e35]',
    logoBox: 'mb-4',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#ded6bc] bg-[#f5f0df] hover:bg-[#e7dfc6]',
    formButtonPrimary: 'bg-[#1d6654] hover:bg-[#155443] text-[#fbf8ed] font-bold',
    formFieldInput: 'border-[#ded6bc] bg-[#f5f0df] text-[#27313a]',
    footerAction: 'border-t border-[#ded6bc]',
    dividerLine: 'bg-[#ded6bc]',
    alert: 'border-[#e3b0aa] bg-[#f8deda]',
    otpCodeFieldInput: 'border-[#ded6bc] bg-[#f5f0df] text-[#27313a]',
  },
};

const money = (value?: number | null) =>
  `₦${new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' }).format(new Date(value)) : '—';
const fullDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const initials = (name = 'LightJob') =>
  name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-brand">
      <span className={`grid size-9 place-items-center rounded-xl ${light ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'}`}>
        <span className="size-2.5 rounded-full bg-current shadow-[7px_-4px_0_currentColor,-7px_4px_0_currentColor]" />
      </span>
      <span className={`font-extrabold tracking-[-.04em] text-lg ${light ? 'text-sidebar-foreground' : 'text-foreground'}`}>LightJob</span>
    </Link>
  );
}

function Avatar({ profile, small = false }: { profile?: Partial<UserProfile> | null; small?: boolean }) {
  return profile?.avatarUrl ? (
    <img src={profile.avatarUrl} alt={profile.name || 'Account avatar'} className={`${small ? 'size-8' : 'size-10'} rounded-full object-cover`} data-testid="img-avatar" />
  ) : (
    <span className={`grid ${small ? 'size-8 text-[10px]' : 'size-10 text-xs'} shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-foreground`} data-testid="avatar-fallback">
      {initials(profile?.name)}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-[#dcefe9] text-[#1d6654]',
    pending: 'bg-[#fff0bf] text-[#856414]',
    approved: 'bg-[#dcefe9] text-[#1d6654]',
    paid: 'bg-[#dcefe9] text-[#1d6654]',
    rejected: 'bg-[#f8deda] text-[#a33e35]',
    paused: 'bg-muted text-muted-foreground',
    completed: 'bg-muted text-muted-foreground',
    worker: 'bg-secondary text-primary',
    advertiser: 'bg-secondary text-primary',
    admin: 'bg-secondary text-primary',
    super_admin: 'bg-secondary text-primary',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${styles[status] || styles.pending}`} data-testid={`status-${status}`}>{status.replace('_', ' ')}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-label="Loading" data-testid="loading-skeleton" />;
}

function QueryState({ loading, error, children, retry }: { loading?: boolean; error?: unknown; children: ReactNode; retry?: () => void }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center" data-testid="state-error">
        <XCircle className="mx-auto mb-3 size-8 text-destructive" />
        <h3 className="font-bold">We couldn&apos;t load this just now</h3>
        <p className="mt-1 text-sm text-muted-foreground">Please try again. Your account and balances are safe.</p>
        {retry && <Button onClick={retry} className="mt-4" data-testid="button-retry">Try again</Button>}
      </div>
    );
  }
  return <>{children}</>;
}

function EmptyState({ icon: Icon = ClipboardList, title, body, action }: { icon?: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-14 text-center" data-testid="state-empty">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Icon className="size-5" /></span>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function SectionHeading({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[.18em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-[-.04em] sm:text-[30px]">{title}</h1>
        {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

function PublicHome() {
  const { isLoaded, isSignedIn } = useAuth();
  const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  if (!isLoaded || (isSignedIn && me.isLoading)) return <div className="min-h-[100dvh] bg-background p-6"><Skeleton className="h-10 w-32" /><Skeleton className="mx-auto mt-32 h-40 max-w-3xl" /></div>;
  if (me.data) return <Redirect to="/dashboard" />;
  return (
    <div className="noise min-h-[100dvh] overflow-hidden bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex">
          <a href="#how-it-works" data-testid="link-how-it-works">How it works</a>
          <a href="#policy" data-testid="link-policy">Payout policy</a>
          <a href="#trust" data-testid="link-trust">Trust &amp; safety</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground" data-testid="link-sign-in">Sign in</Link>
          <Link href="/sign-up" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:-translate-y-0.5" data-testid="link-sign-up">Get started</Link>
        </div>
      </header>
      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 sm:px-8 sm:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:pb-32">
          <div className="relative z-10 animate-rise-in">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"><span className="size-1.5 rounded-full bg-primary" />The earning workspace with receipts</div>
            <h1 className="max-w-3xl text-[clamp(3.35rem,8vw,7rem)] font-extrabold leading-[.92] tracking-[-.08em]">Work that <span className="text-primary">adds up.</span></h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">LightJob brings verified tasks, clear payouts, and word-of-mouth earnings into one calm place. Make progress you can see.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-bold text-primary-foreground shadow-lg shadow-primary/15" data-testid="link-hero-start">Start earning <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 font-bold hover:bg-secondary" data-testid="link-hero-learn">See how it works</a>
            </div>
            <div className="mt-12 flex items-center gap-5 text-xs text-muted-foreground"><div className="flex -space-x-2"><span className="grid size-8 place-items-center rounded-full border-2 border-background bg-[#d2b9a7] text-[10px] font-bold text-foreground">AM</span><span className="grid size-8 place-items-center rounded-full border-2 border-background bg-[#c2d5bc] text-[10px] font-bold text-foreground">KO</span><span className="grid size-8 place-items-center rounded-full border-2 border-background bg-[#ead18c] text-[10px] font-bold text-foreground">RA</span></div><span><strong className="text-foreground">12,480+</strong> people earning with clarity</span></div>
          </div>
          <div className="relative animate-rise-in delay-2">
            <div className="soft-grid absolute -inset-10 -z-10 rounded-[3rem] opacity-70" />
            <div className="relative overflow-hidden rounded-[2rem] border border-[#d5cbae] bg-[#e7dfc6] p-3 shadow-2xl shadow-[#67705c]/15">
              <div className="rounded-[1.5rem] bg-[#f5f0df] p-5 sm:p-7">
                <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Your workspace</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.05em]">Good morning, Amina</h2></div><span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><TrendingUp className="size-4" /></span></div>
                <div className="mt-7 rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-xs opacity-70">Your live balance appears here</p><p className="mt-1 text-2xl font-extrabold tracking-[-.05em]">See what adds up</p><div className="mt-5 border-t border-primary-foreground/20 pt-4 text-xs">Verified tasks. Traceable payouts.</div></div>
                <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-[#ded6bc] bg-[#fbf8ed] p-4"><p className="text-xs text-muted-foreground">Tasks done</p><strong className="mt-2 block text-xl">In view</strong><span className="text-[11px] text-primary">One clear workspace</span></div><div className="rounded-2xl border border-[#ded6bc] bg-[#fbf8ed] p-4"><p className="text-xs text-muted-foreground">Referrals</p><strong className="mt-2 block text-xl">Tracked</strong><span className="text-[11px] text-primary">No hidden steps</span></div></div>
                <div className="mt-5 flex items-center justify-between text-xs"><span className="font-bold">Recent activity</span><span className="text-muted-foreground">Receipts as work moves</span></div>
                <div className="mt-3 space-y-2"><div className="flex items-center gap-3 rounded-xl bg-[#fbf8ed] p-3"><span className="grid size-8 place-items-center rounded-lg bg-[#dcefe9] text-primary"><Check className="size-4" /></span><div className="flex-1"><p className="text-xs font-bold">Approval recorded</p><p className="text-[10px] text-muted-foreground">Your ledger keeps the receipt</p></div></div><div className="flex items-center gap-3 rounded-xl bg-[#fbf8ed] p-3"><span className="grid size-8 place-items-center rounded-lg bg-[#fff0bf] text-[#856414]"><Clock3 className="size-4" /></span><div className="flex-1"><p className="text-xs font-bold">Proof under review</p><p className="text-[10px] text-muted-foreground">Status stays visible</p></div></div></div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-8 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:block"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground"><ShieldCheck className="size-4" /></span><div><p className="text-[11px] font-bold">Every payout is traceable</p><p className="text-[10px] text-muted-foreground">Verified by LightJob</p></div></div></div>
          </div>
        </section>
        <section id="how-it-works" className="border-y border-border bg-card/45 px-5 py-20 sm:px-8"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="A shorter path to paid" title="No guessing. Just the next right task." body="LightJob keeps the important details in view, from the first click to the final payout." /><div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3"><div className="bg-background p-7"><span className="font-mono text-sm text-primary">01</span><ClipboardList className="mt-14 size-6 text-primary" /><h3 className="mt-5 text-lg font-bold">Pick work that fits</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Browse tasks with the reward, proof required, time, and remaining budget clearly shown.</p></div><div className="bg-background p-7"><span className="font-mono text-sm text-primary">02</span><BadgeCheck className="mt-14 size-6 text-primary" /><h3 className="mt-5 text-lg font-bold">Submit with confidence</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Follow straightforward instructions and upload one clean piece of proof. No black boxes.</p></div><div className="bg-background p-7"><span className="font-mono text-sm text-primary">03</span><CircleDollarSign className="mt-14 size-6 text-primary" /><h3 className="mt-5 text-lg font-bold">See money move</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Approved work lands in your wallet. The ledger shows what happened and when.</p></div></div></div></section>
        <section id="policy" className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">The policy in plain sight</p><h2 className="mt-3 max-w-md text-4xl font-extrabold leading-[.95] tracking-[-.06em]">A fair split is a feature, not fine print.</h2><p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">Every eligible task follows the same 40 / 40 / 20 payout policy. You should never need a spreadsheet to understand your share.</p></div><div className="rounded-3xl bg-sidebar p-7 text-sidebar-foreground sm:p-10"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="size-40 shrink-0 rounded-full" style={{ background: 'conic-gradient(hsl(44 89% 67%) 0 40%, hsl(165 44% 48%) 40% 80%, hsl(203 52% 53%) 80% 100%)' }}><div className="m-4 grid size-32 place-items-center rounded-full bg-sidebar"><span className="text-center font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/60">policy<br /><strong className="text-2xl text-sidebar-foreground">40·40·20</strong></span></div></div><div className="grid flex-1 gap-4 sm:grid-cols-3"><div><span className="mb-2 block size-2.5 rounded-full bg-accent" /><strong className="text-xl">40%</strong><p className="mt-1 text-xs text-sidebar-foreground/65">Worker reward</p></div><div><span className="mb-2 block size-2.5 rounded-full bg-primary" /><strong className="text-xl">40%</strong><p className="mt-1 text-xs text-sidebar-foreground/65">Platform operations</p></div><div><span className="mb-2 block size-2.5 rounded-full bg-[#65a8c8]" /><strong className="text-xl">20%</strong><p className="mt-1 text-xs text-sidebar-foreground/65">Referrer share</p></div></div></div></div></section>
        <section id="trust" className="bg-[#e1e9df] px-5 py-20 sm:px-8"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[.8fr_1.2fr]"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Built for steady progress</p><h2 className="mt-3 max-w-md text-4xl font-extrabold leading-[.95] tracking-[-.06em]">The details are the difference.</h2></div><div className="grid gap-8 sm:grid-cols-2"><div><LockKeyhole className="size-5 text-primary" /><h3 className="mt-3 font-bold">Verified work only</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Advertisers publish with clear requirements. Workers know what good looks like before they start.</p></div><div><BarChart3 className="size-5 text-primary" /><h3 className="mt-3 font-bold">Receipts at every step</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">A living activity feed and ledger make your progress legible, not mysterious.</p></div></div></div></section>
        <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand /><span>LightJob · Work that adds up.</span></footer>
      </main>
    </div>
  );
}

function SignInPage() {
  return <div className="noise grid min-h-[100dvh] place-items-center bg-background px-5 py-10"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="noise grid min-h-[100dvh] place-items-center bg-background px-5 py-10"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/marketplace', label: 'Marketplace', icon: BriefcaseBusiness },
  { href: '/submissions', label: 'Submissions', icon: ClipboardCheck },
  { href: '/wallet', label: 'Wallet', icon: WalletCards },
  { href: '/referrals', label: 'Referrals', icon: Gift },
];
const financeItems = [
  { href: '/deposit', label: 'Deposit', icon: HandCoins },
  { href: '/withdraw', label: 'Withdraw', icon: ArrowDownLeft },
];
const utilityItems = [
  { href: '/transactions', label: 'Transactions', icon: ListFilter },
  { href: '/notifications', label: 'Notifications', icon: ActivityIcon },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function AppFrame({ profile, children }: { profile?: UserProfile | null; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const admin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const close = () => setMobileOpen(false);
  return (
    <div className="min-h-[100dvh] bg-background pb-20 lg:pb-0">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2"><Brand light /><button className="rounded-lg p-2 hover:bg-sidebar-accent lg:hidden" onClick={close} data-testid="button-close-menu" aria-label="Close menu"><X className="size-4" /></button></div>
        <div className="mt-9 px-2"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Workspace</p><nav className="mt-3 space-y-1">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon className="size-[17px]" />{label}</Link>)}</nav></div>
        <div className="mt-8 px-2"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Receipts</p><nav className="mt-3 space-y-1">{utilityItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon className="size-[17px]" />{label}</Link>)}</nav></div>
        <div className="mt-6 px-2"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Wallet actions</p><nav className="mt-3 space-y-1">{financeItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon className="size-[17px]" />{label}</Link>)}</nav></div>
        {(profile?.role === 'advertiser' || admin) && <div className="mt-6 px-2"><Link href="/tasks/new" onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl border border-sidebar-border px-3 py-2.5 text-sm font-semibold ${location === '/tasks/new' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid="link-nav-create-task"><Plus className="size-[17px]" />Publish a task</Link></div>}
         {admin && <div className="mt-3 space-y-1 px-2"><Link href="/admin" onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === '/admin' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid="link-nav-admin"><Settings2 className="size-[17px]" />Admin overview</Link><Link href="/admin/deposits" onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === '/admin/deposits' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid="link-nav-admin-deposits"><HandCoins className="size-[17px]" />Deposit management</Link></div>}
         <div className="mt-3 px-2"><Link href="/logout" onClick={close} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-nav-logout"><LogOut className="size-[17px]" />Log out</Link></div>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground"><ShieldCheck className="size-4" /></span><div><p className="text-xs font-bold">Clear by design</p><p className="mt-0.5 text-[10px] text-sidebar-foreground/50">Every reward and receipt stays visible.</p></div></div></div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-sidebar/30 lg:hidden" onClick={close} aria-label="Close navigation" data-testid="button-overlay-close" />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[73px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3"><button className="rounded-xl border border-border bg-card p-2.5 lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu" aria-label="Open menu"><Menu className="size-4" /></button><p className="hidden text-sm font-semibold text-muted-foreground sm:block">{location === '/dashboard' ? 'Overview' : location.startsWith('/marketplace') ? 'Marketplace' : location.startsWith('/wallet') || location === '/withdraw' ? 'Wallet' : location.startsWith('/referrals') ? 'Referrals' : location.startsWith('/submissions') ? 'Submissions' : location.startsWith('/admin') ? 'Admin' : 'Workspace'}</p></div>
          <div className="flex items-center gap-4"><span className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" />All systems operational</span><button className="flex items-center gap-2 rounded-full hover:opacity-80" onClick={() => setLocation('/settings')} data-testid="button-profile"><Avatar profile={profile} small /><span className="hidden text-left md:block"><span className="block text-xs font-bold">{profile?.name || 'Your profile'}</span><span className="block text-[10px] capitalize text-muted-foreground">{profile?.role || 'member'}</span></span></button></div>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="Mobile navigation"><Link href="/dashboard" className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${location === '/dashboard' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="link-mobile-overview"><LayoutDashboard className="size-4" />Overview</Link><Link href="/marketplace" className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${location === '/marketplace' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="link-mobile-marketplace"><BriefcaseBusiness className="size-4" />Tasks</Link><Link href="/submissions" className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${location === '/submissions' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="link-mobile-submissions"><ClipboardCheck className="size-4" />Submissions</Link><Link href="/wallet" className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${location.startsWith('/wallet') || location === '/withdraw' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="link-mobile-wallet"><WalletCards className="size-4" />Wallet</Link></nav>
    </div>
  );
}

function Protected({ children }: { children: (profile: UserProfile) => ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  if (!isLoaded || (isSignedIn && me.isLoading)) return <div className="min-h-[100dvh] bg-background p-6"><Skeleton className="h-10 w-32" /><div className="mx-auto mt-20 max-w-5xl"><Skeleton className="h-28" /></div></div>;
  if (!me.data) return <Redirect to="/sign-in" />;
  return <AppFrame profile={me.data}>{children(me.data)}</AppFrame>;
}

function DashboardPage() {
  const summary = useGetDashboardSummary();
  const wallet = useGetWalletSummary();
  const referral = useGetReferralSummary();
  const data = summary.data as DashboardSummary | undefined;
  const stats: { label: string; value: string | number; note: string; Icon: LucideIcon; color: string }[] = [
    { label: 'Wallet balance', value: money(data?.profile.balance), note: 'Current account balance', Icon: WalletCards, color: 'text-primary' },
    { label: 'Available balance', value: money(wallet.data?.availableBalance), note: 'Ready to withdraw or use', Icon: CircleDollarSign, color: 'text-primary' },
    { label: 'Pending balance', value: money(wallet.data?.pendingBalance), note: 'Under review or reserved', Icon: Clock3, color: 'text-[#a46b28]' },
    { label: 'Total earnings', value: money(wallet.data?.totalEarned), note: 'Worker and referral rewards', Icon: TrendingUp, color: 'text-primary' },
    { label: 'Total withdrawn', value: money(wallet.data?.withdrawals), note: 'Withdrawal history', Icon: ArrowDownLeft, color: 'text-[#4c819d]' },
    { label: 'Completed tasks', value: data?.completedTasks || 0, note: `${data?.pendingReview || 0} pending review`, Icon: ClipboardCheck, color: 'text-[#4c819d]' },
    { label: 'Available tasks', value: data?.availableTasks || 0, note: 'Open marketplace tasks', Icon: BriefcaseBusiness, color: 'text-[#a46b28]' },
    { label: 'My tasks', value: data?.activeTasks || 0, note: 'Tasks in your workspace', Icon: ClipboardList, color: 'text-primary' },
    { label: 'Referral earnings', value: money(referral.data?.referralEarnings ?? data?.referralEarnings), note: `${referral.data?.directReferrals || 0} direct referrals`, Icon: Gift, color: 'text-primary' },
    { label: 'Referral count', value: referral.data?.directReferrals || 0, note: 'People in your circle', Icon: Users, color: 'text-[#4c819d]' },
  ];
  return <Protected>{(profile) => <QueryState loading={summary.isLoading || wallet.isLoading || referral.isLoading} error={summary.error || wallet.error || referral.error} retry={() => { void summary.refetch(); void wallet.refetch(); void referral.refetch(); }}><SectionHeading eyebrow="Your workspace" title={`Good morning${profile.name ? `, ${profile.name.split(' ')[0]}` : ''}.`} body="A clear view of what is moving, waiting, and ready." action={<Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-browse-tasks">Browse tasks <ArrowRight className="size-4" /></Link>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.map(({ label, value, note, Icon, color }, index) => <div key={label} className={`animate-rise-in delay-${(index % 4) + 1} rounded-2xl border border-border bg-card p-5 shadow-xs`} data-testid={`card-stat-${index}`}><div className="flex items-start justify-between"><p className="text-xs font-semibold text-muted-foreground">{label}</p><span className={`grid size-8 place-items-center rounded-xl bg-secondary ${color}`}><Icon className="size-4" /></span></div><p className="mt-4 text-2xl font-extrabold tracking-[-.05em]" data-testid={`text-stat-${index}`}>{String(value)}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}</div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Link href="/deposit" className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:border-primary/40" data-testid="link-dashboard-deposit"><HandCoins className="size-4 text-primary" />Deposit</Link><Link href="/withdraw" className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:border-primary/40" data-testid="link-dashboard-withdraw"><ArrowDownLeft className="size-4 text-primary" />Withdraw</Link><Link href="/transactions" className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:border-primary/40" data-testid="link-dashboard-transactions"><ListFilter className="size-4 text-primary" />Transactions</Link><Link href="/notifications" className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:border-primary/40" data-testid="link-dashboard-notifications"><ActivityIcon className="size-4 text-primary" />Notifications</Link><Link href="/settings" className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:border-primary/40" data-testid="link-dashboard-settings"><Settings2 className="size-4 text-primary" />Settings</Link></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]"><EarningsChart points={data?.earningsTrend || []} /><ActivityList activities={data?.recentActivity || []} /></div></QueryState>}</Protected>;
}

function EarningsChart({ points }: { points: { label: string; amount: number }[] }) {
  const safe = points.length ? points : [{ label: 'Mon', amount: 0 }, { label: 'Tue', amount: 0 }, { label: 'Wed', amount: 0 }, { label: 'Thu', amount: 0 }, { label: 'Fri', amount: 0 }, { label: 'Sat', amount: 0 }, { label: 'Sun', amount: 0 }];
  const max = Math.max(...safe.map((point) => point.amount), 1);
  return <div className="rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid="card-earnings-chart"><div className="flex items-start justify-between"><div><p className="text-sm font-bold">Earnings rhythm</p><p className="mt-1 text-xs text-muted-foreground">Your latest reporting periods</p></div><span className="rounded-lg bg-secondary px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">7D</span></div><div className="mt-8 flex h-44 items-end gap-2 sm:gap-4">{safe.map((point) => <div key={point.label} className="group flex h-full flex-1 flex-col justify-end gap-2" data-testid={`bar-earnings-${point.label}`}><div className="relative flex flex-1 items-end"><div className="w-full rounded-t-lg bg-primary/80 transition-all group-hover:bg-accent" style={{ height: `${Math.max((point.amount / max) * 100, 4)}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-sidebar px-1.5 py-1 font-mono text-[9px] text-sidebar-foreground group-hover:block">{money(point.amount)}</span></div></div><span className="text-center font-mono text-[9px] text-muted-foreground">{point.label}</span></div>)}</div></div>;
}

function ActivityList({ activities }: { activities: Activity[] }) {
  return <div className="rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid="card-activity"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">Recent activity</p><p className="mt-1 text-xs text-muted-foreground">Small steps, visible progress.</p></div><ActivityIcon className="size-4 text-primary" /></div>{activities.length ? <div className="mt-5 space-y-1">{activities.slice(0, 5).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl px-1 py-3" data-testid={`row-activity-${item.id}`}><span className="grid size-8 place-items-center rounded-xl bg-secondary text-primary"><ActivityIcon className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.title}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.description} · {date(item.timestamp)}</p></div>{item.amount != null && <span className={`font-mono text-xs font-medium ${item.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>{item.amount >= 0 ? '+' : ''}{money(item.amount)}</span>}</div>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground" data-testid="text-empty-activity">Your activity will appear here.</p>}</div>;
}

function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const params = useMemo(() => ({ search: search || undefined, category: category || undefined, status: 'open' as const, page: 1, limit: 20 }), [search, category]);
  const tasks = useListTasks(params);
  const items = tasks.data?.items || [];
  return <Protected>{() => <><SectionHeading eyebrow="Open opportunities" title="Find work that fits." body="Verified tasks with the details up front." action={<Link href="/tasks/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-secondary" data-testid="link-marketplace-publish"><Plus className="size-4" /> Publish a task</Link>} /><div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or category" className="h-11 border-0 bg-secondary pl-10 shadow-none" data-testid="input-task-search" /></div><div className="flex items-center gap-2"><Filter className="ml-2 size-4 text-muted-foreground" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none" data-testid="select-task-category"><option value="">All categories</option><option value="research">Research</option><option value="content">Content</option><option value="social">Social</option><option value="testing">Testing</option></select><button onClick={() => { setSearch(''); setCategory(''); }} className="rounded-lg p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="button-clear-filters" aria-label="Clear filters"><X className="size-4" /></button></div></div><QueryState loading={tasks.isLoading} error={tasks.error} retry={() => tasks.refetch()}>{items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <EmptyState icon={Search} title="No tasks match that search" body="Try a broader category or check back soon for fresh work." action={<Button onClick={() => { setSearch(''); setCategory(''); }} variant="outline" data-testid="button-reset-search">Reset filters</Button>} />}</QueryState></>}</Protected>;
}

function TaskCard({ task }: { task: Task }) {
  const progress = task.maxCompletions ? Math.round((task.completedCount / task.maxCompletions) * 100) : 0;
  return <Link href={`/tasks/${task.id}`} className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" data-testid={`card-task-${task.id}`}><div className="flex items-start justify-between gap-3"><span className="rounded-lg bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">{task.category}</span><span className="font-mono text-sm font-medium text-primary">{money(task.reward)}</span></div><h3 className="mt-5 line-clamp-2 text-base font-extrabold leading-snug tracking-[-.025em]">{task.title}</h3><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{task.description}</p><div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground"><Avatar profile={{ name: task.advertiserName }} small /><span className="truncate">{task.advertiserName}</span><span className="ml-auto">Due {date(task.deadline)}</span></div><div className="mt-5 border-t border-border pt-4"><div className="mb-2 flex justify-between text-[10px] text-muted-foreground"><span>{task.remainingBudget > 0 ? `${money(task.remainingBudget)} remaining` : 'Budget filled'}</span><span>{progress}% filled</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(progress, 100)}%` }} /></div></div><div className="mt-4 flex items-center justify-between text-xs font-bold text-primary">View details <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></div></Link>;
}

function TaskDetailPage() {
  const { taskId = '' } = useParams<{ taskId: string }>();
  const task = useGetTask(taskId, { query: { queryKey: getGetTaskQueryKey(taskId), enabled: Boolean(taskId) } });
  const submit = useSubmitTask();
  const client = useQueryClient();
  const [proof, setProof] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  return <Protected>{() => <QueryState loading={task.isLoading} error={task.error} retry={() => task.refetch()}>{task.data ? <div className="mx-auto max-w-5xl"><Link href="/marketplace" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-marketplace"><ArrowLeft className="size-4" /> Back to marketplace</Link><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div><div className="flex items-center gap-3"><span className="rounded-lg bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">{task.data.category}</span><StatusPill status={task.data.status} /></div><h1 className="mt-5 max-w-2xl text-3xl font-extrabold leading-tight tracking-[-.05em] sm:text-4xl">{task.data.title}</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{task.data.description}</p><div className="mt-8 rounded-2xl border border-border bg-card p-6"><div className="flex items-center gap-3"><FileText className="size-5 text-primary" /><h2 className="font-bold">Instructions</h2></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{task.data.instructions}</p></div><div className="mt-5 rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><h2 className="font-bold">What to submit</h2><span className="rounded-lg bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase text-muted-foreground">{task.data.proofType} proof</span></div><p className="mt-2 text-sm text-muted-foreground">Make sure your proof directly shows the completed task.</p>{success ? <div className="mt-5 rounded-xl bg-primary/5 p-4 text-sm text-primary" data-testid="status-submission-success"><CheckCircle2 className="mb-2 size-5" /><strong>Proof submitted.</strong> It is now in the advertiser&apos;s review queue.</div> : <form className="mt-5" onSubmit={(event) => { event.preventDefault(); setError(''); submit.mutate({ taskId, data: { proof } }, { onSuccess: () => { setSuccess(true); setProof(''); client.invalidateQueries({ queryKey: getListSubmissionsQueryKey() }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); }, onError: () => setError('We could not submit this proof. Please check it and try again.') }); }}><Textarea value={proof} onChange={(event) => setProof(event.target.value)} required minLength={1} maxLength={5000} placeholder={task.data.proofType === 'url' ? 'Paste the URL to your completed work…' : 'Describe or paste your proof…'} className="min-h-32 bg-background" data-testid="textarea-submission-proof" />{error && <p className="mt-2 text-xs text-destructive" data-testid="status-submission-error">{error}</p>}<Button type="submit" disabled={submit.isPending} className="mt-4 min-h-11 gap-2" data-testid="button-submit-proof">{submit.isPending ? 'Submitting…' : 'Submit proof'} <Send className="size-4" /></Button></form>}</div></div><aside><div className="sticky top-28 rounded-2xl border border-border bg-card p-6 shadow-xs"><p className="text-xs font-semibold text-muted-foreground">Earn on approval</p><p className="mt-1 text-4xl font-extrabold tracking-[-.07em] text-primary">{money(task.data.reward)}</p><div className="mt-6 space-y-4 border-t border-border pt-5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Advertiser</span><strong>{task.data.advertiserName}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Deadline</span><strong>{fullDate(task.data.deadline)}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Open spots</span><strong>{Math.max(task.data.maxCompletions - task.data.completedCount, 0)}</strong></div></div><div className="mt-6 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mb-2 size-4 text-primary" />Your submission is reviewed against the posted instructions. Approved rewards move to pending balance first.</div></div></aside></div></div> : <EmptyState title="Task not found" body="This task may have closed or moved." action={<Link href="/marketplace" className="font-bold text-primary" data-testid="link-return-marketplace">Return to marketplace</Link>} />}</QueryState>}</Protected>;
}

function NewTaskPage() {
  const [, setLocation] = useLocation();
  const create = useCreateTask();
  const client = useQueryClient();
  const [form, setForm] = useState({ title: '', category: 'research', description: '', instructions: '', proofType: 'text', requiresKyc: false, maxCompletions: '', deadline: '' });
  const [error, setError] = useState('');
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const unitReward = form.requiresKyc ? 400 : 200;
  return <Protected>{(profile) => profile.role === 'advertiser' || profile.role === 'admin' || profile.role === 'super_admin' ? <div className="mx-auto max-w-3xl"><Link href="/marketplace" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground" data-testid="link-back-create"><ArrowLeft className="size-4" /> Back to marketplace</Link><SectionHeading eyebrow="Advertiser workspace" title="Publish a clear task." body="Give workers everything they need to do good work the first time." /><form className="space-y-5" onSubmit={(event: FormEvent) => { event.preventDefault(); setError(''); create.mutate({ data: { title: form.title, category: form.category, description: form.description, instructions: form.instructions, proofType: form.proofType as 'text' | 'url' | 'image' | 'file', requiresKyc: form.requiresKyc, maxCompletions: Number(form.maxCompletions), deadline: form.deadline } }, { onSuccess: (task) => { client.invalidateQueries({ queryKey: getListTasksQueryKey() }); setLocation(`/tasks/${task.id}`); }, onError: () => setError('We could not publish this task. Check the details and try again.') }); }}><div className="rounded-2xl border border-border bg-card p-6"><h2 className="font-bold">Task basics</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="text-xs font-bold" htmlFor="task-title">Task title</label><Input id="task-title" value={form.title} onChange={(event) => set('title', event.target.value)} className="mt-2 bg-background" placeholder="e.g. Test our onboarding flow" required minLength={3} maxLength={120} data-testid="input-task-title" /></div><div><label className="text-xs font-bold" htmlFor="task-category">Category</label><select id="task-category" value={form.category} onChange={(event) => set('category', event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-new-task-category"><option value="research">Research</option><option value="content">Content</option><option value="social">Social</option><option value="testing">Testing</option></select></div><div><label className="text-xs font-bold" htmlFor="task-deadline">Deadline</label><Input id="task-deadline" type="date" value={form.deadline} onChange={(event) => set('deadline', event.target.value)} className="mt-2 bg-background" required data-testid="input-task-deadline" /></div><div className="sm:col-span-2"><label className="text-xs font-bold" htmlFor="task-description">Short description</label><Textarea id="task-description" value={form.description} onChange={(event) => set('description', event.target.value)} className="mt-2 bg-background" placeholder="What should a worker accomplish?" required minLength={10} maxLength={1000} data-testid="textarea-task-description" /></div><div className="sm:col-span-2"><label className="text-xs font-bold" htmlFor="task-instructions">Step-by-step instructions</label><Textarea id="task-instructions" value={form.instructions} onChange={(event) => set('instructions', event.target.value)} className="mt-2 min-h-36 bg-background" placeholder="Include links, acceptance criteria, and exactly what proof to share." required minLength={10} maxLength={2000} data-testid="textarea-task-instructions" /></div></div></div><div className="rounded-2xl border border-border bg-card p-6"><h2 className="font-bold">Reward &amp; proof</h2><p className="mt-1 text-xs text-muted-foreground">The server applies the fixed LightJob completion price.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-bold" htmlFor="task-completions">Max completions</label><Input id="task-completions" type="number" min="1" value={form.maxCompletions} onChange={(event) => set('maxCompletions', event.target.value)} className="mt-2 bg-background" placeholder="25" required data-testid="input-task-completions" /></div><div><label className="text-xs font-bold" htmlFor="task-proof">Proof type</label><select id="task-proof" value={form.proofType} onChange={(event) => set('proofType', event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-task-proof"><option value="text">Text response</option><option value="url">URL</option><option value="image">Image link</option><option value="file">File link</option></select></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => set('requiresKyc', false)} className={`rounded-xl border p-4 text-left ${!form.requiresKyc ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} data-testid="button-task-standard"><span className="block text-sm font-bold">Standard task</span><span className="mt-1 block text-xs text-muted-foreground">Worker reward: ₦200 per completion</span></button><button type="button" onClick={() => set('requiresKyc', true)} className={`rounded-xl border p-4 text-left ${form.requiresKyc ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} data-testid="button-task-kyc"><span className="block text-sm font-bold">KYC task</span><span className="mt-1 block text-xs text-muted-foreground">Worker reward: ₦400 per completion</span></button></div><div className="mt-5 flex items-center gap-3 rounded-xl bg-secondary p-4 text-xs text-muted-foreground"><CircleDollarSign className="size-5 shrink-0 text-primary" /><span>Estimated funding: <strong className="text-foreground">{money(unitReward * (Number(form.maxCompletions) || 0))}</strong> · {money(unitReward)} per approved completion. The server derives the final reward.</span></div></div>{error && <p className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive" data-testid="status-create-task-error">{error}</p>}<div className="flex justify-end"><Button type="submit" disabled={create.isPending} className="min-h-11 gap-2" data-testid="button-publish-task">{create.isPending ? 'Publishing…' : 'Publish task'} <ArrowRight className="size-4" /></Button></div></form></div> : <EmptyState icon={LockKeyhole} title="Advertiser access required" body="Task publishing is available to advertiser accounts." />}</Protected>;
}

function SubmissionsPage() {
  const [view, setView] = useState<'mine' | 'owned'>('mine');
  const list = useListSubmissions({ view, status: 'all' });
  const review = useReviewSubmission();
  const client = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});
  const approve = (submission: Submission, decision: 'approved' | 'rejected') => review.mutate({ submissionId: submission.id, data: { decision, reviewerNote: note[submission.id] || undefined } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListSubmissionsQueryKey({ view, status: 'all' }) }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); client.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() }); client.invalidateQueries({ queryKey: getListTransactionsQueryKey() }); } });
  return <Protected>{(profile) => <><SectionHeading eyebrow="Proof, reviewed" title={profile.role === 'advertiser' ? 'Review queue.' : 'Your submissions.'} body={profile.role === 'advertiser' ? 'Keep feedback specific. Keep approvals moving.' : 'Every submission has a clear status and a reason.'} action={profile.role === 'advertiser' ? <div className="flex rounded-xl border border-border bg-card p-1"><button onClick={() => setView('owned')} className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${view === 'owned' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} data-testid="button-view-owned">Review queue</button><button onClick={() => setView('mine')} className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${view === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} data-testid="button-view-mine">My work</button></div> : undefined} /><QueryState loading={list.isLoading} error={list.error} retry={() => list.refetch()}>{list.data?.length ? <div className="space-y-3">{list.data.map((item) => <div key={item.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`row-submission-${item.id}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><ClipboardCheck className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.taskTitle}</h3><StatusPill status={item.status} /></div><p className="mt-1 text-xs text-muted-foreground">{view === 'owned' && `Submitted by ${item.workerName} · `}{date(item.submittedAt)}</p><p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed text-muted-foreground">{item.proof}</p>{item.reviewerNote && <p className="mt-3 text-xs text-muted-foreground"><strong className="text-foreground">Review note:</strong> {item.reviewerNote}</p>}{view === 'owned' && item.status === 'pending' && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={note[item.id] || ''} onChange={(event) => setNote((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional note for the worker" className="bg-background" data-testid={`input-review-note-${item.id}`} /><Button onClick={() => approve(item, 'approved')} disabled={review.isPending} className="min-h-11 gap-1.5" data-testid={`button-approve-${item.id}`}><Check className="size-4" /> Approve</Button><Button onClick={() => approve(item, 'rejected')} disabled={review.isPending} variant="outline" className="min-h-11 gap-1.5 text-destructive hover:text-destructive" data-testid={`button-reject-${item.id}`}><X className="size-4" /> Reject</Button></div>}</div><div className="shrink-0 text-right"><p className="font-mono font-medium text-primary">{money(item.reward)}</p><p className="mt-1 text-[10px] text-muted-foreground">reward</p></div></div></div>)}</div> : <EmptyState icon={ClipboardCheck} title={view === 'owned' ? 'Your review queue is clear' : 'No submissions yet'} body={view === 'owned' ? 'Approved work and new proofs will show up here.' : 'Complete a marketplace task and your proof will appear here.'} action={view === 'mine' ? <Link href="/marketplace" className="font-bold text-primary" data-testid="link-empty-marketplace">Browse open tasks</Link> : undefined} />}</QueryState></>}</Protected>;
}

function WithdrawalForm({ availableBalance, onSuccess }: { availableBalance?: number; onSuccess?: () => void }) {
  const create = useCreateWithdrawal();
  const [form, setForm] = useState({ amount: '', method: 'bank_transfer', bankName: '', accountName: '', accountNumber: '' });
  const [error, setError] = useState('');
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate({ data: { amount: Number(form.amount), method: form.method as 'bank_transfer' | 'mobile_money' | 'crypto', accountLabel: `${form.bankName} · ${form.accountName} · ${form.accountNumber}` } }, { onSuccess: onSuccess, onError: () => setError('We could not create that request. Check your available balance and account details.') }); }}><div><label className="text-xs font-bold" htmlFor="withdraw-amount">Amount</label><Input id="withdraw-amount" type="number" min="1" step=".01" max={availableBalance} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-2 bg-background" required data-testid="input-withdraw-amount" /><p className="mt-1 text-[11px] text-muted-foreground">Available now: {money(availableBalance)}</p></div><div><label className="text-xs font-bold" htmlFor="withdraw-method">Method</label><select id="withdraw-method" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-input bg-background text-sm" data-testid="select-withdraw-method"><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="crypto">Crypto</option></select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-bold" htmlFor="withdraw-bank">Bank name</label><Input id="withdraw-bank" value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} className="mt-2 bg-background" placeholder="Your bank" required minLength={2} data-testid="input-withdraw-bank" /></div><div><label className="text-xs font-bold" htmlFor="withdraw-account-name">Account name</label><Input id="withdraw-account-name" value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} className="mt-2 bg-background" placeholder="Name on account" required minLength={2} data-testid="input-withdraw-account-name" /></div><div className="sm:col-span-2"><label className="text-xs font-bold" htmlFor="withdraw-account-number">Account number</label><Input id="withdraw-account-number" value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} className="mt-2 bg-background" placeholder="Destination account number" required minLength={6} data-testid="input-withdraw-account-number" /></div></div>{error && <p className="text-sm text-destructive" data-testid="status-withdraw">{error}</p>}<p className="text-xs leading-relaxed text-muted-foreground">An admin confirms the external bank transfer before this request is marked sent successfully.</p><Button type="submit" disabled={create.isPending} className="min-h-11 w-full" data-testid="button-submit-withdraw">{create.isPending ? 'Sending request…' : 'Request withdrawal'}</Button></form>;
}

function WalletPage() {
  const summary = useGetWalletSummary();
  const transactions = useListTransactions();
  const withdrawals = useListWithdrawals();
  const data = summary.data;
  return <Protected>{() => <><SectionHeading eyebrow="Your money, legible" title="Wallet." body="Balances, movement, and the next withdrawal in one place." action={<Link href="/withdraw" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-wallet-withdraw"><ArrowDownLeft className="size-4" /> Withdraw funds</Link>} /><QueryState loading={summary.isLoading} error={summary.error} retry={() => summary.refetch()}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl bg-primary p-5 text-primary-foreground md:col-span-2"><p className="text-xs opacity-70">Available balance</p><p className="mt-2 text-4xl font-extrabold tracking-[-.07em]" data-testid="text-wallet-balance">{money(data?.availableBalance)}</p><div className="mt-6 flex justify-between border-t border-primary-foreground/20 pt-4 text-xs"><span>Pending {money(data?.pendingBalance)}</span><span>Withdrawals {money(data?.withdrawals)}</span></div></div>{[['Total earned', data?.totalEarned], ['Referral earnings', data?.referralEarned]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border bg-card p-5"><span className="grid size-8 place-items-center rounded-xl bg-secondary text-primary"><TrendingUp className="size-4" /></span><p className="mt-5 text-xs font-semibold text-muted-foreground">{label as string}</p><p className="mt-1 text-2xl font-extrabold tracking-[-.05em]">{money(Number(value))}</p></div>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><p className="font-bold">Transaction ledger</p><p className="mt-1 text-xs text-muted-foreground">A receipt for every movement.</p></div><Link href="/transactions" className="text-xs font-bold text-primary" data-testid="link-wallet-transactions">View all</Link></div>{transactions.isLoading ? <div className="mt-5 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : transactions.data?.length ? <div className="mt-4 divide-y divide-border">{transactions.data.slice(0, 6).map((item) => <TransactionRow key={item.id} item={item} />)}</div> : <p className="py-12 text-center text-sm text-muted-foreground" data-testid="text-empty-transactions">Your ledger is waiting for its first entry.</p>}</div><div className="rounded-2xl border border-border bg-card p-5"><p className="font-bold">Withdrawal history</p><p className="mt-1 text-xs text-muted-foreground">Requests are reviewed securely.</p>{withdrawals.isLoading ? <div className="mt-5 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : withdrawals.data?.length ? <div className="mt-4 space-y-1">{withdrawals.data.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl px-1 py-3" data-testid={`row-withdrawal-${item.id}`}><span className="grid size-8 place-items-center rounded-xl bg-secondary text-primary"><ArrowDownLeft className="size-3.5" /></span><div className="flex-1"><p className="text-xs font-bold">{money(item.amount)} · {item.method.replace('_', ' ')}</p><p className="text-[11px] text-muted-foreground">{date(item.requestedAt)}</p></div><StatusPill status={item.status} /></div>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">No withdrawals requested yet.</p>}</div></div><div className="mt-6 flex gap-3 rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground"><ShieldCheck className="size-5 shrink-0 text-primary" /><p><strong className="text-foreground">LightJob payout policy:</strong> eligible task economics follow a 40% worker, 40% platform operations, and 20% referrer split. Your personal reward and referral earnings are shown separately in the ledger.</p></div></QueryState></>}</Protected>;
}

function WithdrawPage() {
  const summary = useGetWalletSummary();
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
  return <Protected>{() => <div className="mx-auto max-w-2xl"><Link href="/wallet" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground" data-testid="link-back-wallet"><ArrowLeft className="size-4" /> Back to wallet</Link><SectionHeading eyebrow="Move your balance" title="Request a withdrawal." body="Use your verified destination and keep the receipt." /><div className="rounded-2xl border border-border bg-card p-6"><div className="mb-6 flex items-start gap-3 rounded-xl bg-secondary p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-muted-foreground">Your available balance is read from the wallet service. LightJob reviews each request before payment.</p></div><QueryState loading={summary.isLoading} error={summary.error} retry={() => summary.refetch()}><WithdrawalForm availableBalance={summary.data?.availableBalance} onSuccess={() => { setNotice('Withdrawal request received.'); client.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() }); client.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() }); client.invalidateQueries({ queryKey: getListTransactionsQueryKey() }); }} /></QueryState></div>{notice && <div className="mt-4 rounded-xl bg-primary/10 p-4 text-sm font-semibold text-primary" data-testid="status-withdraw-success">{notice}</div>}</div>}</Protected>;
}

function TransactionRow({ item }: { item: Transaction }) {
  const positive = item.amount >= 0;
  return <div className="flex items-center gap-3 py-3" data-testid={`row-transaction-${item.id}`}><span className={`grid size-8 place-items-center rounded-xl ${positive ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>{positive ? <ArrowDownLeft className="size-3.5" /> : <ArrowRight className="size-3.5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.description}</p><p className="text-[11px] text-muted-foreground">{date(item.createdAt)} · {item.status}</p></div><span className={`font-mono text-xs font-medium ${positive ? 'text-primary' : 'text-foreground'}`}>{positive ? '+' : ''}{money(item.amount)}</span></div>;
}

function TransactionsPage() {
  const transactions = useListTransactions();
  return <Protected>{() => <><SectionHeading eyebrow="Receipts" title="Transactions." body="A simple ledger for every wallet movement." /><QueryState loading={transactions.isLoading} error={transactions.error} retry={() => transactions.refetch()}>{transactions.data?.length ? <div className="rounded-2xl border border-border bg-card px-5 sm:px-7"><div className="flex items-center gap-3 border-b border-border py-5"><ListFilter className="size-4 text-primary" /><div><p className="font-bold">All transactions</p><p className="text-xs text-muted-foreground">Task rewards, referrals, funding, deposits, withdrawals, and refunds.</p></div></div><div className="divide-y divide-border">{transactions.data.map((item) => <TransactionRow key={item.id} item={item} />)}</div></div> : <EmptyState icon={ListFilter} title="Your ledger is waiting" body="Completed wallet movements will appear here with their status and timestamp." />}</QueryState></>}</Protected>;
}

function DepositPage() {
  const deposits = useListDeposits();
  const create = useCreateDeposit();
  const client = useQueryClient();
  const [form, setForm] = useState({ amount: '', bankName: '', transferReference: '', transferredAt: '', proofUrl: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    create.mutate({
      data: {
        amount: Number(form.amount),
        bankName: form.bankName,
        transferReference: form.transferReference,
        transferredAt: new Date(form.transferredAt).toISOString(),
        ...(form.proofUrl ? { proofUrl: form.proofUrl } : {}),
      },
    }, {
      onSuccess: () => {
        setNotice('Deposit submitted for admin verification. Your balance will update only after approval.');
        setForm({ amount: '', bankName: '', transferReference: '', transferredAt: '', proofUrl: '' });
        client.invalidateQueries({ queryKey: getListDepositsQueryKey() });
      },
      onError: () => setError('We could not record this deposit. Check the transfer details and try again.'),
    });
  };
  return <Protected>{(profile) => <div className="mx-auto max-w-3xl"><Link href="/wallet" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground" data-testid="link-back-deposit"><ArrowLeft className="size-4" /> Back to wallet</Link><SectionHeading eyebrow="Advertiser wallet" title="Deposit funds." body="Transfer to the official platform account, then submit the receipt for manual verification." /><div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground"><div className="flex items-center gap-2 text-accent"><HandCoins className="size-5" /><span className="font-mono text-[10px] uppercase tracking-widest">Official deposit account</span></div><h2 className="mt-5 text-2xl font-extrabold tracking-[-.05em]">Use only the verified platform details.</h2><p className="mt-3 text-sm leading-relaxed text-sidebar-foreground/65">The platform owner controls the receiving account. Bank details are configured by the super admin and must never be guessed or replaced with a personal account.</p><div className="mt-6 space-y-3 rounded-2xl bg-sidebar-accent p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-sidebar-foreground/55">Bank name</span><strong>Awaiting platform configuration</strong></div><div className="flex justify-between gap-4"><span className="text-sidebar-foreground/55">Account name</span><strong>LightJob platform owner</strong></div><div className="flex justify-between gap-4"><span className="text-sidebar-foreground/55">Account number</span><strong>Not published yet</strong></div><div className="border-t border-sidebar-border pt-3"><p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/55">Your deposit reference / User ID</p><p className="mt-1 font-mono text-lg font-bold text-accent" data-testid="text-deposit-reference">{profile.depositReference}</p></div></div><p className="mt-4 text-xs leading-relaxed text-sidebar-foreground/55">Do not transfer until the official account details are published by the platform owner. Submitting a record does not claim that money was received.</p></div><div className="rounded-2xl border border-border bg-card p-6"><h2 className="font-bold">Submit a bank transfer</h2><p className="mt-1 text-xs text-muted-foreground">All fields are saved as a pending record for admin matching.</p><form className="mt-5 space-y-4" onSubmit={submit}><div><label className="text-xs font-bold" htmlFor="deposit-amount">Amount</label><Input id="deposit-amount" type="number" min="1" step=".01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-2 bg-background" placeholder="₦0.00" required data-testid="input-deposit-amount" /></div><div><label className="text-xs font-bold" htmlFor="deposit-bank">Bank used</label><Input id="deposit-bank" value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} className="mt-2 bg-background" placeholder="Bank used to send the transfer" required minLength={2} data-testid="input-deposit-bank" /></div><div><label className="text-xs font-bold" htmlFor="deposit-reference">Bank transfer reference</label><Input id="deposit-reference" value={form.transferReference} onChange={(event) => setForm({ ...form, transferReference: event.target.value })} className="mt-2 bg-background" placeholder="Reference on your receipt" required minLength={2} data-testid="input-deposit-transfer-reference" /></div><div><label className="text-xs font-bold" htmlFor="deposit-date">Date and time</label><Input id="deposit-date" type="datetime-local" value={form.transferredAt} onChange={(event) => setForm({ ...form, transferredAt: event.target.value })} className="mt-2 bg-background" required data-testid="input-deposit-date" /></div><div><label className="text-xs font-bold" htmlFor="deposit-proof">Payment proof URL <span className="font-normal text-muted-foreground">(optional)</span></label><Input id="deposit-proof" type="url" value={form.proofUrl} onChange={(event) => setForm({ ...form, proofUrl: event.target.value })} className="mt-2 bg-background" placeholder="https://…" data-testid="input-deposit-proof" /></div>{error && <p className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive" data-testid="status-deposit-error">{error}</p>}{notice && <p className="rounded-xl bg-primary/10 p-3 text-sm font-semibold text-primary" data-testid="status-deposit-success">{notice}</p>}<Button type="submit" disabled={create.isPending} className="min-h-11 w-full" data-testid="button-submit-deposit">{create.isPending ? 'Submitting…' : 'Submit deposit for review'}</Button></form></div></div><div className="mt-6 rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="font-bold">Deposit history</p><p className="mt-1 text-xs text-muted-foreground">Only approved records increase Available Balance.</p></div><StatusPill status="pending" /></div>{deposits.isLoading ? <div className="mt-5 space-y-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : deposits.data?.length ? <div className="mt-4 divide-y divide-border">{deposits.data.map((deposit: Deposit) => <div key={deposit.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center" data-testid={`row-deposit-${deposit.id}`}><div className="flex-1"><p className="text-sm font-bold">{money(deposit.amount)} · {deposit.bankName}</p><p className="text-xs text-muted-foreground">{deposit.transferReference} · {fullDate(deposit.transferredAt)}</p></div><StatusPill status={deposit.status} /></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No deposit records yet.</p>}</div></div>}</Protected>;
}

function ReferralsPage() {
  const referral = useGetReferralSummary();
  const [copied, setCopied] = useState(false);
  const data = referral.data;
  const copy = () => { if (data?.referralLink) navigator.clipboard?.writeText(data.referralLink); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return <Protected>{() => <><SectionHeading eyebrow="Share the upside" title="Referrals." body="Invite good people. Earn from the work they complete." /><QueryState loading={referral.isLoading} error={referral.error} retry={() => referral.refetch()}><div className="grid gap-6 lg:grid-cols-[1fr_.85fr]"><div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground sm:p-8"><div className="flex items-center gap-2 text-accent"><Gift className="size-5" /><span className="font-mono text-[10px] uppercase tracking-widest">Your invite link</span></div><h2 className="mt-6 max-w-md text-3xl font-extrabold leading-tight tracking-[-.06em]">Bring your circle into work that adds up.</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-sidebar-foreground/60">Your direct referrals earn their task rewards. You receive the referrer share when eligible work is approved.</p><div className="mt-8 flex flex-col gap-2 rounded-xl bg-sidebar-accent p-2 sm:flex-row"><Input value={data?.referralLink || 'Your referral link will appear here'} readOnly className="border-0 bg-transparent text-sidebar-foreground shadow-none" data-testid="input-referral-link" /><Button onClick={copy} className="min-h-11 gap-2 bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-copy-referral">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy link'}</Button></div><div className="mt-4 flex items-center gap-2 text-xs text-sidebar-foreground/50">Code <strong className="font-mono text-sidebar-foreground">{data?.referralCode || '—'}</strong><button onClick={copy} className="min-h-8 underline underline-offset-2" data-testid="button-copy-code">Copy</button></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><div className="rounded-2xl border border-border bg-card p-6"><p className="text-xs font-semibold text-muted-foreground">Direct referrals</p><p className="mt-3 text-4xl font-extrabold tracking-[-.07em]" data-testid="text-referral-count">{data?.directReferrals || 0}</p><p className="mt-1 text-xs text-primary">People in your circle</p></div><div className="rounded-2xl border border-border bg-card p-6"><p className="text-xs font-semibold text-muted-foreground">Referral earnings</p><p className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-primary" data-testid="text-referral-earnings">{money(data?.referralEarnings)}</p><p className="mt-1 text-xs text-muted-foreground">20% referrer share on eligible work</p></div></div></div><div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="font-bold">Recent referrals</p><p className="mt-1 text-xs text-muted-foreground">People who joined through your link.</p></div><Users className="size-4 text-primary" /></div>{data?.recentReferrals?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{data.recentReferrals.map((person: Referral) => <div key={person.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3" data-testid={`row-referral-${person.id}`}><Avatar profile={{ name: person.name }} small /><div className="flex-1"><p className="text-xs font-bold">{person.name}</p><p className="text-[11px] text-muted-foreground">Joined {date(person.joinedAt)}</p></div><span className="font-mono text-xs text-primary">+{money(person.earned)}</span></div>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">Your first referral will appear here.</p>}</div></QueryState></>}</Protected>;
}

function NotificationsPage() {
  return <Protected>{() => <><SectionHeading eyebrow="Keep your focus" title="Notifications." body="Only meaningful updates belong here." /><EmptyState icon={ActivityIcon} title="You&apos;re all caught up" body="There are no notifications to show right now. Submission reviews and wallet updates will appear when they happen." /></>}</Protected>;
}

function SettingsPage() {
  const { user } = useUser();
  const clerk = useClerk();
  return (
    <Protected>
      {(profile) => (
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="Account" title="Settings." body="Your LightJob profile and sign-in details." />
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <Avatar profile={profile} />
                <div>
                  <p className="font-bold" data-testid="text-settings-name">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Account role</p>
                  <div className="mt-2"><StatusPill status={profile.role} /></div>
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Member since</p>
                  <p className="mt-2 text-sm font-bold">{fullDate(profile.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Referral code</p>
                  <p className="mt-2 font-mono text-sm font-bold">{profile.referralCode}</p>
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Deposit reference</p>
                  <p className="mt-2 font-mono text-sm font-bold">{profile.depositReference}</p>
                </div>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Profile ID</p>
                  <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{profile.id}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 size-5 text-primary" />
                <div className="flex-1">
                  <p className="font-bold">Clerk sign-in profile</p>
                  <p className="mt-1 text-sm text-muted-foreground">Manage the identity details used for authentication. LightJob keeps your earning profile separate and database-backed.</p>
                  {user?.primaryEmailAddress?.emailAddress && <p className="mt-4 text-xs font-semibold text-foreground">{user.primaryEmailAddress.emailAddress}</p>}
                  <Button onClick={() => clerk.openUserProfile()} variant="outline" className="mt-5 min-h-11" data-testid="button-open-clerk-profile">Manage sign-in profile</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Protected>
  );
}

function AdminDepositsPage() {
  const deposits = useListAdminDeposits({ query: { enabled: true, queryKey: getListAdminDepositsQueryKey() } });
  const reviewDeposit = useReviewDeposit();
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
  const review = (item: AdminDeposit, decision: 'approved' | 'rejected') => {
    reviewDeposit.mutate(
      { depositId: item.id, data: { decision } },
      {
        onSuccess: () => {
          setNotice(decision === 'approved' ? 'Deposit approved. Available Balance updated.' : 'Deposit rejected.');
          client.invalidateQueries({ queryKey: getListAdminDepositsQueryKey() });
          client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
          client.invalidateQueries({ queryKey: getGetMeQueryKey() });
          client.invalidateQueries({ queryKey: getGetWalletSummaryQueryKey() });
          client.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        },
      },
    );
  };
  return <Protected>{(profile) => profile.role === 'admin' || profile.role === 'super_admin' ? <><SectionHeading eyebrow="Restricted control room" title="Deposit Management." body="Match the user reference, transfer reference, amount, date, and proof before approving." /><QueryState loading={deposits.isLoading} error={deposits.error} retry={() => deposits.refetch()}>{deposits.data?.length ? <div className="space-y-3">{deposits.data.map((item: AdminDeposit) => <div key={item.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`row-admin-deposit-${item.id}`}><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold">{item.userName} · {money(item.amount)}</p><StatusPill status={item.status} /></div><p className="mt-1 text-xs text-muted-foreground">{item.userEmail} · User ID {item.userId}</p><p className="mt-1 text-xs text-muted-foreground">Deposit reference {item.depositReference} · Transfer {item.transferReference} · {fullDate(item.transferredAt)}</p>{item.proofUrl && <a href={item.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-primary underline">View proof</a>}</div>{item.status === 'pending' && <div className="flex items-start gap-2"><Button onClick={() => review(item, 'approved')} size="sm" disabled={reviewDeposit.isPending} data-testid={`button-approve-deposit-${item.id}`}>Approve Deposit</Button><Button onClick={() => review(item, 'rejected')} size="sm" variant="outline" disabled={reviewDeposit.isPending} data-testid={`button-reject-deposit-${item.id}`}>Reject</Button></div>}</div></div>)}</div> : <EmptyState icon={HandCoins} title="No deposit records" body="Submitted bank transfers will appear here for matching and approval." />}</QueryState>{notice && <button onClick={() => setNotice('')} className="fixed bottom-6 right-6 z-50 rounded-xl bg-sidebar px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-xl" data-testid="status-admin-deposit-notice">{notice}</button>}</> : <EmptyState icon={LockKeyhole} title="Admin access required" body="This control room is only available to admin and super admin accounts." />}</Protected>;
}

function AdminPage() {
  const overview = useGetAdminOverview({ query: { enabled: true, queryKey: getGetAdminOverviewQueryKey() } });
  const users = useListAdminUsers({ query: { enabled: true, queryKey: getListAdminUsersQueryKey() } });
  const withdrawals = useListAdminWithdrawals({ query: { enabled: true, queryKey: getListAdminWithdrawalsQueryKey() } });
  const review = useReviewWithdrawal();
  const updateRole = useUpdateUserRole();
  const client = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const adminStats: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: 'Users', value: overview.data?.totalUsers || 0, Icon: Users },
    { label: 'Active tasks', value: overview.data?.activeTasks || 0, Icon: ClipboardList },
    { label: 'Pending submissions', value: overview.data?.pendingSubmissions || 0, Icon: ClipboardCheck },
    { label: 'Pending withdrawals', value: overview.data?.pendingWithdrawals || 0, Icon: HandCoins },
  ];
  const afterMutation = (message: string) => { setNotice(message); client.invalidateQueries({ queryKey: getListAdminWithdrawalsQueryKey() }); client.invalidateQueries({ queryKey: getListAdminDepositsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); };
  return <Protected>{(profile) => profile.role === 'admin' || profile.role === 'super_admin' ? <><SectionHeading eyebrow="Restricted control room" title="Admin overview." body="Keep the marketplace healthy and payouts moving." /><QueryState loading={overview.isLoading} error={overview.error} retry={() => overview.refetch()}>{overview.data && <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{adminStats.map(({ label, value, Icon }, index) => <div key={label} className="rounded-2xl border border-border bg-card p-5" data-testid={`card-admin-stat-${index}`}><span className="grid size-8 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-4" /></span><p className="mt-5 text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-[-.05em]">{String(value)}</p></div>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><div className="rounded-2xl border border-border bg-card p-6"><p className="font-bold">Platform economics</p><p className="mt-1 text-xs text-muted-foreground">Policy applied to eligible task volume.</p><div className="mt-6 space-y-4">{[['Worker', overview.data.payoutSplit.worker, 'bg-primary'], ['Platform', overview.data.payoutSplit.owner, 'bg-accent'], ['Referrer', overview.data.payoutSplit.referrer, 'bg-[#65a8c8]']].map(([label, value, color]) => <div key={String(label)}><div className="mb-2 flex justify-between text-xs"><span className="font-bold">{label as string}</span><span className="font-mono">{value as number}%</span></div><div className="h-2 rounded-full bg-secondary"><div className={`h-full rounded-full ${color}`} style={{ width: `${Number(value)}%` }} /></div></div>)}</div><div className="mt-7 grid grid-cols-2 gap-3 border-t border-border pt-5"><div><p className="text-[11px] text-muted-foreground">Total volume</p><p className="mt-1 font-mono text-lg">{money(overview.data.totalVolume)}</p></div><div><p className="text-[11px] text-muted-foreground">Platform revenue</p><p className="mt-1 font-mono text-lg text-primary">{money(overview.data.platformRevenue)}</p></div></div></div><div className="rounded-2xl border border-border bg-card p-6"><div className="flex justify-between"><div><p className="font-bold">Withdrawal queue</p><p className="mt-1 text-xs text-muted-foreground">Review, approve, or mark paid.</p></div><HandCoins className="size-4 text-primary" /></div>{withdrawals.isLoading ? <div className="mt-5 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : withdrawals.data?.filter((item) => item.status === 'pending').length ? <div className="mt-4 space-y-3">{withdrawals.data.filter((item) => item.status === 'pending').map((item) => <div key={item.id} className="rounded-xl border border-border p-4" data-testid={`row-admin-withdrawal-${item.id}`}><div className="flex items-start justify-between"><div><p className="text-sm font-bold">{money(item.amount)} · {item.method.replace('_', ' ')}</p><p className="mt-1 text-xs text-muted-foreground">{item.accountLabel} · {date(item.requestedAt)}</p></div><StatusPill status={item.status} /></div><div className="mt-3 flex gap-2"><Input value={note[item.id] || ''} onChange={(event) => setNote({ ...note, [item.id]: event.target.value })} placeholder="Optional note" className="h-9 bg-background text-xs" data-testid={`input-admin-note-${item.id}`} /><Button onClick={() => review.mutate({ withdrawalId: item.id, data: { decision: 'approved', note: note[item.id] } }, { onSuccess: () => afterMutation('Withdrawal approved.') })} size="sm" disabled={review.isPending} data-testid={`button-approve-withdrawal-${item.id}`}>Approve</Button><Button onClick={() => review.mutate({ withdrawalId: item.id, data: { decision: 'rejected', note: note[item.id] } }, { onSuccess: () => afterMutation('Withdrawal rejected.') })} size="sm" variant="outline" disabled={review.isPending} data-testid={`button-reject-withdrawal-${item.id}`}>Reject</Button></div></div>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">The queue is clear.</p>}</div></div></>}</QueryState><div className="mt-6 rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="font-bold">Role permissions</p><p className="mt-1 text-xs text-muted-foreground">Admin and super admin access is enforced by the API.</p></div><ShieldCheck className="size-4 text-primary" /></div>{users.isLoading ? <div className="mt-5 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : users.data?.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-mono">User</th><th className="pb-3 font-mono">Last active</th><th className="pb-3 font-mono">Role</th><th className="pb-3 text-right font-mono">Action</th></tr></thead><tbody className="divide-y divide-border">{users.data.map((user: AdminUser) => <tr key={user.id} data-testid={`row-admin-user-${user.id}`}><td className="py-4"><div className="flex items-center gap-3"><Avatar profile={user} small /><div><p className="font-bold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div></div></td><td className="py-4 text-xs text-muted-foreground">{date(user.lastActiveAt)}</td><td className="py-4"><StatusPill status={user.role} /></td><td className="py-4 text-right"><select value={user.role} onChange={(event) => updateRole.mutate({ userId: user.id, data: { role: event.target.value as 'worker' | 'advertiser' | 'admin' } }, { onSuccess: () => { setNotice('Role updated.'); client.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }); } })} disabled={user.role === 'super_admin' || updateRole.isPending} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold" data-testid={`select-role-${user.id}`}><option value="worker">Worker</option><option value="advertiser">Advertiser</option><option value="admin">Admin</option></select></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No users to show" body="User accounts will appear here." />}</div>{notice && <button onClick={() => setNotice('')} className="fixed bottom-6 right-6 z-50 rounded-xl bg-sidebar px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-xl" data-testid="status-admin-notice">{notice}</button>}</> : <EmptyState icon={LockKeyhole} title="Admin access required" body="This control room is only available to admin and super admin accounts." />}</Protected>;
}

function LogoutPage() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  useEffect(() => { void signOut().then(() => setLocation('/')); }, [signOut, setLocation]);
  return <div className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="text-center"><Skeleton className="mx-auto size-12" /><p className="mt-4 text-sm text-muted-foreground">Signing you out securely…</p></div></div>;
}

function RouterPage() {
  return <Router base={basePath}><ClerkProviderWithRoutes /></Router>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const { getToken } = useAuth();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => { setAuthTokenGetter(getToken); return () => setAuthTokenGetter(null); }, [getToken]);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your LightJob workspace' } }, signUp: { start: { title: 'Create your account', subtitle: 'Start earning with clear, verified work' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <ErrorBoundary resetKey={window.location.pathname}>
        <Switch>
          <Route path="/" component={PublicHome} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/marketplace" component={MarketplacePage} />
          <Route path="/tasks/new" component={NewTaskPage} />
          <Route path="/tasks/:taskId" component={TaskDetailPage} />
          <Route path="/submissions" component={SubmissionsPage} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/deposit" component={DepositPage} />
          <Route path="/withdraw" component={WithdrawPage} />
          <Route path="/referrals" component={ReferralsPage} />
          <Route path="/transactions" component={TransactionsPage} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/admin/deposits" component={AdminDepositsPage} />
          <Route path="/logout" component={LogoutPage} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
      <Toaster />
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in the environment');
  return <TooltipProvider><RouterPage /></TooltipProvider>;
}

export default App;