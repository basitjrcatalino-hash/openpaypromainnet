import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

/**
 * OpenPay Pro shared email shell.
 * Matches the in-app Phantom-style dark UI: near-black card, lilac accent
 * (#ab9ff2), pill CTA, monospace figures. Body stays white for inbox safety.
 */

export const BRAND = {
  name: 'OpenPay Pro',
  url: 'https://openpaypro.space',
  accent: '#ab9ff2',
  accentSoft: '#c9beff',
  ink: '#0b0b0f',
  card: '#16161d',
  border: '#2a2a35',
  text: '#c9c9d4',
  muted: '#8b8b99',
  green: '#14f195',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif",
  margin: '0',
  padding: '24px 0',
}

export const container = { width: '100%', maxWidth: '520px', padding: '0 16px' }

export const card = {
  backgroundColor: BRAND.ink,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  padding: '28px 26px',
}

export const eyebrow = {
  margin: '0 0 14px',
  fontSize: '11px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: BRAND.accent,
  fontWeight: 700 as const,
}

export const h1 = {
  margin: '0 0 12px',
  fontSize: '23px',
  lineHeight: '1.25',
  letterSpacing: '-0.02em',
  fontWeight: 700 as const,
  color: '#ffffff',
}

export const text = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: '1.6',
  color: BRAND.text,
}

export const link = { color: BRAND.accentSoft, textDecoration: 'underline' }

export const button = {
  display: 'inline-block',
  backgroundColor: BRAND.accent,
  color: '#0b0814',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '999px',
  padding: '13px 26px',
  textDecoration: 'none',
}

export const amount = {
  margin: '0 0 6px',
  fontSize: '32px',
  fontWeight: 800 as const,
  letterSpacing: '-0.03em',
  color: '#ffffff',
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}

export const codeStyle = {
  display: 'inline-block',
  margin: '0 0 18px',
  padding: '14px 22px',
  fontSize: '28px',
  letterSpacing: '0.22em',
  fontWeight: 700 as const,
  color: '#ffffff',
  backgroundColor: '#1f1b30',
  border: `1px solid ${BRAND.accent}`,
  borderRadius: '14px',
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}

export const hr = { borderColor: BRAND.border, margin: '22px 0' }

export const small = {
  margin: '0',
  fontSize: '12px',
  lineHeight: '1.6',
  color: BRAND.muted,
}

const rowLabel = { fontSize: '13px', color: BRAND.muted, padding: '7px 0' }
const rowValue = {
  fontSize: '13px',
  color: '#f2f2f7',
  padding: '7px 0',
  textAlign: 'right' as const,
}

export function DetailRows({
  rows,
}: {
  rows: Array<[string, string | null | undefined]>
}) {
  const visible = rows.filter(([, v]) => v != null && String(v).length > 0)
  if (!visible.length) return null
  return (
    <table
      style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0 20px' }}
    >
      <tbody>
        {visible.map(([label, value]) => (
          <tr key={label}>
            <td style={rowLabel}>{label}</td>
            <td style={rowValue}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export interface BrandEmailProps {
  preview: string
  eyebrow?: string
  heading: string
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
  siteUrl?: string
  children?: React.ReactNode
}

export function BrandEmail({
  preview,
  eyebrow: eyebrowText = BRAND.name,
  heading,
  ctaLabel,
  ctaUrl,
  footerNote,
  siteUrl = BRAND.url,
  children,
}: BrandEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={eyebrow}>{eyebrowText}</Text>
            <Heading style={h1}>{heading}</Heading>
            {children}
            {ctaLabel && ctaUrl ? (
              <Button style={button} href={ctaUrl}>
                {ctaLabel}
              </Button>
            ) : null}
            <Hr style={hr} />
            <Text style={small}>
              {footerNote ? `${footerNote} ` : ''}
              Sent by{' '}
              <Link href={siteUrl} style={link}>
                OpenPay Pro
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BrandEmail
