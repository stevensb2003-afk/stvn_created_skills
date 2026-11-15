#!/usr/bin/env node
/**
 * provision-firebase-crm.mjs
 * Self-contained Automated Firebase + GCP + App Check + CRM Day-0 Provisioner.
 * Tailored for steven-waba-dualhook-connection (Standalone or Multi-Client 2-branch demo -> main).
 */

import { spawnSync } from 'node:child_process';
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
provision-firebase-crm.mjs — Provisionador Automático CRM + Firebase + App Check

Uso:
  node scripts/provision-firebase-crm.mjs --project <PROJECT_ID> [opciones]

Opciones:
  --project <id>            ID único del proyecto Firebase/GCP [requerido]
  --display-name <nombre>   Nombre comercial / empresa (default: PROJECT_ID)
  --billing-account <id>    ID Billing Account Blaze (autodetecta cuenta abierta si se omite)
  --region <region>         Región Firestore Native (default: nam5)
  --storage-location <loc>  Ubicación Storage (default: US)
  --domains <csv>           Dominios autorizados Auth + App Check (ej. "localhost,crm.empresa.com")
  --dev-emails <csv>        Correos de Platform Developers para Custom Claim platformDev:true
  --role <demo|client>      Tipo de entorno en manifest (default: client)
  --manifest <path>         Ruta manifest GitHub (default: deploy/clients.manifest.json si existe o indicado)
  --deploy-rules            Despliega firestore.rules, storage.rules y firestore.indexes.json recicladas
  --seed                    Siembra crm_settings/branding, announcements, tenant_license y config/app_version vía REST
  --verify-only             Ejecuta sondas de diagnóstico sin modificar recursos
  --dry-run                 Imprime plan detallado de ejecución sin mutar GCP (exit 0)
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
    seed: false,
    verifyOnly: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--deploy-rules') opts.deployRules = true;
    else if (a === '--seed') opts.seed = true;
    else if (a === '--verify-only') opts.verifyOnly = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--project' && argv[i + 1]) opts.project = argv[++i].trim();
    else if (a === '--display-name' && argv[i + 1]) opts.displayName = argv[++i].trim();
    else if (a === '--billing-account' && argv[i + 1]) opts.billingAccount = argv[++i].trim();
    else if (a === '--region' && argv[i + 1]) opts.region = argv[++i].trim();
    else if (a === '--storage-location' && argv[i + 1]) opts.storageLocation = argv[++i].trim();
    else if (a === '--domains' && argv[i + 1]) {
      opts.domains = Array.from(
        new Set(
          argv[++i]
            .split(',')
            .map((d) => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
            .filter(Boolean)
            .concat(['localhost', '127.0.0.1'])
        )
      );
    } else if (a === '--dev-emails' && argv[i + 1]) {
      opts.devEmails = argv[++i]
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    } else if (a === '--role' && argv[i + 1]) {
      opts.role = argv[++i].trim() === 'demo' ? 'demo' : 'client';
    } else if (a === '--manifest' && argv[i + 1]) {
      opts.manifest = argv[++i].trim();
    }
  }
  if (!opts.displayName && opts.project) opts.displayName = opts.project;
  return opts;
}

function runCmd(cmd, args, { allowFail = false } = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`Fallo comando (${cmd} ${args.join(' ')}): ${(res.stderr || res.stdout).trim()}`);
  }
  return {
    ok: res.status === 0,
    stdout: (res.stdout || '').trim(),
    stderr: (res.stderr || '').trim(),
  };
}

async function gcpFetch(url, token, { method = 'GET', body, quotaProject } = {}) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (quotaProject) headers['x-goog-user-project'] = quotaProject;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  return { ok: res.ok, status: res.status, data, raw };
}

async function pollOperation(opName, token, timeoutMs = 90_000) {
  const start = Date.now();
  const url = opName.startsWith('http') ? opName : `https://firebase.googleapis.com/v1beta1/${opName.replace(/^\//, '')}`;
  while (Date.now() - start < timeoutMs) {
    const r = await gcpFetch(url, token);
    if (r.ok && r.data?.done) {
      if (r.data.error) throw new Error(`LRO error: ${JSON.stringify(r.data.error)}`);
      return r.data.response || r.data;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timeout en operación LRO: ${opName}`);
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) fields[k] = { nullValue: null };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map((x) => toFirestoreFields({ v: x }).v) } };
    else if (typeof v === 'object') fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
  }
  return fields;
}

async function seedCrmDefaultsRest(projectId, displayName, token) {
  const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const docs = [
    {
      path: 'crm_settings/branding',
      data: {
        businessName: displayName,
        paletteId: 'sky-slate',
        logoUrl: '',
        faviconUrl: '',
        radius: '0.65rem',
      },
    },
    {
      path: 'crm_settings/announcements',
      data: {
        id: 'welcome-v5',
        active: false,
        severity: 'release',
        title: 'Actualización de Plataforma',
        message: 'CRM listo para operar.',
        audience: 'all',
        dismissible: true,
      },
    },
    {
      path: 'crm_system/tenant_license',
      data: {
        planTier: 'pro',
        subscriptionStatus: 'active',
        maxSeats: 15,
        enabledModules: {
          core: true, whatsapp: true, meta_social: true, ai_agent: true,
          pos: true, hacienda_cr: true, scheduling: true,
          catalog_master: true, web_catalog: false, pricing_approvals: false,
          b2b_wholesale_portal: false, web_leads: true, cash_reconciliation: false,
          analytics_pro: true, help_copilot: true,
        },
      },
    },
    {
      path: 'config/app_version',
      data: {
        version: '1.0.0',
        releaseSummary: 'Despliegue inaugural CRM v5.0',
      },
    },
  ];

  const results = {};
  for (const d of docs) {
    const res = await gcpFetch(`${baseDocUrl}/${d.path}`, token, {
      method: 'PATCH',
      quotaProject: projectId,
      body: { fields: toFirestoreFields(d.data) },
    });
    results[d.path] = res.ok ? 'seeded' : `warn:${res.status}`;
  }
  return results;
}

function updateManifest(manifestPath, opts) {
  const abs = path.resolve(process.cwd(), manifestPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  let data = { schemaVersion: 1, demoProject: {}, clients: [] };
  if (fs.existsSync(abs)) {
    try {
      data = JSON.parse(fs.readFileSync(abs, 'utf8'));
      if (!Array.isArray(data.clients)) data.clients = [];
    } catch {
      // keep default
    }
  }
  const domain = opts.domains.find((d) => d !== 'localhost' && d !== '127.0.0.1') || `${opts.project}.web.app`;
  const hostingType = fs.existsSync(path.resolve(process.cwd(), 'apphosting.yaml')) ? 'apphosting' : 'hosting';
  if (opts.role === 'demo') {
    data.demoProject = { projectId: opts.project, displayName: opts.displayName, domain, hostingType };
  } else {
    const idx = data.clients.findIndex((c) => c.projectId === opts.project);
    const entry = {
      clientId: opts.project,
      displayName: opts.displayName,
      projectId: opts.project,
      domain,
      hostingType,
      rolloutRing: 'stable',
      active: true,
    };
    if (idx >= 0) data.clients[idx] = entry;
    else data.clients.push(entry);
  }
  fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return abs;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }
  if (!opts.project) {
    console.error('Error: --project <PROJECT_ID> es obligatorio.');
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(opts.project)) {
    console.error(`PROJECT_ID inválido: ${opts.project}`);
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          projectId: opts.project,
          displayName: opts.displayName,
          role: opts.role,
          region: opts.region,
          storageLocation: opts.storageLocation,
          domains: opts.domains,
          devEmails: opts.devEmails,
          apisCount: REQUIRED_APIS.length,
          willSeedCrmDocs: opts.seed,
          willDeployRules: opts.deployRules,
          manifestTarget: opts.manifest || 'none',
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const gcloudOk = runCmd('gcloud', ['--version'], { allowFail: true }).ok;
  if (!gcloudOk) {
    throw new Error('gcloud CLI no disponible. Instala Google Cloud SDK y ejecuta: gcloud auth login');
  }

  const token = runCmd('gcloud', ['auth', 'print-access-token']).stdout;
  const report = { projectId: opts.project, role: opts.role, steps: {}, manualChecklist: [] };

  // 1. GCP Project
  const pDesc = runCmd('gcloud', ['projects', 'describe', opts.project, '--format=json'], { allowFail: true });
  if (!pDesc.ok && !opts.verifyOnly) {
    runCmd('gcloud', ['projects', 'create', opts.project, `--name=${opts.displayName}`]);
    report.steps.gcpProject = 'created';
  } else {
    report.steps.gcpProject = pDesc.ok ? 'exists' : 'missing';
  }

  // 2. Blaze Billing
  const bDesc = runCmd('gcloud', ['billing', 'projects', 'describe', opts.project, '--format=json'], { allowFail: true });
  let billingEnabled = false;
  if (bDesc.ok && bDesc.stdout) {
    try {
      billingEnabled = Boolean(JSON.parse(bDesc.stdout).billingEnabled);
    } catch {
      billingEnabled = false;
    }
  }
  if (!billingEnabled && !opts.verifyOnly) {
    let billingId = opts.billingAccount;
    if (!billingId) {
      const list = runCmd('gcloud', ['billing', 'accounts', 'list', '--filter=open=true', '--format=json'], { allowFail: true });
      if (list.ok && list.stdout) {
        const arr = JSON.parse(list.stdout);
        if (arr.length > 0) billingId = arr[0].name.replace('billingAccounts/', '');
      }
    }
    if (!billingId) throw new Error('No hay Billing Account abierta. Pasa --billing-account=<ID>.');
    runCmd('gcloud', ['billing', 'projects', 'link', opts.project, `--billing-account=${billingId}`]);
    report.steps.blazeBilling = `linked:${billingId}`;
  } else {
    report.steps.blazeBilling = billingEnabled ? 'active' : 'inactive';
  }

  // 3. Firebase Add
  const fbRes = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}`, token);
  if (!fbRes.ok && !opts.verifyOnly) {
    const add = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}:addFirebase`, token, { method: 'POST' });
    if (!add.ok) throw new Error(`Error addFirebase: ${add.raw}`);
    if (add.data?.name && !add.data?.done) await pollOperation(add.data.name, token);
    report.steps.firebaseProject = 'added';
  } else {
    report.steps.firebaseProject = fbRes.ok ? 'active' : 'missing';
  }

  // 4. APIs
  if (!opts.verifyOnly) {
    runCmd('gcloud', ['services', 'enable', ...REQUIRED_APIS, `--project=${opts.project}`]);
    report.steps.apisEnabled = REQUIRED_APIS.length;
  }

  // 5. Firestore Native
  const fsDesc = runCmd('gcloud', ['firestore', 'databases', 'describe', '--database=(default)', `--project=${opts.project}`, '--format=json'], { allowFail: true });
  if (fsDesc.ok && fsDesc.stdout) {
    const parsed = JSON.parse(fsDesc.stdout);
    if (parsed.type !== 'FIRESTORE_NATIVE') throw new Error(`Modo inválido ${parsed.type}; se exige FIRESTORE_NATIVE.`);
    report.steps.firestoreNative = `active:${parsed.locationId || opts.region}`;
  } else if (!opts.verifyOnly) {
    runCmd('gcloud', ['firestore', 'databases', 'create', '--database=(default)', `--location=${opts.region}`, '--type=firestore-native', `--project=${opts.project}`]);
    report.steps.firestoreNative = `created:${opts.region}`;
  } else {
    report.steps.firestoreNative = 'missing';
  }

  // 6. Auth Email/Password + Domains
  if (!opts.verifyOnly) {
    await gcpFetch(`https://identitytoolkit.googleapis.com/v2/projects/${opts.project}/identityPlatform:initializeAuth`, token, {
      method: 'POST',
      body: {},
      quotaProject: opts.project,
    });
    const cfg = await gcpFetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${opts.project}/config`, token, { quotaProject: opts.project });
    const merged = Array.from(new Set([...(cfg.data?.authorizedDomains || []), `${opts.project}.firebaseapp.com`, `${opts.project}.web.app`, ...opts.domains]));
    const patch = await gcpFetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${opts.project}/config?updateMask=signIn.email,authorizedDomains`,
      token,
      { method: 'PATCH', quotaProject: opts.project, body: { signIn: { email: { enabled: true, passwordRequired: true } }, authorizedDomains: merged } }
    );
    report.steps.firebaseAuth = patch.ok ? 'ready' : `warn:${patch.status}`;
  }

  // 7. Storage Bucket
  const buckets = [`${opts.project}.firebasestorage.app`, `${opts.project}.appspot.com`];
  let bucket = buckets.find((b) => runCmd('gcloud', ['storage', 'buckets', 'describe', `gs://${b}`, '--format=json'], { allowFail: true }).ok) || '';
  if (!bucket && !opts.verifyOnly) {
    const target = `${opts.project}.firebasestorage.app`;
    runCmd('gcloud', ['storage', 'buckets', 'create', `gs://${target}`, `--project=${opts.project}`, `--location=${opts.storageLocation}`, '--uniform-bucket-level-access'], { allowFail: true });
    await gcpFetch(`https://firebasestorage.googleapis.com/v1beta/projects/${opts.project}/defaultBucket`, token, {
      method: 'POST',
      quotaProject: opts.project,
      body: { location: opts.storageLocation },
    });
    bucket = target;
    report.steps.cloudStorage = `provisioned:${bucket}`;
  } else {
    report.steps.cloudStorage = bucket ? `active:${bucket}` : 'missing';
  }

  // 8. Web App SDK + App Check reCAPTCHA Enterprise
  const apps = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}/webApps`, token);
  let webApp = apps.data?.apps?.[0] || null;
  if (!webApp && !opts.verifyOnly) {
    const cApp = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}/webApps`, token, {
      method: 'POST',
      body: { displayName: `${opts.displayName} CRM Web` },
    });
    if (cApp.ok && cApp.data?.name) webApp = await pollOperation(cApp.data.name, token);
  }
  if (webApp?.appId) {
    const sdk = await gcpFetch(`https://firebase.googleapis.com/v1beta1/projects/${opts.project}/webApps/${webApp.appId}/config`, token);
    report.sdkConfig = sdk.data || null;
    if (!opts.verifyOnly) {
      const kCreate = runCmd(
        'gcloud',
        ['recaptcha', 'keys', 'create', `--display-name=CRM App Check ${opts.project}`, '--web', `--domains=${opts.domains.join(',')}`, '--integration-type=score', `--project=${opts.project}`, '--format=json'],
        { allowFail: true }
      );
      const siteKey = kCreate.ok && kCreate.stdout ? JSON.parse(kCreate.stdout).name?.split('/').pop() : '';
      if (siteKey) {
        await gcpFetch(`https://firebaseappcheck.googleapis.com/v1/projects/${opts.project}/apps/${webApp.appId}/recaptchaEnterpriseConfig?updateMask=siteKey,tokenTtl`, token, {
          method: 'PATCH',
          quotaProject: opts.project,
          body: { siteKey, tokenTtl: '3600s' },
        });
        if (report.sdkConfig) report.sdkConfig.recaptchaSiteKey = siteKey;
        report.steps.appCheck = `bound:${siteKey}`;
      }
    }
  }

  if (report.sdkConfig && !opts.verifyOnly) {
    const envPath = path.resolve(process.cwd(), `.env.client.${opts.project}.example`);
    const lines = [
      `NEXT_PUBLIC_FIREBASE_API_KEY=${report.sdkConfig.apiKey || ''}`,
      `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${report.sdkConfig.authDomain || ''}`,
      `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${report.sdkConfig.projectId || opts.project}`,
      `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${report.sdkConfig.storageBucket || ''}`,
      `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${report.sdkConfig.messagingSenderId || ''}`,
      `NEXT_PUBLIC_FIREBASE_APP_ID=${report.sdkConfig.appId || ''}`,
      `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=${report.sdkConfig.recaptchaSiteKey || ''}`,
    ];
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
    report.envFile = envPath;
  }

  // 9. Seed CRM Default Docs
  if (opts.seed && !opts.verifyOnly) {
    report.steps.seedDocs = await seedCrmDefaultsRest(opts.project, opts.displayName, token);
  }

  // 10. Deploy Recycled Rules + Update Manifest
  if (opts.deployRules && !opts.verifyOnly) {
    const targets = ['firestore.rules', 'firestore.indexes.json', 'storage.rules']
      .filter((f) => fs.existsSync(path.resolve(process.cwd(), f)))
      .map((f) => (f === 'firestore.rules' ? 'firestore:rules' : f === 'firestore.indexes.json' ? 'firestore:indexes' : 'storage'));
    if (targets.length) {
      runCmd('npx', ['firebase-tools', 'deploy', '--only', targets.join(','), '--project', opts.project]);
      report.steps.rulesDeployed = targets;
    }
  }

  if (opts.manifest && !opts.verifyOnly) {
    report.manifestUpdated = updateManifest(opts.manifest, opts);
  }

  if (opts.devEmails.length && !opts.verifyOnly) {
    report.steps.platformDevNote = `Asignar Custom Claim { platformDev: true } vía Admin SDK tras el primer login de: ${opts.devEmails.join(', ')}`;
  }

  report.manualChecklist.push(
    `Si usarás Google Sign-In externo, configurar OAuth Consent Screen en https://console.cloud.google.com/apis/credentials/consent?project=${opts.project}`,
    `Configurar registros DNS personalizados si conectas un dominio propio en Firebase Hosting / App Hosting.`
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
