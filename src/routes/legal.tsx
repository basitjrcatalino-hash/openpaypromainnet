import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDocLayout, LegalSection } from "@/components/legal-doc-layout";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Software License — OpenPay Pro" },
      {
        name: "description",
        content:
          "Software License for OpenPay Pro and derivative works developed for use on Pi Network. Copyright © 2025 MRWAIN ORGANIZATION.",
      },
      { property: "og:title", content: "Software License — OpenPay Pro" },
      {
        property: "og:description",
        content:
          "Software License governing use and derivative works for Pi Network applications. Copyright © 2025 MRWAIN ORGANIZATION.",
      },
      { property: "og:url", content: "https://openpaypro.space/legal" },
    ],
    links: [{ rel: "canonical", href: "https://openpaypro.space/legal" }],
  }),
  component: LegalLicensePage,
});

const LICENSE_SPEECH = `
Software License. Copyright 2025 MRWAIN ORGANIZATION.

Permission is hereby granted by the application software developer, free of charge, to any person obtaining a copy of this application, software and associated documentation files, which was developed by the Software Developer for use on Pi Network, whereby the purpose of this license is to permit the development of derivative works based on the Software, including the right to use, copy, modify, merge, publish, distribute, sub-license, and/or sell copies of such derivative works and any Software components incorporated therein, and to permit persons to whom such derivative works are furnished to do so, in each case, solely to develop, use and market applications for the official Pi Network.

For purposes of this license, Pi Network shall mean any application, software, or other present or future platform developed, owned or managed by Pi Community Company, and its parents, affiliates or subsidiaries, for which the Software was developed, or on which the Software continues to operate. However, you are prohibited from using any portion of the Software or any derivative works thereof in any manner which infringes on any Pi Network intellectual property rights, to hack any of Pi Network's systems or processes, or to develop any product or service which is competitive with the Pi Network.

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, PUBLISHERS, OR COPYRIGHT HOLDERS OF THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Pi, Pi Network and the Pi logo are trademarks of the Pi Community Company.

Copyright 2025 MRWAIN ORGANIZATION.
`.trim();

const TOC = [
  { id: "grant", label: "Grant of license" },
  { id: "pi-network", label: "Pi Network definition" },
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
      dek="Permission to build derivative works for the official Pi Network — with the limits, notices, and disclaimers that protect Pi Network and MRWAIN ORGANIZATION."
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
          on Pi Network, whereby the purpose of this license is to permit the development of
          derivative works based on the Software, including the right to use, copy, modify, merge,
          publish, distribute, sub-license, and/or sell copies of such derivative works and any
          Software components incorporated therein, and to permit persons to whom such derivative
          works are furnished to do so, in each case, solely to develop, use and market applications
          for the official Pi Network.
        </p>
      </LegalSection>

      <LegalSection id="pi-network" heading="2. Pi Network definition">
        <p>
          For purposes of this license, Pi Network shall mean any application, software, or other
          present or future platform developed, owned or managed by Pi Community Company, and its
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
            "which infringes on any Pi Network intellectual property rights,",
            "to hack any of Pi Network’s systems or processes, or",
            "to develop any product or service which is competitive with the Pi Network.",
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
          Pi, Pi Network and the Pi logo are trademarks of the Pi Community Company.
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
