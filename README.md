# Event Mariage

Le tableau de bord des agences d'événementiel et de mariage. **n8n exécute les automatisations, Event Mariage les rend visibles** : leads, mariages, relances, résultats business, en temps réel. L'agence peut mettre une automatisation en pause ou relancer une action, sans jamais voir un workflow.

- **Vue d'ensemble** : nouveaux leads, conversion, CA signé et prévisionnel, délai de première réponse, heures gagnées, prochains mariages, activité en direct.
- **Leads** : kanban Nouveau → Qualifié → RDV → Proposition → Signé / Perdu, fiche lead avec l'historique complet (automatique et manuel), boutons « Relancer » et « Envoyer la proposition ».
- **Mariages** : liste et calendrier, checklist J-90 / J-30 / J-7, prestataires, acomptes.
- **Automatisations** : catalogue avec interrupteur, nombre d'actions, taux de réussite, dernière action, erreurs à traiter avec « Relancer ».
- **Réglages** : profil de l'agence (logo, couleur), équipe et rôles, webhooks n8n, clés API avec rotation.

Stack : Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Auth, Postgres + RLS, Realtime, Storage) · TanStack Query · Zod · Recharts · next-intl (FR, EN, NL).

---

## Architecture

```
n8n ──POST /api/ingest/:type (clé API + HMAC)──► Next.js (service role) ──► Supabase Postgres
                                                                                 │ Realtime
Navigateur ◄── pages serveur + TanStack Query (session, RLS) ◄───────────────────┘
Navigateur ── Server Action ──► webhook signé ──► n8n          (le navigateur n'appelle jamais n8n)
```

- **Supabase est la source de vérité.** Chaque table métier porte `org_id` ; la RLS limite chaque utilisateur aux organisations dont il est membre (`is_member`, `is_admin`).
- **`automation_events`** centralise tout ce qui se passe : type, statut (`pending`, `success`, `error`, `info`), auteur (`automation`, `user`, `system`), lead / mariage lié, détail, horodatage.
- **Idempotence** : chaque élément ingéré porte un `external_id`, unique par organisation. Un renvoi met à jour au lieu de dupliquer.
- **Corrélation** : une action déclenchée depuis l'app crée une ligne « En cours » dont l'identifiant part vers n8n (`request_id`). n8n le renvoie dans `automation-run` pour la clore.
- **Secrets** chiffrés en AES-256-GCM (`APP_ENCRYPTION_KEY`). Le secret d'une clé API n'est affiché qu'une fois.

```
app/(app)/            pages : vue d'ensemble, leads, evenements, automatisations, reglages
app/api/ingest/       API d'ingestion n8n → app
app/api/v1/           statut d'une automatisation (pause) pour n8n
app/actions/          Server Actions (relance, proposition, pause, réglages…)
lib/ingest/           schémas Zod, authentification HMAC, handlers idempotents
lib/n8n/dispatch.ts   webhooks signés app → n8n
supabase/migrations/  schéma, RLS, indicateurs
scripts/              données de démo, envoi d'un événement de test
n8n/                  workflows importables
```

---

## Installation

Prérequis : Node.js 20 ou plus, un projet [Supabase](https://supabase.com) (l'offre gratuite suffit).

```bash
npm install
cp .env.example .env.local
```

### 1. Variables d'environnement (`.env.local`)

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API › Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase › Project Settings › API › `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API › `service_role` (**serveur uniquement**) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` en local, l'URL Vercel en production |
| `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` (32 octets en base64). Ne plus la changer ensuite : elle déchiffre les secrets. |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | Identifiants du compte de démo créé par `npm run seed` |
| `DEMO_WITNESS_EMAIL` | Compte de l'agence témoin (test d'isolation) |
| `EM_API_KEY_ID`, `EM_API_SECRET` | Affichés par `npm run seed`, utilisés par `npm run send-test-event` |

### 2. Base de données

Exécuter les migrations **dans l'ordre**, au choix :

- **SQL Editor** de Supabase : coller puis exécuter le contenu de chaque fichier de `supabase/migrations/` ;
- **CLI** : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.

Dans Supabase › Authentication › URL Configuration, ajouter `http://localhost:3000/auth/callback` (et l'URL de production) aux *Redirect URLs*.

### 3. Données de démo

```bash
npm run seed
```

Crée l'agence **Maison Lumière** (40 leads, 12 mariages, 300 événements d'automatisation, tâches, prestataires, acomptes), une **agence témoin** pour vérifier l'isolation, et une clé d'ingestion de démo. Le script est rejouable : il recrée les deux agences à chaque exécution.

### 4. Lancer

```bash
npm run dev
```

Ouvrir http://localhost:3000 et se connecter avec `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`.

Un nouvel utilisateur sans agence est dirigé vers l'onboarding, qui crée l'agence, le catalogue d'automatisations et le secret sortant.

### Vérifications

```bash
npm run typecheck && npm run lint && npm test
npm run send-test-event -- lead                      # un lead apparaît dans le kanban + notification
npm run send-test-event -- automation-run            # l'activité en direct se met à jour
npm run send-test-event -- automation-run --replay   # à lancer deux fois : aucun doublon
npm run send-test-event -- automation-run --error    # apparaît dans « À traiter »
npm run send-test-event -- lead --bad-signature      # 401
```

Isolation RLS : exécuter `supabase/tests/rls.sql` dans le SQL Editor (colonne `resultat` = colonne `attendu`).

---

## Connecter n8n, pas à pas

### n8n → Event Mariage (données entrantes)

1. Dans l'app : **Réglages › Intégrations › Créer une clé**. Copier l'identifiant (`emk_…`) et le secret (`ems_…`) : le secret n'est plus jamais affiché.
2. Dans n8n : importer `n8n/01-lead-entrant.json` (Workflows › Import from File).
3. Ouvrir le nœud **Config Event Mariage** et renseigner `api_url`, `key_id`, `secret`.
4. Brancher votre source sur le webhook du workflow (formulaire du site, Instagram, Mariages.net, boîte mail…) et adapter le nœud « Construire le lead ».
5. Activer le workflow, puis envoyer une demande de test : elle apparaît dans le kanban avec une notification.

Pour importer aussi `02-relance-j3.json` et `03-demande-avis.json`, suivre les mêmes étapes. Le détail est dans [`n8n/README.md`](n8n/README.md).

### Event Mariage → n8n (actions de l'équipe)

1. Dans n8n : copier l'URL de production du webhook **Relance demandée depuis l'app** (`02-relance-j3.json`).
2. Dans l'app : **Réglages › Intégrations › Envoyer les actions vers n8n**. Coller l'URL dans « Relancer un lead », puis enregistrer.
3. Cliquer **Générer un nouveau secret** et le coller dans le nœud **Config sortante** de n8n.
4. Cliquer **Tester** : n8n reçoit un appel signé.
5. Sur une fiche lead, cliquer **Relancer** : une ligne « En cours » apparaît dans l'historique, puis passe en « Réussi » quand n8n confirme.

Actions disponibles : `lead.follow_up`, `lead.send_proposal`, `lead.stage_changed`, `automation.toggle`, `automation.retry`. Corps envoyé :

```json
{ "request_id": "…", "action": "lead.follow_up", "org_id": "…", "triggered_by": { "id": "…", "email": "…" },
  "sent_at": "…", "lead": { "external_id": "form-8841", "first_name": "Camille", "email": "…", "budget": 25000 } }
```

---

## API d'ingestion

`POST /api/ingest/:type`, avec `type` parmi `lead`, `lead-stage`, `event`, `payment`, `task`, `automation-run`.

```
Authorization: Bearer emk_<identifiant>
X-EM-Timestamp: <secondes unix>                  (refusé au-delà de ±5 minutes)
X-EM-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<corps brut>")>
```

Le corps est un objet seul, ou `{ "items": [ … ] }` avec 100 éléments au maximum. Les montants sont en euros, les dates au format `AAAA-MM-JJ`.

| Code | Signification |
|---|---|
| `200` | `{ received, created, updated, unchanged }` |
| `400` | JSON ou payload invalide (détail Zod par élément) |
| `401` | Clé inconnue, révoquée ou expirée, signature ou horodatage invalide |
| `409` | Automatisation en pause (`automation-run` avec `respect_pause: true`) |
| `422` | Référence inconnue (ex. acompte pour un mariage absent) |

```jsonc
// lead
{ "external_id": "form-8841", "source": "instagram", "first_name": "Camille", "last_name": "Durand",
  "partner_name": "Hugo", "email": "camille@exemple.fr", "wedding_date": "2027-06-12",
  "budget": 25000, "guest_count": 120, "venue": "Château de …", "message": "…" }

// lead-stage
{ "external_id": "stage-991", "lead_external_id": "form-8841", "stage": "proposal" }

// event : un mariage signé passe le lead en « Signé »
{ "external_id": "evt-221", "lead_external_id": "form-8841", "title": "Mariage Camille & Hugo",
  "date": "2027-06-12", "venue": "…", "guest_count": 120, "contract_amount": 24000 }

// payment
{ "external_id": "pay-1", "event_external_id": "evt-221", "label": "Acompte 30 %", "amount": 7200,
  "due_date": "2026-11-01", "status": "received" }

// task
{ "external_id": "task-1", "event_external_id": "evt-221", "title": "Confirmer le traiteur",
  "milestone": "J-30", "due_date": "2027-05-13", "done": false }

// automation-run : alimente l'activité et les statistiques
{ "external_id": "n8n-exec-99812", "automation_key": "lead_instant_reply", "status": "success",
  "title": "Réponse envoyée à Camille Durand", "lead_external_id": "form-8841",
  "first_response": true, "request_id": null, "respect_pause": false, "detail": { "channel": "email" } }
```

Une `automation_key` inconnue crée l'automatisation **en pause** dans le catalogue, pour qu'elle reste visible.

`GET /api/v1/automations/:key` (même authentification, signature sur un corps vide) renvoie `{ key, enabled, known }`. n8n s'en sert pour vérifier une pause avant d'agir.

---

## Déploiement sur Vercel

1. Importer le dépôt dans Vercel (framework détecté : Next.js).
2. Renseigner les variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY` (la même qu'en local si la base est partagée) et `NEXT_PUBLIC_APP_URL` (l'URL Vercel).
3. Ajouter `https://<votre-app>.vercel.app/auth/callback` aux *Redirect URLs* de Supabase.
4. Dans n8n, remplacer `api_url` par l'URL Vercel.

## Langues

Les textes sont dans `messages/fr.json`, `en.json` et `nl.json`. La langue se choisit dans le menu utilisateur (cookie `em_locale`). Pour ajouter une langue : créer le fichier de messages, puis l'ajouter à `i18n/config.ts`.

## Hors périmètre du MVP

Facturation, signature électronique, application mobile native, éditeur de workflows (n8n reste l'éditeur).
