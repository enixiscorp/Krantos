# Supabase Migrations — Krantos Platform

Ce dossier contient les fichiers de migration SQL pour la base de données Supabase de la plateforme Krantos.

## Fichiers de migration

| Fichier | Description |
|---------|-------------|
| `20240001_initial_schema.sql` | Schéma initial : types enum, tables, clés étrangères et index |

---

## Appliquer les migrations

### Option 1 — Supabase CLI (recommandé)

La CLI Supabase permet d'appliquer les migrations de façon reproductible, en local ou sur un projet distant.

**Prérequis** : [Installer la Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

```bash
# Installer la CLI (si ce n'est pas déjà fait)
npm install -g supabase

# Se connecter à votre compte Supabase
supabase login

# Lier le projet local à votre projet Supabase distant
supabase link --project-ref <votre-project-ref>

# Appliquer toutes les migrations en attente
supabase db push
```

> Le `project-ref` se trouve dans les paramètres de votre projet Supabase : **Settings → General → Reference ID**.

**Développement local avec Supabase** :

```bash
# Démarrer Supabase en local (Docker requis)
supabase start

# Les migrations sont appliquées automatiquement au démarrage
# Pour réappliquer manuellement :
supabase db reset
```

---

### Option 2 — Éditeur SQL du dashboard Supabase

Si vous préférez ne pas utiliser la CLI, vous pouvez exécuter les migrations directement depuis l'interface web.

1. Connectez-vous à [app.supabase.com](https://app.supabase.com)
2. Sélectionnez votre projet
3. Dans le menu de gauche, cliquez sur **SQL Editor**
4. Cliquez sur **New query**
5. Copiez-collez le contenu du fichier `20240001_initial_schema.sql`
6. Cliquez sur **Run** (ou `Ctrl+Entrée`)

> Vérifiez dans **Table Editor** que les tables `users`, `vendors`, `products`, `leads` et `appliances_input` ont bien été créées.

---

## Ordre d'application

Les migrations doivent être appliquées dans l'ordre chronologique (préfixe de date). Les dépendances entre tables sont respectées dans ce schéma :

```
users → vendors → products → leads → appliances_input
```

---

## Variables d'environnement requises

Après avoir créé votre projet Supabase, renseignez les variables suivantes dans votre fichier `.env.local` :

```env
VITE_SUPABASE_URL=https://<votre-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<votre-anon-key>
```

Ces valeurs sont disponibles dans **Settings → API** de votre projet Supabase.

> ⚠️ Ne jamais exposer la clé `service_role` dans le frontend. Seule la clé `anon` doit être utilisée côté client.
