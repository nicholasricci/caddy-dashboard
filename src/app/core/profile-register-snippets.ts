import {
  exampleDomainProfileCurl,
  exampleUpstreamProfileCurl
} from './profile-help.copy';

export type ProfileRegisterKind = 'upstream' | 'domain';

export type ProfileSnippetLanguage =
  | 'shell'
  | 'python'
  | 'javascript'
  | 'go'
  | 'php_laravel'
  | 'php_symfony';

export interface ProfileSnippetContext {
  baseUrl: string;
  profileId: string;
  apiKey?: string;
}

export const PROFILE_SNIPPET_PLACEHOLDER_KEY = 'cdk_live_…';

export const PROFILE_SNIPPET_LANGUAGES: readonly {
  id: ProfileSnippetLanguage;
  label: string;
}[] = [
  { id: 'shell', label: 'Shell' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'go', label: 'Go' },
  { id: 'php_laravel', label: 'PHP (Laravel)' },
  { id: 'php_symfony', label: 'PHP (Symfony)' }
];

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function resolveApiKey(ctx: ProfileSnippetContext): string {
  return ctx.apiKey?.trim() || PROFILE_SNIPPET_PLACEHOLDER_KEY;
}

function registerUrl(kind: ProfileRegisterKind, baseUrl: string, profileId: string): string {
  const base = normalizeApiBase(baseUrl);
  const segment = kind === 'upstream' ? 'upstream-profiles' : 'domain-profiles';
  return `${base}/${segment}/${profileId}/register`;
}

function escapeSingleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeDoubleQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function upstreamShell(ctx: ProfileSnippetContext, key: string): string {
  return exampleUpstreamProfileCurl(ctx.baseUrl, ctx.profileId, key);
}

function domainShell(ctx: ProfileSnippetContext, key: string): string {
  return exampleDomainProfileCurl(ctx.baseUrl, ctx.profileId, key);
}

function upstreamPython(url: string, key: string): string {
  const safeKey = escapeDoubleQuoted(key);
  return `import json
import urllib.request

url = "${url}"
payload = json.dumps({"private_ip": "10.0.0.42"}).encode()
request = urllib.request.Request(
    url,
    data=payload,
    headers={
        "Authorization": "${safeKey}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(request) as response:
    print(response.read().decode())`;
}

function domainPython(url: string, key: string): string {
  const safeKey = escapeDoubleQuoted(key);
  return `import json
import urllib.request

url = "${url}"
payload = json.dumps({"domains": ["acme.example.com"]}).encode()
request = urllib.request.Request(
    url,
    data=payload,
    headers={
        "Authorization": "${safeKey}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(request) as response:
    print(response.read().decode())`;
}

function upstreamJavaScript(url: string, key: string): string {
  const safeKey = escapeSingleQuoted(key);
  return `const response = await fetch('${url}', {
  method: 'POST',
  headers: {
    Authorization: '${safeKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ private_ip: '10.0.0.42' }),
});

console.log(await response.json());`;
}

function domainJavaScript(url: string, key: string): string {
  const safeKey = escapeSingleQuoted(key);
  return `const response = await fetch('${url}', {
  method: 'POST',
  headers: {
    Authorization: '${safeKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ domains: ['acme.example.com'] }),
});

console.log(await response.json());`;
}

function upstreamGo(url: string, key: string): string {
  const safeKey = escapeDoubleQuoted(key);
  return `package main

import (
\t"bytes"
\t"fmt"
\t"io"
\t"net/http"
)

func main() {
\tbody := []byte(\`{"private_ip":"10.0.0.42"}\`)
\treq, err := http.NewRequest(http.MethodPost, "${url}", bytes.NewReader(body))
\tif err != nil {
\t\tpanic(err)
\t}
\treq.Header.Set("Authorization", "${safeKey}")
\treq.Header.Set("Content-Type", "application/json")

\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()
\tout, _ := io.ReadAll(res.Body)
\tfmt.Println(string(out))
}`;
}

function domainGo(url: string, key: string): string {
  const safeKey = escapeDoubleQuoted(key);
  return `package main

import (
\t"bytes"
\t"fmt"
\t"io"
\t"net/http"
)

func main() {
\tbody := []byte(\`{"domains":["acme.example.com"]}\`)
\treq, err := http.NewRequest(http.MethodPost, "${url}", bytes.NewReader(body))
\tif err != nil {
\t\tpanic(err)
\t}
\treq.Header.Set("Authorization", "${safeKey}")
\treq.Header.Set("Content-Type", "application/json")

\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()
\tout, _ := io.ReadAll(res.Body)
\tfmt.Println(string(out))
}`;
}

function upstreamPhpLaravel(url: string, key: string): string {
  const safeKey = escapeSingleQuoted(key);
  return `<?php

use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'Authorization' => '${safeKey}',
])->post('${url}', [
    'private_ip' => '10.0.0.42',
]);

$response->throw();
$response->json();`;
}

function domainPhpLaravel(url: string, key: string): string {
  const safeKey = escapeSingleQuoted(key);
  return `<?php

use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'Authorization' => '${safeKey}',
])->post('${url}', [
    'domains' => ['acme.example.com'],
]);

$response->throw();
$response->json();`;
}

function upstreamPhpSymfony(url: string, key: string): string {
  const safeKey = escapeSingleQuoted(key);
  return `<?php

use Symfony\\Component\\HttpClient\\HttpClient;

$client = HttpClient::create();
$response = $client->request('POST', '${url}', [
    'headers' => [
        'Authorization' => '${safeKey}',
        'Content-Type' => 'application/json',
    ],
    'json' => [
        'private_ip' => '10.0.0.42',
    ],
]);

$response->getContent();`;
}

function domainPhpSymfony(url: string, key: string): string {
  const safeKey = escapeSingleQuoted(key);
  return `<?php

use Symfony\\Component\\HttpClient\\HttpClient;

$client = HttpClient::create();
$response = $client->request('POST', '${url}', [
    'headers' => [
        'Authorization' => '${safeKey}',
        'Content-Type' => 'application/json',
    ],
    'json' => [
        'domains' => ['acme.example.com'],
    ],
]);

$response->getContent();`;
}

export function profileRegisterSnippet(
  kind: ProfileRegisterKind,
  language: ProfileSnippetLanguage,
  ctx: ProfileSnippetContext
): string {
  const key = resolveApiKey(ctx);
  const url = registerUrl(kind, ctx.baseUrl, ctx.profileId);

  if (language === 'shell') {
    return kind === 'upstream' ? upstreamShell(ctx, key) : domainShell(ctx, key);
  }
  if (language === 'python') {
    return kind === 'upstream' ? upstreamPython(url, key) : domainPython(url, key);
  }
  if (language === 'javascript') {
    return kind === 'upstream' ? upstreamJavaScript(url, key) : domainJavaScript(url, key);
  }
  if (language === 'go') {
    return kind === 'upstream' ? upstreamGo(url, key) : domainGo(url, key);
  }
  if (language === 'php_laravel') {
    return kind === 'upstream' ? upstreamPhpLaravel(url, key) : domainPhpLaravel(url, key);
  }
  return kind === 'upstream' ? upstreamPhpSymfony(url, key) : domainPhpSymfony(url, key);
}
