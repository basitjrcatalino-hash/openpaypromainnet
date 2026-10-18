import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDocLayout, LegalSection } from "@/components/legal-doc-layout";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Software License — OpenPay Pro" },
      {
        name: "description",
        content:
          "Software License for OpenPay Pro and derivative works built for the OpenPay ecosystem, powered by OpenPay and OpenPay Arc. Copyright © 2025 MRWAIN ORGANIZATION.",
      },
      { property: "og:title", content: "Software License — OpenPay Pro" },
      {
        property: "og:description",
        content:
          "Software License governing use and derivative works for OpenPay and OpenPay Arc applications. Copyright © 2025 MRWAIN ORGANIZATION.",
      },
      { property: "og:url", content: "https://openpaypi.space/legal" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypi.space/legal" }],
  }),
  component: LegalLicensePage,
});

const LICENSE_SPEECH = `
Software License. Copyright 2025 MRWAIN ORGANIZATION.

Permission is hereby granted by the application software developer, free of charge, to any person obtaining a copy of this application, software and associated documentation files, which was developed by the Software Developer for use on the OpenPay ecosystem (OpenPay and OpenPay Arc), whereby the purpose of this license is to permit the development of derivative works based on the Software, including the right to use, copy, modify, merge, publish, distribute, sub-license, and/or sell copies of such derivative works and any Software components incorporated therein, and to permit persons to whom such derivative works are furnished to do so, in each case, solely to develop, use and market applications for the official OpenPay ecosystem.

For purposes of this license, the OpenPay ecosystem shall mean OpenPay, OpenPay Pro, OpenPay Arc, and any application, software, or other present or future platform developed, owned or managed by MRWAIN ORGANIZATION, and its parents, affiliates or subsidiaries, for which the Software was developed, or on which the Software continues to operate. However, you are prohibited from using any portion of the Software or any derivative works thereof in any manner which infringes on any OpenPay intellectual property rights, to hack any OpenPay or OpenPay Arc systems or processes, or to develop any product or service which is competitive with the OpenPay ecosystem.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, PUBLISHERS, OR COPYRIGHT HOLDERS OF THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

OpenPay, OpenPay Pro, OpenPay Arc and their logos are trademarks of MRWAIN ORGANIZATION. Arc, USDC and other third-party names and logos belong to their respective owners.

Copyright 2025 MRWAIN ORGANIZATION.
`.trim();

const TOC = [
  { id: "grant", label: "Grant of license" },
  { id: "openpay-ecosystem", label: "OpenPay ecosystem definition" },
  { id: "prohibitions", label: "Prohibitions" },
  { id: "notice", label: "Notice requirement" },
  { id: "disclaimer", label: "Disclaimer of warranty" },
  { id: "trademarks", label: "Trademarks" },
  { id: "copyright", label: "Copyright" },
];

function LegalLicensePage() {
  return (
    <LegalDocLayout
      navKey="legal"
      title="Software License"
      dek="Permission to build derivative works for the OpenPay ecosystem, powered by OpenPay and OpenPay Arc — with the limits, notices, and disclaimers that protect OpenPay and MRWAIN ORGANIZATION."
      updated="2025"
      speechId="page:legal"
      speechText={LICENSE_SPEECH}
      hero={{ from: "#93c5fd", to: "#a5b4fc", glyph: "©" }}
      toc={TOC}
    >
      <LegalSection id="grant" heading="1. Grant of license">
        <p>
          Copyright (C) 2025 MRWAIN ORGANIZATION.
        </p>
        <p>
          Permission is hereby granted by the application software developer (“Software Developer”),
          free of charge, to any person obtaining a copy of this application, software and associated
          documentation files (the “Software”), which was developed by the Software Developer for use
          on the OpenPay ecosystem (OpenPay and OpenPay Arc), whereby the purpose of this license is to permit the development of
          derivative works based on the Software, including the right to use, copy, modify, merge,
          publish, distribute, sub-license, and/or sell copies of such derivative works and any
          Software components incorporated therein, and to permit persons to whom such derivative
          works are furnished to do so, in each case, solely to develop, use and market applications
          for the official OpenPay ecosystem.
        </p>
      </LegalSection>

      <LegalSection id="openpay-ecosystem" heading="2. OpenPay ecosystem definition">
        <p>
          For purposes of this license, the OpenPay ecosystem shall mean OpenPay, OpenPay Pro,
          OpenPay Arc, and any application, software, or other present or future platform developed,
          owned or managed by MRWAIN ORGANIZATION, and its
          parents, affiliates or subsidiaries, for which the Software was developed, or on which the
          Software continues to operate.
        </p>
      </LegalSection>

      <LegalSection id="prohibitions" heading="3. Prohibitions">
        <p>
          However, you are prohibited from using any portion of the Software or any derivative works
          thereof in any manner:
        </p>
        <ul className="space-y-3 pl-1">
          {[
            "which infringes on any OpenPay intellectual property rights,",
            "to hack any OpenPay or OpenPay Arc systems or processes, or",
            "to develop any product or service which is competitive with the OpenPay ecosystem.",
          ].map((item) => (
            <li key={item} className="flex gap-3 text-lg leading-relaxed">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="notice" heading="4. Notice requirement">
        <p>
          The above copyright notice and this permission notice shall be included in all copies or
          substantial portions of the Software.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" heading="5. Disclaimer of warranty">
        <p className="uppercase tracking-wide">
          THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, PUBLISHERS, OR COPYRIGHT
          HOLDERS OF THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY
          OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO BUSINESS INTERRUPTION, LOSS OF USE,
          DATA OR PROFITS) HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
          STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE) ARISING FROM, OUT OF OR IN CONNECTION WITH
          THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        </p>
      </LegalSection>

      <LegalSection id="trademarks" heading="6. Trademarks">
        <p>
          OpenPay, OpenPay Pro, OpenPay Arc and their logos are trademarks of MRWAIN ORGANIZATION. Arc, USDC and other third-party names and logos belong to their respective owners.
        </p>
      </LegalSection>

      <LegalSection id="copyright" heading="7. Copyright">
        <p>
          Copyright (C) 2025 MRWAIN ORGANIZATION.
        </p>
        <p>
          See also our{" "}
          <Link to="/terms" className="font-semibold underline underline-offset-2">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/privacy" className="font-semibold underline underline-offset-2">
            Privacy Policy
          </Link>
          , and{" "}
          <Link to="/regulatory" className="font-semibold underline underline-offset-2">
            Regulatory Status
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocLayout>
  );
}
