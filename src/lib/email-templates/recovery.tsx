import * as React from 'react'
import { Text } from '@react-email/components'

import { BrandEmail, text } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <BrandEmail
    preview={`Reset your password for ${siteName}`}
    heading="Reset your password"
    ctaLabel="Reset password"
    ctaUrl={confirmationUrl}
    footerNote="If you didn't request this, your password stays unchanged and no action is needed."
  >
    <Text style={text}>
      We received a request to reset the password for your {siteName} account.
      Choose a new one with the button below — the link expires shortly for your
      security.
    </Text>
  </BrandEmail>
)

export default RecoveryEmail
