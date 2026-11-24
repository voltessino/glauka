# Glauka Free and Pro

Product decision, 29 October 2026: one application, Free for every local tool;
Pro for every AI feature, using the customer's own provider and API key.
There is no Ultra tier and no price or subscription term has been decided.

Free includes creating/editing all supported structures and views, manual images,
icons and illustrations, formulas, text formatting, search, import/export,
opening/saving projects, backups and offline study. A plan change never removes,
truncates or encrypts a customer's existing documents. Provider-assisted generation,
explanations, expansion, illustration suggestions, transcription and AI study
questions require Pro. Provider billing is separate from Glauka's license.

## Signed activation

`GLK1.payload.signature` is a signed JSON grant (ECDSA P-256 / SHA-256, ASN.1 DER
signature). The issuer signs the complete `GLK1.payload` string. Version, audience,
kind, identifier, issue time and expiry are checked natively in Go and Java.
Only public verification keys belong in source and application packages.
A license works offline until its explicit expiry; provider requests still require
whatever network access the selected provider needs. Licensing does not relay API
keys or prompts through a Glauka server. Native provider allowlists, response size
limits, timeouts and cancellation still apply.

Public builds accept signed Pro grants and start Free without one. Private desktop
`--developer` and Android debug builds also trust the separate owner issuer.
Neither build auto-grants Pro; the old shared test password is no longer used.
After owner activation, the license panel offers Full access, Free and Pro previews.
The mode is persisted and enforced natively; a WebView/localStorage flag cannot
unlock AI. Public desktop excludes the owner verification key through build tags;
Android release sets its owner key to an empty value.

Issuer utility: `scripts/licensing/issue.py` requires Python `cryptography`.
Keep its issuer directory OUTSIDE Git, backups of projects, website ZIPs and release
artifacts. Back up the issuer private keys securely: losing them prevents issuing
new grants for the public keys already compiled into clients. Never regenerate an
issuer silently for an existing product release. Owner activation tokens are private
and must be delivered separately from installers. `license-v1.json` in Go/Java tests
contains signatures from an unrelated disposable fixture issuer, not a real license.

## Public distribution remaining work

The source implements the chosen product boundary, not a deployed checkout.
Before public downloads: decide pricing and terms, connect purchase/delivery to
signed Pro issuance, establish publisher support/legal details, and provision
actual publisher signing identities. The Windows builder supports Authenticode;
Android release requires `GLAUKA_RELEASE_*` signing credentials. Never relabel debug
APK / Developer EXE as a public signed release. The preview Android application ID
and debug signer are retained for updates without deleting existing local projects.

A complete current Mac DMG requires a Mac host with Swift/AppKit and the native
shell rebuilt from current sources, plus Developer ID and notarization for public
distribution. Cross-compiled Go backends are not a complete Mac application.
Verify native installation, upgrade, file dialogs, clipboard, provider connection,
restore/export and plan activation on actual target systems before publication.
The website release links remain disabled until approved public packages exist.
