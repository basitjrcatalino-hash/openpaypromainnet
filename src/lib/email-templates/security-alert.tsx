import * as React from 'react'
import { Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { BRAND, BrandEmail, DetailRows, text } from './brand'

interface SecurityAlertProps {
  title?: string
  message?: string
  device?: string | null
  location?: string | null
  when?: string | null
  actionUrl?: string
}

const Email = ({
  title = 'Security alert',
  message = 'We noticed a new sign-in to your OpenPay Pro account.',
  device = null,
  location = null,
  when = null,
  actionUrl = `${BRAND.url}/settings`,
}: SecurityAlertProps) => (
  <BrandEmail
    preview={title}
    heading={title}
    ctaLabel="Review security settings"
    ctaUrl={actionUrl}
    footerNote="If this wasn't you, change your PIN and revoke sessions right away."
  >
    <Text style={text}>{message}</Text>
    <DetailRows
      rows={[
        ['Device', device],
        ['Location', location],
        ['When', when],
      ]}
    />
  </BrandEmail>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => data?.title ?? 'OpenPay Pro security alert',
  displayName: 'Security alert',
  previewData: {
    title: 'New sign-in to your account',
    device: 'iPhone · Safari',
    location: 'Manila, PH',
    when: 'Today, 09:24',
  },
} satisfies TemplateEntry

export default Email
