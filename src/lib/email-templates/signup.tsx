import * as React from 'react'
import { Link, Text } from '@react-email/components'

import { BrandEmail, link, text } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <BrandEmail
    preview={`Confirm your email for ${siteName}`}
    heading="Confirm your email"
    ctaLabel="Verify email"
    ctaUrl={confirmationUrl}
    siteUrl={siteUrl}
    footerNote="If you didn't create an OpenPay Pro account, you can safely ignore this email."
  >
    <Text style={text}>
      Welcome to {siteName}. Confirm{' '}
      <Link href={`mailto:${recipient}`} style={link}>
        {recipient}
      </Link>{' '}
      to activate your wallet, secure your balance and start sending or
      receiving instantly.
    </Text>
  </BrandEmail>
)

export default SignupEmail
