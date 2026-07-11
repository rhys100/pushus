import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppUpdateChecker } from '@/components/AppUpdateChecker'
import { ConfigErrorScreen } from '@/components/ConfigErrorScreen'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { TabLayout } from '@/components/layout/TabLayout'
import { Skeleton } from '@/components/ui'
import { useAppServiceWorker } from '@/hooks/useAppServiceWorker'
import { useDismissStaleReminders } from '@/hooks/useDismissStaleReminders'
import { useNotificationClickNavigation } from '@/hooks/useNotificationClickNavigation'
import { usePwaLaunchHandler } from '@/hooks/usePwaLaunchHandler'
import { isSupabaseConfigured } from '@/lib/supabase'
import { TodayPage } from '@/pages/TodayPage'

const PushNotificationPrompt = lazy(() =>
  import('@/components/PushNotificationPrompt').then((m) => ({
    default: m.PushNotificationPrompt,
  })),
)
const PwaInstallPrompt = lazy(() =>
  import('@/components/PwaInstallPrompt').then((m) => ({
    default: m.PwaInstallPrompt,
  })),
)
const PwaOpenAppPrompt = lazy(() =>
  import('@/components/PwaOpenAppPrompt').then((m) => ({
    default: m.PwaOpenAppPrompt,
  })),
)
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const AuthCallbackPage = lazy(() =>
  import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
)
const OnboardingProfilePage = lazy(() =>
  import('@/pages/OnboardingProfilePage').then((m) => ({ default: m.OnboardingProfilePage })),
)
const PendingPage = lazy(() =>
  import('@/pages/PendingPage').then((m) => ({ default: m.PendingPage })),
)
const PrivateBetaPage = lazy(() =>
  import('@/pages/PrivateBetaPage').then((m) => ({ default: m.PrivateBetaPage })),
)
const CreateGroupPage = lazy(() =>
  import('@/pages/CreateGroupPage').then((m) => ({ default: m.CreateGroupPage })),
)
const LeaderboardPage = lazy(() =>
  import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })),
)
const ActivityPage = lazy(() =>
  import('@/pages/ActivityPage').then((m) => ({ default: m.ActivityPage })),
)
const GroupPage = lazy(() =>
  import('@/pages/GroupPage').then((m) => ({ default: m.GroupPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
)
const GuestPage = lazy(() =>
  import('@/pages/GuestPage').then((m) => ({ default: m.GuestPage })),
)
const JoinPage = lazy(() =>
  import('@/pages/JoinPage').then((m) => ({ default: m.JoinPage })),
)
const JoinLandingPage = lazy(() =>
  import('@/pages/JoinLandingPage').then((m) => ({ default: m.JoinLandingPage })),
)
const BillingPage = lazy(() =>
  import('@/pages/BillingPage').then((m) => ({ default: m.BillingPage })),
)
const ChallengesPage = lazy(() =>
  import('@/pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })),
)
const AchievementsPage = lazy(() =>
  import('@/pages/AchievementsPage').then((m) => ({ default: m.AchievementsPage })),
)
const ChallengeDetailPage = lazy(() =>
  import('@/pages/ChallengeDetailPage').then((m) => ({ default: m.ChallengeDetailPage })),
)
const MatesPage = lazy(() =>
  import('@/pages/MatesPage').then((m) => ({ default: m.MatesPage })),
)
const MateAddPage = lazy(() =>
  import('@/pages/MateAddPage').then((m) => ({ default: m.MateAddPage })),
)
const DevPreviewPage = lazy(() =>
  import('@/pages/DevPreviewPage').then((m) => ({ default: m.DevPreviewPage })),
)
const TrainingSettingsPage = lazy(() =>
  import('@/pages/TrainingSettingsPage').then((m) => ({ default: m.TrainingSettingsPage })),
)
const WhatsNewHistoryPage = lazy(() =>
  import('@/pages/WhatsNewHistoryPage').then((m) => ({ default: m.WhatsNewHistoryPage })),
)
const HowItWorksPage = lazy(() =>
  import('@/pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })),
)
const GroupAdminPage = lazy(() =>
  import('@/pages/GroupAdminPage').then((m) => ({ default: m.GroupAdminPage })),
)

function PageLoader() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div className="w-full max-w-xs space-y-3">
        <Skeleton className="mx-auto h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function NotificationClickNavigation() {
  useNotificationClickNavigation()
  return null
}

function PwaLaunchHandlerRegistration() {
  usePwaLaunchHandler()
  return null
}

function AppServiceWorkerRegistration() {
  useAppServiceWorker()
  return null
}

function StaleReminderCleanup() {
  useDismissStaleReminders()
  return null
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigErrorScreen />
  }

  return (
    <>
      <AppServiceWorkerRegistration />
      <StaleReminderCleanup />
      <PwaLaunchHandlerRegistration />
      <NotificationClickNavigation />
      <AppUpdateChecker />
      <Suspense fallback={null}>
        <PwaInstallPrompt />
        <PwaOpenAppPrompt />
        <PushNotificationPrompt />
      </Suspense>
      <Routes>
        <Route
          path="/login"
          element={
            <LazyPage>
              <RequireAuth mode="guest">
                <LoginPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <LazyPage>
              <AuthCallbackPage />
            </LazyPage>
          }
        />
        <Route
          path="/about"
          element={
            <LazyPage>
              <AboutPage />
            </LazyPage>
          }
        />
        <Route
          path="/guest"
          element={
            <LazyPage>
              <GuestPage />
            </LazyPage>
          }
        />
        <Route
          path="/join"
          element={
            <LazyPage>
              <JoinLandingPage />
            </LazyPage>
          }
        />
        <Route
          path="/join/:code"
          element={
            <LazyPage>
              <JoinPage />
            </LazyPage>
          }
        />
        <Route
          path="/private-beta"
          element={
            <LazyPage>
              <RequireAuth mode="auth">
                <PrivateBetaPage />
              </RequireAuth>
            </LazyPage>
          }
        />

        <Route
          path="/onboarding/profile"
          element={
            <LazyPage>
              <RequireAuth mode="auth">
                <OnboardingProfilePage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/pending"
          element={
            <LazyPage>
              <RequireAuth mode="pending">
                <PendingPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/group/create"
          element={
            <LazyPage>
              <RequireAuth mode="onboarded">
                <CreateGroupPage />
              </RequireAuth>
            </LazyPage>
          }
        />

        <Route
          element={
            <RequireAuth mode="member">
              <TabLayout />
            </RequireAuth>
          }
        >
          <Route path="/today" element={<TodayPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/group" element={<GroupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="/group/billing"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <BillingPage />
              </RequireAuth>
            </LazyPage>
          }
        />

        <Route
          path="/settings/training"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <TrainingSettingsPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/settings/group-admin"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <GroupAdminPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/settings/whats-new"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <WhatsNewHistoryPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/settings/how-it-works"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <HowItWorksPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/challenges"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <ChallengesPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/challenges/:competitionId"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <ChallengeDetailPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/achievements"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <AchievementsPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/mates"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <MatesPage />
              </RequireAuth>
            </LazyPage>
          }
        />
        <Route
          path="/mates/add/:code"
          element={
            <LazyPage>
              {/* Onboarded, not member: a mate link is redeemable across groups
                  (redeem_mate_code allows it), so gating on active-group
                  membership wrongly bounced anyone in a different/other group. */}
              <RequireAuth mode="onboarded">
                <MateAddPage />
              </RequireAuth>
            </LazyPage>
          }
        />

        {import.meta.env.DEV ? (
          <Route
            path="/dev/preview"
            element={
              <LazyPage>
                <DevPreviewPage />
              </LazyPage>
            }
          />
        ) : null}

        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </>
  )
}
