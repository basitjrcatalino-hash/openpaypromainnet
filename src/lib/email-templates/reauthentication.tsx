import * as React from 'react'
import { Text } from '@react-email/components'

import { BrandEmail, codeStyle, text } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandEmail
    preview="Your OpenPay Pro verification code"
    heading="Confirm it's you"
    footerNote="This code expires shortly. If you didn't request it, ignore this email."
  >
    <Text style={text}>Use this code to confirm your identity:</Text>
    <Text style={codeStyle}>{token}</Text>
    <Text style={text}>Never share this code — OpenPay Pro will never ask for it.</Text>
  </BrandEmail>
)

export default ReauthenticationEmail
