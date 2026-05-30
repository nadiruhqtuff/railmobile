# Discord Manager Bot

Bot Discord permettant de gérer des scripts et de mettre d'autres bots en ligne.

## Installation & Déploiement sur Railway

### 1. Pré-requis
- Un compte [Railway](https://railway.app)
- Un bot Discord principal (le manager)
- Node.js 18+

### 2. Configuration
1. Duplique le fichier `.env.example` en `.env`
2. Remplis les variables :
   ```
   BOT_TOKEN=ton_token_discord_ici
   CLIENT_ID=l_id_de_ton_bot_ici
   ```

### 3. Enregistrer les commandes slash
Avant de démarrer, enregistre les commandes slash (une seule fois) :
```bash
npm install
node register-commands.js
```

### 4. Déployer sur Railway
1. Va sur [railway.app](https://railway.app) > **New Project** > **Deploy from GitHub repo** (ou upload zip)
2. Ajoute les variables d'environnement dans Railway :
   - `BOT_TOKEN` = ton token
   - `CLIENT_ID` = l'ID de ton bot
3. Railway démarrera automatiquement le bot avec `node index.js`

---

## Commandes

### Commandes Slash (préfixe `/`)

| Commande | Description | Permissions |
|----------|-------------|-------------|
| `/addscriptbot script:nom token:xxx` | Met un bot en ligne avec un script (24h) | Tout le monde |
| `/addscript name:nom script:code` | Ajoute un script personnalisé | Administrateur |
| `/listscripts` | Voir les scripts dispo et bots actifs | Tout le monde |
| `/removescript name:nom` | Supprime un script personnalisé | Administrateur |

### Commandes Préfixe (préfixe `?`)

| Commande | Description | Permissions |
|----------|-------------|-------------|
| `?ban @user raison` | Bannit un utilisateur | BanMembers |
| `?kick @user raison` | Expulse un membre | KickMembers |
| `?mute @user 1d raison` | Met en sourdine (1s/m/h/d) | ModerateMembers |
| `?unmute @user` | Retire la sourdine | ModerateMembers |
| `?addlogs #salon` | Configure le salon de logs | ManageGuild |
| `?help` | Affiche l'aide | Tout le monde |

---

## Scripts intégrés

| Script | Description |
|--------|-------------|
| `commu` | Commandes communautaires (?ping, ?info, ?say, ?embed, ?help) |
| `ticket` | Système de tickets avec boutons Discord |
| `moderation` | Modération (?ban, ?kick, ?mute, ?unmute, ?help) |

---

## Système de Logs

Configure un salon de logs avec `?addlogs #salon`. Les événements loggés :
- 🗑️ Messages supprimés (auteur, contenu original, salon)
- 📥 Membres rejoints
- 📤 Membres partis
- 🔨 Bans
- 🤖 Chaque utilisation de `/addscriptbot`
- 📜 Chaque ajout de script via `/addscript`

---

## Comment ça marche

1. Tu fais `/addscriptbot script:ticket token:TOKEN_DE_TON_BOT`
2. Le bot principal se connecte au token donné
3. Le bot secondaire se met en ligne avec les commandes du script `ticket`
4. Tu reçois un **DM** de confirmation avec l'heure d'expiration
5. Après **24 heures**, le bot secondaire est automatiquement mis hors ligne
6. Tu reçois un **DM d'avertissement** pour refaire la commande

---

## Ajouter un script personnalisé

```
/addscript name:monscript script:if(message.content==='?hello'){message.reply('Hello!')}
```

Le code est du JavaScript qui reçoit `message` (objet Message discord.js).
