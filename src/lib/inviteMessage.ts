export function buildInviteMessage(link: string, groupName?: string): string {
  const joinLine = 'Tap the link, sign in, set up your profile, and join the group:'

  if (groupName?.trim()) {
    return [
      `You're invited to join ${groupName.trim()} on PushUS.`,
      '',
      joinLine,
      link,
    ].join('\n')
  }

  return ['Join my PushUS group.', '', joinLine, link].join('\n')
}
