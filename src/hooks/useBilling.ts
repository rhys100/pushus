import { useQuery } from '@tanstack/react-query'
import { messageFromFunctionsInvokeError } from '@/lib/functionsInvokeError'
import { supabase } from '@/lib/supabase'
import { billingConfig, type DeploymentSettings, type GroupSubscriptionOwner } from '@/lib/billing'

async function fetchDeploymentSettings(): Promise<DeploymentSettings | null> {
  const { data, error } = await supabase.rpc('get_deployment_settings')

  if (error) throw error
  return (data?.[0] as DeploymentSettings | undefined) ?? null
}

async function fetchGroupSubscription(
  groupId: string,
): Promise<GroupSubscriptionOwner | null> {
  const { data, error } = await supabase
    .from('group_subscriptions_owner')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle()

  if (error) throw error
  return (data as GroupSubscriptionOwner | null) ?? null
}

async function fetchCanWrite(groupId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_my_group_write', {
    p_group_id: groupId,
  })

  if (error) throw error
  return Boolean(data)
}

async function fetchBillingStatus(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('group_billing_status', {
    p_group_id: groupId,
  })

  if (error) throw error
  return String(data)
}

export function useDeploymentSettings() {
  return useQuery({
    queryKey: ['deployment-settings'],
    queryFn: fetchDeploymentSettings,
    staleTime: 60_000,
  })
}

export function useGroupSubscription(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-subscription', groupId],
    queryFn: () => fetchGroupSubscription(groupId!),
    enabled: billingConfig.enabled && Boolean(groupId),
  })
}

export function useGroupWriteAccess(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-write-access', groupId],
    queryFn: () => fetchCanWrite(groupId!),
    enabled: Boolean(groupId),
  })
}

export function useGroupBillingStatus(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-billing-status', groupId],
    queryFn: () => fetchBillingStatus(groupId!),
    enabled: billingConfig.enabled && Boolean(groupId),
  })
}

export async function startCheckoutSession(
  groupId: string,
  planInterval: 'monthly' | 'yearly',
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { group_id: groupId, plan_interval: planInterval },
  })

  if (error) {
    const serverMessage = await messageFromFunctionsInvokeError(error)
    if (serverMessage) throw new Error(serverMessage)
    throw error
  }
  if (!data?.url) {
    throw new Error(data?.error ?? 'Checkout session could not be created')
  }

  return data.url as string
}

export async function openCustomerPortal(groupId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    'create-customer-portal-session',
    { body: { group_id: groupId } },
  )

  if (error) {
    const serverMessage = await messageFromFunctionsInvokeError(error)
    if (serverMessage) throw new Error(serverMessage)
    throw error
  }
  if (!data?.url) {
    throw new Error(data?.error ?? 'Customer portal session could not be created')
  }

  return data.url as string
}
