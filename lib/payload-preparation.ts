import { buildBrowserLoader, buildInjectedHead, cspHash, payloadVersion } from "./helpers.ts";

// Derive the reusable Payload values once at startup from the already-loaded source text.
export function preparePayload(appCss: string, appJs: string) {
  const version = payloadVersion(appJs, appCss);
  const browserLoader = buildBrowserLoader();

  return {
    version,
    payloadJs: `const OMO_VERSION=${JSON.stringify(version)};${appJs}`,
    injectedHead: buildInjectedHead(browserLoader),
    browserLoaderHash: cspHash(browserLoader),
  };
}
