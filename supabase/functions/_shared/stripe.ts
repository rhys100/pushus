import Stripe from 'npm:stripe@17.3.1'

export function stripeClient(): Stripe {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export function priceIdForInterval(interval: 'monthly' | 'yearly'): string {
  const envKey =
    interval === 'yearly' ? 'STRIPE_YEARLY_PRICE_ID' : 'STRIPE_MONTHLY_PRICE_ID'
  const priceId = Deno.env.get(envKey)

  if (!priceId) {
    throw new Error(`Missing ${envKey}`)
  }

  return priceId
}
