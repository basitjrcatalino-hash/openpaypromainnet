import * as React from 'react'
import { Text } from '@react-email/components'

import { BrandEmail, text } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <BrandEmail
    preview={`Your sign-in link for ${siteName}`}
    heading="Your sign-in link"
    ctaLabel="Sign in to OpenPay Pro"
    ctaUrl={confirmationUrl}
    footerNote="Never share this link. It signs anyone in to your wallet and expires shortly."
  >
    <Text style={text}>
      Tap below to sign in to {siteName}. For your security this one-time link
      expires shortly and can only be used once.
    </Text>
  </BrandEmail>
)

export default MagicLinkEmail
