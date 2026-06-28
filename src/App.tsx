import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppUpdateChecker } from '@/components/AppUpdateChecker'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { TabLayout } from '@/components/layout/TabLayout'
import { Skeleton } from '@/components/ui'
import { TodayPage } from '@/pages/TodayPage'

const PushNotificationPrompt = lazy(() =>
  import('@/components/PushNotificationPrompt').then((m) => ({
    default: m.PushNotificationPrompt,
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
const TrainingSettingsPage = lazy(() =>
  import('@/pages/TrainingSettingsPage').then((m) => ({ default: m.TrainingSettingsPage })),
)

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
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

export default function App() {
  return (
    <>
      <AppUpdateChecker />
      <Suspense fallback={null}>
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
          path="/settings"
          element={
            <LazyPage>
              <RequireAuth mode="onboarded">
                <SettingsPage />
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
          path="/achievements"
          element={
            <LazyPage>
              <RequireAuth mode="member">
                <AchievementsPage />
              </RequireAuth>
            </LazyPage>
          }
        />

        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </>
  )
}
