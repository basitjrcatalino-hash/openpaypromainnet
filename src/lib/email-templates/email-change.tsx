import * as React from 'react'
import { Link, Text } from '@react-email/components'

import { BrandEmail, DetailRows, link, text } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandEmail
    preview={`Confirm your email change for ${siteName}`}
    heading="Confirm your email change"
    ctaLabel="Confirm change"
    ctaUrl={confirmationUrl}
    footerNote="If you didn't request this change, secure your account immediately."
  >
    <Text style={text}>
      You asked to change the email address on your {siteName} account.
    </Text>
    <DetailRows
      rows={[
        ['Current', oldEmail],
        ['New', newEmail],
      ]}
    />
    <Text style={text}>
      Confirm below to finish. Questions? Reply from{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>
      .
    </Text>
  </BrandEmail>
)

export default EmailChangeEmail
