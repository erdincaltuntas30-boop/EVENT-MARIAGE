# Workflows n8n prêts à brancher

| Fichier | Rôle |
|---|---|
| `01-lead-entrant.json` | Reçoit une demande (formulaire, Instagram, Mariages.net…), l'envoie à Event Mariage, répond instantanément puis le signale (`first_response: true` → délai de première réponse). |
| `02-relance-j3.json` | Chaque matin : vérifie que « Relance après proposition J+3 » n'est pas en pause, relance, puis rend compte. **Seconde branche** : reçoit le bouton « Relancer » de l'app (webhook signé), vérifie la signature et confirme avec le `request_id`. |
| `03-demande-avis.json` | Chaque jour : vérifie la pause, envoie la demande d'avis 2 jours après le mariage et rend compte (une seule fois par mariage grâce à l'`external_id`). |

## Import

1. n8n › **Workflows › Import from File** › choisir le JSON.
2. Ouvrir le nœud **Config Event Mariage** et renseigner :
   - `api_url` : l'URL de l'app (ex. `https://event-mariage.vercel.app`, ou un tunnel vers `http://localhost:3000`) ;
   - `key_id` et `secret` : Réglages › Intégrations › **Créer une clé** (le secret n'est affiché qu'une fois).
3. Remplacer les nœuds gris « À remplacer… » par vos envois réels (Gmail, Brevo, Instagram, CRM…).
4. Activer le workflow.

Pour la branche manuelle de `02-relance-j3.json` :
1. Copier l'URL de production du nœud **Relance demandée depuis l'app** dans Réglages › Intégrations › « Relancer un lead ».
2. Générer le **secret sortant** dans l'app et le coller dans le nœud **Config sortante** (`outbound_secret`), avec `api_url`, `key_id`, `secret`.
3. Cliquer « Tester » dans l'app : n8n doit recevoir l'appel.

## Signature

Chaque appel vers l'API porte :

```
Authorization: Bearer emk_…
X-EM-Timestamp: <secondes unix>
X-EM-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<corps brut>")>
```

Les workflows sérialisent le JSON **une seule fois** (nœud Code), signent cette chaîne (nœud Crypto) et l'envoient telle quelle en corps *raw*. Si vous modifiez un payload, gardez ce schéma : un corps re-sérialisé différemment invaliderait la signature.

Les appels de l'app vers n8n sont signés de la même façon avec le **secret sortant**.

## Idempotence

`external_id` identifie chaque élément. Renvoyer le même `external_id` met à jour l'élément au lieu de le dupliquer : vous pouvez rejouer une exécution n8n sans risque.
