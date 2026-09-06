import * as React from 'react'
import { Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { BRAND, BrandEmail, DetailRows, text } from './brand'

interface SupportReplyProps {
  agentName?: string
  message?: string
  ticketRef?: string | null
  actionUrl?: string
}

const Email = ({
  agentName = 'OpenPay Pro Support',
  message = 'We replied to your support request.',
  ticketRef = null,
  actionUrl = `${BRAND.url}/support`,
}: SupportReplyProps) => (
  <BrandEmail
    preview="You have a new reply from OpenPay Pro Support"
    heading="New reply from Support"
    ctaLabel="Open support chat"
    ctaUrl={actionUrl}
    footerNote="Reply inside the app so your conversation stays in one place."
  >
    <Text style={text}>{message}</Text>
    <DetailRows
      rows={[
        ['From', agentName],
        ['Ticket', ticketRef],
      ]}
    />
  </BrandEmail>
)

export const template = {
  component: Email,
  subject: 'New reply from OpenPay Pro Support',
  displayName: 'Support reply',
  previewData: {
    agentName: 'Mara · OpenPay Pro',
    message: 'Your top up has been credited — let us know if anything looks off.',
    ticketRef: 'SUP-2291',
  },
} satisfies TemplateEntry

export default Email
