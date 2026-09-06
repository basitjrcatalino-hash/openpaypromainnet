import * as React from 'react'
import { Link, Text } from '@react-email/components'

import { BrandEmail, link, text } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <BrandEmail
    preview={`You've been invited to join ${siteName}`}
    heading="You've been invited"
    ctaLabel="Accept invitation"
    ctaUrl={confirmationUrl}
    siteUrl={siteUrl}
    footerNote="If you weren't expecting this invitation, you can safely ignore this email."
  >
    <Text style={text}>
      You've been invited to join{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Accept below to create your account and open your wallet.
    </Text>
  </BrandEmail>
)

export default InviteEmail
