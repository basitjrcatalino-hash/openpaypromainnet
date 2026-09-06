import * as React from 'react'
import { Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { BRAND, BrandEmail, text } from './brand'

interface WelcomeProps {
  name?: string
  actionUrl?: string
}

const Email = ({ name, actionUrl = `${BRAND.url}/dashboard` }: WelcomeProps) => (
  <BrandEmail
    preview="Your OpenPay Pro wallet is ready"
    heading={name ? `Welcome, ${name}` : 'Welcome to OpenPay Pro'}
    ctaLabel="Open your wallet"
    ctaUrl={actionUrl}
    footerNote="Need a hand? Support is built into the app, 24/7."
  >
    <Text style={text}>
      Your wallet is live. You can top up with QR Ph, PayPal or crypto, send to
      any OpenPay Pro username or address, swap and trade OUSD, and track every
      move in Activity.
    </Text>
    <Text style={text}>
      Turn on biometric unlock and a PIN in Settings to keep your balance
      protected.
    </Text>
  </BrandEmail>
)

export const template = {
  component: Email,
  subject: 'Your OpenPay Pro wallet is ready',
  displayName: 'Welcome',
  previewData: { name: 'Alex' },
} satisfies TemplateEntry

export default Email
