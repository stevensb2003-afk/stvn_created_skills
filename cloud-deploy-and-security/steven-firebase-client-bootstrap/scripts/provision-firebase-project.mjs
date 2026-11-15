#!/usr/bin/env node
/**
 * provision-firebase-project.mjs
 * Universal, zero-dependency CLI & REST provisioner for Google Cloud + Firebase projects.
 * Automates: GCP Project creation -> Firebase add -> Blaze billing link -> API enablement ->
 * Firestore Native -> Identity Platform Email/Password + Authorized Domains -> Cloud Storage ->
 * Web App SDK config (.env.client.<id>.example) -> reCAPTCHA Enterprise + App Check ->
 * Recycled Rules/Indexes deploy -> GitHub multi-client manifest registration.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_APIS = [
  'firebase.googleapis.com',
  'firestore.googleapis.com',
  'firebaserules.googleapis.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebaseappcheck.googleapis.com',
  'recaptchaenterprise.googleapis.com',
  'cloudfunctions.googleapis.com',
  'cloudbuild.googleapis.com',
  'run.googleapis.com',
  'artifactregistry.googleapis.com',
  'cloudscheduler.googleapis.com',
  'eventarc.googleapis.com',
  'secretmanager.googleapis.com',
  'apphosting.googleapis.com',
];

function printHelp() {
  console.log(`
provision-firebase-project.mjs — Provisionador Automático Firebase + GCP + App Check

Uso:
  node provision-firebase-project.mjs --project <PROJECT_ID> [opciones]

Opciones:
  --project <id>            ID único del proyecto GCP/Firebase (ej. crm-empresa-x) [requerido]
  --display-name <nombre>   Nombre visible del proyecto (ej. "CRM Empresa X")
  --billing-account <id>    ID cuenta de facturación (ej. 01XXXX-XXXXXX-XXXXXX). Autodetecta si se omite.
  --region <region>         Región Firestore Native (default: nam5)
  --storage-location <loc>  Ubicación bucket Storage (default: US)
  --domains <csv>           Dominios autorizados Auth + App Check (ej. "localhost,app.cliente.com")
  --dev-emails <csv>        Correos de Platform Developers para generar Claims / registro inicial
  --role <demo|client>      Rol del proyecto en el flujo GitHub (default: client)
  --manifest <path>         Ruta a deploy/clients.manifest.json para registrar automáticamente
  --deploy-rules            Despliega firestore.rules, firestore.indexes.json y storage.rules si existen
  --verify-only             Solo ejecuta sondas de lectura sin modificar infraestructura
  --dry-run                 Imprime el plan exacto de comandos y APIs sin mutar GCP (exit 0)
  --help, -h                Muestra esta ayuda
`);
}

function parseArgs(argv) {
  const opts = {
    project: '',
    displayName: '',
    billingAccount: '',
    region: 'nam5',
    storageLocation: 'US',
    domains: ['localhost', '127.0.0.1'],
    devEmails: [],
    role: 'client',
    manifest: '',
    deployRules: false,
    verifyOnly: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--deploy-rules') opts.deployRules = true;
    else if (arg === '--verify-only') opts.verifyOnly = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--project' && argv[i + 1]) opts.project = argv[++i].trim();
    else if (arg === '--display-name' && argv[i + 1]) opts.displayName = argv[++i].trim();
    else if (arg === '--billing-account' && argv[i + 1]) opts.billingAccount = argv[++i].trim();
    else if (arg === '--region' && argv[i + 1]) opts.region = argv[++i].trim();
    else if (arg === '--storage-location' && argv[i + 1]) opts.storageLocation = argv[++i].trim();
    else if (arg === '--domains' && argv[i + 1]) {
      opts.domains = Array.from(
        new Set(
          argv[++i]
            .split(',')
            .map((d) => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
            .filter(Boolean)
            .concat(['localhost', '127.0.0.1'])
        )
      );
    } else if (arg === '--dev-emails' && argv[i + 1]) {
      opts.devEmails = argv[++i]
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg === '--role' && argv[i + 1]) {
      opts.role = argv[++i].trim() === 'demo' ? 'demo' : 'client';
    } else if (arg === '--manifest' && argv[i + 1]) {
      opts.manifest = argv[++i].trim();
    }
  }

  if (!opts.displayName && opts.project) {
    opts.displayName = opts.project;
  }
  return opts;
}

function runCmd(cmd, args, { allowFail = false, capture = true } = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (res.status !== 0 && !allowFail) {
    const errMsg = (res.stderr || res.stdout || `Exit code ${res.status}`).trim();
    throw new Error(`Comando falló (${cmd} ${args.join(' ')}): ${errMsg}`);
  }
  return {
    ok: res.status === 0,
    stdout: (res.stdout || '').trim(),
    stderr: (res.stderr || '').trim(),
    status: res.status ?? 1,
  };
}

function getAccessToken() {
  const res = runCmd('gcloud', ['auth', 'print-access-token']);
  return res.stdout;
}

async function gcpFetch(url, token, { method = 'GET', body, quotaProject } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (quotaProject) {
    headers['x-goog-user-project'] = quotaProject;
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, data: json, raw: text };
}

async function pollOperation(opName, token, baseUrl = 'https://firebase.googleapis.com/v1beta1', timeoutMs = 90_000) {
  const start = Date.now();
  const opUrl = opName.startsWith('http') ? opName : `${baseUrl}/${opName.replace(/^\//, '')}`;
  while (Date.now() - start < timeoutMs) {
    const res = await gcpFetch(opUrl, token);
    if (res.ok && res.data?.done) {
      if (res.data.error) {
        throw new Error(`Operación LRO falló: ${JSON.stringify(res.data.error)}`);
      }
      return res.data.response || res.data;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`Timeout esperando operación LRO: ${opName}`);
}

function updateClientManifest(manifestPath, opts) {
  const absPath = path.resolve(process.cwd(), manifestPath);
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });

  let manifest = {
    schemaVersion: 1,
    demoProject: { projectId: '', domain: '', hostingType: 'apphosting' },
    clients: [],
  };

  if (fs.existsSync(absPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      if (!Array.isArray(manifest.clients)) manifest.clients = [];
    } catch {
      // Keep default structure if invalid
    }
  }

  const primaryDomain = opts.domains.find((d) => d !== 'localhost' && d !== '127.0.0.1') || `${opts.project}.web.app`;
  if (opts.role === 'demo') {
    manifest.demoProject = {
      projectId: opts.project,
      displayName: opts.displayName,
      domain: primaryDomain,
      hostingType: fs.existsSync(path.resolve(process.cwd(), 'apphosting.yaml')) ? 'apphosting' : 'hosting',
      updatedAt: new Date().toISOString(),
    };
  } else {
    const idx = manifest.clients.findIndex((c) => c.projectId === opts.project);
    const entry = {
      clientId: opts.project,
      displayName: opts.displayName,
      projectId: opts.project,
      domain: primaryDomain,
      hostingType: fs.existsSync(path.resolve(process.cwd(), 'apphosting.yaml')) ? 'apphosting' : 'hosting',
      rolloutRing: 'stable',
      active: true,
      registeredAt: idx >= 0 ? manifest.clients[idx].registeredAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) manifest.clients[idx] = entry;
    else manifest.clients.push(entry);
  }

  fs.writeFileSync(absPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return absPath;
}

function writePublicEnvExample(projectId, sdkConfig) {
  const envFile = path.resolve(process.cwd(), `.env.client.${projectId}.example`);
  const content = [
    `# Variables PÚBLICAS del Web SDK para ${projectId} (seguro para cliente navegador)`,
    `NEXT_PUBLIC_FIREBASE_API_KEY=${sdkConfig.apiKey || ''}`,
    `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${sdkConfig.authDomain || `${projectId}.firebaseapp.com`}`,
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${sdkConfig.projectId || projectId}`,
    `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${sdkConfig.storageBucket || `${projectId}.firebasestorage.app`}`,
    `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${sdkConfig.messagingSenderId || ''}`,
    `NEXT_PUBLIC_FIREBASE_APP_ID=${sdkConfig.appId || ''}`,
    sdkConfig.recaptchaSiteKey ? `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=${sdkConfig.recaptchaSiteKey}` : '# NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=',
    '',
  ].join('\n');
  fs.writeFileSync(envFile, content, 'utf8');
  return envFile;
}

async function executeDryRun(opts) {
  const plan = {
    mode: 'dry-run',
    projectId: opts.project,
    displayName: opts.displayName,
    role: opts.role,
    region: opts.region,
    storageLocation: opts.storageLocation,
    authorizedDomains: opts.domains,
    devEmails: opts.devEmails,
    steps: [
      `1. Verificar/crear proyecto GCP: gcloud projects create ${opts.project} --name="${opts.displayName}"`,
      `2. Vincular Billing Account (Blaze): gcloud billing projects link ${opts.project} --billing-account=${opts.billingAccount || '<AUTO_DETECTED_OPEN_BILLING>'}`,
      `3. Añadir Firebase: POST https://firebase.googleapis.com/v1beta1/projects/${opts.project}:addFirebase`,
      `4. Habilitar ${REQUIRED_APIS.length} APIs GCP: ${REQUIRED_APIS.join(', ')}`,
      `5. Crear Firestore Native: gcloud firestore databases create --database="(default)" --location=${opts.region} --type=firestore-native --project=${opts.project}`,
      `6. Inicializar Auth + Email/Password + Dominios (${opts.domains.join(', ')}) vía Identity Toolkit Admin API`,
      `7. Provisionar Bucket Default Storage (${opts.storageLocation}) vía Firebase Storage API / gcloud`,
      `8. Registrar Web App SDK y exportar .env.client.${opts.project}.example`,
      `9. Crear clave reCAPTCHA Enterprise Score y vincular Firebase App Check`,
      opts.deployRules
        ? `10. Desplegar firestore.rules, firestore.indexes.json y storage.rules con --project ${opts.project}`
        : '10. (--deploy-rules omitido) Saltando despliegue inicial de reglas',
    ],
  };
  console.log(JSON.stringify(plan, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }
  if (!opts.project) {
    console.error('Error: --project <PROJECT_ID> es obligatorio. Usa --help para ver opciones.');
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(opts.project)) {
    console.error(`Error: PROJECT_ID "${opts.project}" inválido. Debe tener 6-30 caracteres en minúscula, números o guiones.`);
    process.exit(1);
  }

  if (opts.dryRun) {
    await executeDryRun(opts);
    process.exit(0);
  }

  const report = {
    projectId: opts.project,
    role: opts.role,
    steps: {},
    manualChecklist: [],
    sdkConfig: null,
  };

  // Pre-check gcloud CLI availability
  const gcloudCheck = runCmd('gcloud', ['--version'], { allowFail: true });
  if (!gcloudCheck.ok) {
    throw new Error('gcloud CLI no está instalado o no está en PATH. Instala Google Cloud SDK y ejecuta: gcloud auth login');
  }

  const token = getAccessToken();

  // 1. GCP Project
  const projDescribe = runCmd('gcloud', ['projects', 'describe', opts.project, '--format=json'], { allowFail: true });
  if (projDescribe.ok) {
    report.steps.gcpProject = 'exists';
  } else if (opts.verifyOnly) {
    report.steps.gcpProject = 'missing';
  } else {
    runCmd('gcloud', ['projects', 'create', opts.project, `--name=${opts.displayName}`]);
    report.steps.gcpProject = 'created';
  }

  // 2. Billing / Blaze
  const billingDesc = runCmd('gcloud', ['billing', 'projects', 'describe', opts.project, '--format=json'], { allowFail: true });
  let billingEnabled = false;
  if (billingDesc.ok && billingDesc.stdout) {
    try {
      billingEnabled = Boolean(JSON.parse(billingDesc.stdout).billingEnabled);
    } catch {
      billingEnabled = false;
    }
  }
  if (!billingEnabled && !opts.verifyOnly) {
    let billingId = opts.billingAccount;
    if (!billingId) {
      const accountsRes = runCmd('gcloud', ['billing', 'accounts', 'list', '--filter=open=true', '--format=json'], { allowFail: true });
      if (accountsRes.ok && accountsRes.stdout) {
        const accounts = JSON.parse(accountsRes.stdout);
        if (accounts.length > 0) {
          billingId = accounts[0].name.replace('billingAccounts/', '');
        }
      }
    }
    if (!billingId) {
      throw new Error('No se encontró cuenta de facturación abierta. Pasa --billing-account=<ID> o vincula Blaze en consola.');
    }
    runCmd('gcloud', ['billing', 'projects', 'link', opts.project, `--billing-account=${billingId}`]);
    billingEnabled = true;
    report.steps.blazeBilling = `linked:${billingId}`;
  } else {
    report.steps.blazeBilling = billingEnabled ? 'active' : 'inactive';
  }

  // 3. Add Firebase to GCP project
  const fbCheck = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}`, token);
  if (fbCheck.ok) {
    report.steps.firebaseProject = 'active';
  } else if (opts.verifyOnly) {
    report.steps.firebaseProject = 'missing';
  } else {
    const addFb = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}:addFirebase`, token, { method: 'POST' });
    if (!addFb.ok) {
      throw new Error(`No se pudo agregar Firebase al proyecto (${addFb.status}): ${addFb.raw}`);
    }
    if (addFb.data?.name && !addFb.data?.done) {
      await pollOperation(addFb.data.name, token);
    }
    report.steps.firebaseProject = 'added';
  }

  // 4. Enable APIs
  if (!opts.verifyOnly) {
    runCmd('gcloud', ['services', 'enable', ...REQUIRED_APIS, `--project=${opts.project}`]);
    report.steps.apisEnabled = REQUIRED_APIS.length;
  }

  // 5. Firestore Native
  const fsDesc = runCmd('gcloud', ['firestore', 'databases', 'describe', '--database=(default)', `--project=${opts.project}`, '--format=json'], { allowFail: true });
  if (fsDesc.ok && fsDesc.stdout) {
    const fsData = JSON.parse(fsDesc.stdout);
    if (fsData.type !== 'FIRESTORE_NATIVE') {
      throw new Error(`BLOQUEO: La base (default) está en modo ${fsData.type}, se requiere FIRESTORE_NATIVE.`);
    }
    report.steps.firestoreNative = `active:${fsData.locationId || opts.region}`;
  } else if (opts.verifyOnly) {
    report.steps.firestoreNative = 'missing';
  } else {
    runCmd('gcloud', [
      'firestore',
      'databases',
      'create',
      '--database=(default)',
      `--location=${opts.region}`,
      '--type=firestore-native',
      `--project=${opts.project}`,
    ]);
    report.steps.firestoreNative = `created:${opts.region}`;
  }

  // 6. Identity Toolkit (Auth Email/Password + Authorized Domains)
  if (!opts.verifyOnly) {
    await gcpFetch(
      `https://identitytoolkit.googleapis.com/v2/projects/${opts.project}/identityPlatform:initializeAuth`,
      token,
      { method: 'POST', body: {}, quotaProject: opts.project }
    );
    const currentCfg = await gcpFetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${opts.project}/config`,
      token,
      { quotaProject: opts.project }
    );
    const existingDomains = Array.isArray(currentCfg.data?.authorizedDomains) ? currentCfg.data.authorizedDomains : [];
    const mergedDomains = Array.from(
      new Set([...existingDomains, `${opts.project}.firebaseapp.com`, `${opts.project}.web.app`, ...opts.domains])
    );
    const patchAuth = await gcpFetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${opts.project}/config?updateMask=signIn.email,authorizedDomains`,
      token,
      {
        method: 'PATCH',
        quotaProject: opts.project,
        body: {
          signIn: { email: { enabled: true, passwordRequired: true } },
          authorizedDomains: mergedDomains,
        },
      }
    );
    report.steps.firebaseAuth = patchAuth.ok ? 'email_password_and_domains_active' : `warning:${patchAuth.status}`;
  }

  // 7. Default Storage Bucket
  const bucketCandidates = [`${opts.project}.firebasestorage.app`, `${opts.project}.appspot.com`];
  let activeBucket = '';
  for (const b of bucketCandidates) {
    const bCheck = runCmd('gcloud', ['storage', 'buckets', 'describe', `gs://${b}`, '--format=json'], { allowFail: true });
    if (bCheck.ok) {
      activeBucket = b;
      break;
    }
  }
  if (!activeBucket && !opts.verifyOnly) {
    const targetBucket = `${opts.project}.firebasestorage.app`;
    const mkBucket = runCmd(
      'gcloud',
      ['storage', 'buckets', 'create', `gs://${targetBucket}`, `--project=${opts.project}`, `--location=${opts.storageLocation}`, '--uniform-bucket-level-access'],
      { allowFail: true }
    );
    const linkDefault = await gcpFetch(
      `https://firebasestorage.googleapis.com/v1beta/projects/${opts.project}/defaultBucket`,
      token,
      { method: 'POST', body: { location: opts.storageLocation }, quotaProject: opts.project }
    );
    if (linkDefault.ok || mkBucket.ok) {
      activeBucket = linkDefault.data?.bucket?.name?.split('/').pop() || targetBucket;
      report.steps.cloudStorage = `provisioned:${activeBucket}`;
    } else {
      report.steps.cloudStorage = `manual_check_needed:${linkDefault.status}`;
      report.manualChecklist.push(`Abrir https://console.firebase.google.com/project/${opts.project}/storage y confirmar inicialización del bucket.`);
    }
  } else {
    report.steps.cloudStorage = activeBucket ? `active:${activeBucket}` : 'missing';
  }

  // 8. Web App SDK Config
  const appsList = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}/webApps`, token);
  let webApp = Array.isArray(appsList.data?.apps) && appsList.data.apps.length > 0 ? appsList.data.apps[0] : null;
  if (!webApp && !opts.verifyOnly) {
    const createApp = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}/webApps`, token, {
      method: 'POST',
      body: { displayName: `${opts.displayName} Web` },
    });
    if (createApp.ok && createApp.data?.name) {
      webApp = await pollOperation(createApp.data.name, token);
    }
  }
  if (webApp?.appId) {
    const cfgRes = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}/webApps/${webApp.appId}/config`, token);
    if (cfgRes.ok) {
      report.sdkConfig = cfgRes.data;
      report.steps.webAppSdk = `ready:${webApp.appId}`;
    }
  } else {
    report.steps.webAppSdk = opts.verifyOnly ? 'missing' : 'failed_to_create';
  }

  // 9. reCAPTCHA Enterprise + Firebase App Check
  if (!opts.verifyOnly && webApp?.appId) {
    const recaptchaList = runCmd('gcloud', ['recaptcha', 'keys', 'list', `--project=${opts.project}`, '--format=json'], { allowFail: true });
    let siteKey = '';
    if (recaptchaList.ok && recaptchaList.stdout) {
      const keys = JSON.parse(recaptchaList.stdout);
      const found = keys.find((k) => k.webSettings);
      if (found) siteKey = found.name.split('/').pop();
    }
    if (!siteKey) {
      const createKey = runCmd(
        'gcloud',
        [
          'recaptcha',
          'keys',
          'create',
          `--display-name=App Check ${opts.project}`,
          '--web',
          `--domains=${opts.domains.join(',')}`,
          '--integration-type=score',
          `--project=${opts.project}`,
          '--format=json',
        ],
        { allowFail: true }
      );
      if (createKey.ok && createKey.stdout) {
        const parsed = JSON.parse(createKey.stdout);
        siteKey = parsed.name?.split('/').pop() || '';
      }
    }
    if (siteKey) {
      const bindAppCheck = await gcpFetch(
        `https://firebaseappcheck.googleapis.com/v1/projects/${opts.project}/apps/${webApp.appId}/recaptchaEnterpriseConfig?updateMask=siteKey,tokenTtl`,
        token,
        {
          method: 'PATCH',
          quotaProject: opts.project,
          body: { siteKey, tokenTtl: '3600s' },
        }
      );
      report.steps.appCheck = bindAppCheck.ok ? `bound:${siteKey}` : `warning:${bindAppCheck.status}`;
      if (report.sdkConfig) report.sdkConfig.recaptchaSiteKey = siteKey;
    } else {
      report.steps.appCheck = 'manual_needed';
      report.manualChecklist.push(`Configurar App Check reCAPTCHA Enterprise en https://console.firebase.google.com/project/${opts.project}/appcheck`);
    }
  }

  if (report.sdkConfig && !opts.verifyOnly) {
    report.envExampleFile = writePublicEnvExample(opts.project, report.sdkConfig);
  }

  // 10. Deploy recycled rules & indexes + update manifest
  if (opts.deployRules && !opts.verifyOnly) {
    const targets = [];
    if (fs.existsSync(path.resolve(process.cwd(), 'firestore.rules'))) targets.push('firestore:rules');
    if (fs.existsSync(path.resolve(process.cwd(), 'firestore.indexes.json'))) targets.push('firestore:indexes');
    if (fs.existsSync(path.resolve(process.cwd(), 'storage.rules'))) targets.push('storage');
    if (targets.length > 0) {
      runCmd('npx', ['firebase-tools', 'deploy', '--only', targets.join(','), '--project', opts.project]);
      report.steps.rulesDeployed = targets;
    } else {
      report.steps.rulesDeployed = 'skipped_no_rule_files_in_cwd';
    }
  }

  if (opts.manifest && !opts.verifyOnly) {
    report.manifestUpdated = updateClientManifest(opts.manifest, opts);
  }

  if (!opts.verifyOnly) {
    report.manualChecklist.push(
      `Si usarás Google Sign-In externo, configurar pantalla OAuth en https://console.cloud.google.com/apis/credentials/consent?project=${opts.project}`,
      `Conectar dominio personalizado y registros DNS (A / TXT) en Firebase Hosting / App Hosting para ${opts.domains.find((d) => d !== 'localhost' && d !== '127.0.0.1') || '<tu-dominio.com>'}`
    );
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('ERROR EN PROVISIONAMIENTO:', err.message);
  process.exit(1);
});
