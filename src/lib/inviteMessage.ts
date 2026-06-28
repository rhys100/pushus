export function buildInviteMessage(link: string): string {
  return [
    "You're invited to PushUS — a private push-up app for you, your mates, and their mates. Log reps, bank your sets, and see how you're tracking on daily, weekly, and monthly leaderboards.",
    '',
    'Everyone gets a science-based training plan with rest, easy, and challenge days to help you build properly, not burn out. Tap the link, sign in, set up your profile, and join the group:',
    link,
  ].join('\n')
}
