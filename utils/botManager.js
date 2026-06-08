const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./database');

const activeBots = new Map();
const BOT_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 heures

async function startBot(token, scriptName, requestingUser) {
    // Vérifier si le bot est déjà en ligne
    if (activeBots.has(token)) {
        return { success: false, error: 'Un bot avec ce token est déjà en ligne.' };
    }

    // Récupérer le script
    const scriptObj = db.getScript(scriptName);
    if (!scriptObj) {
        return { success: false, error: `Script \`${scriptName}\` introuvable.` };
    }

    // Créer le client enfant
    const childClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Message, Partials.Channel],
    });

    // Handler pour les messages
    childClient.on('messageCreate', async (message) => {
        if (message.author?.bot) return;

        try {
            // Exécuter le script
            const Discord = require('discord.js');
            // eslint-disable-next-line no-new-func
            const handler = new Function('message', 'client', 'Discord', `(async () => { ${scriptObj.code} })()`);
            await handler(message, childClient, Discord);
        } catch (err) {
            console.error(`[SCRIPT ERROR][${scriptName}]`, err.message);
            message.channel?.send(`❌ Erreur script: ${err.message}`).catch(() => {});
        }
    });

    // Connexion
    return new Promise((resolve) => {
        const loginTimeout = setTimeout(() => {
            childClient.destroy();
            resolve({ success: false, error: 'Timeout lors de la connexion du bot (token invalide ?).' });
        }, 30_000); // 30 secondes

        childClient.once('ready', () => {
            clearTimeout(loginTimeout);

            const expiresAt = new Date(Date.now() + BOT_LIFETIME_MS);
            const tag = childClient.user.tag;

            // Arrêt automatique après 24h
            const shutdownTimer = setTimeout(async () => {
                await stopBot(token);
                try {
                    const user = await childClient.users.fetch(requestingUser.id).catch(() => null) || requestingUser;
                    await user.send(
                        `⏰ Votre bot **${tag}** (script: \`${scriptName}\`) a été mis hors ligne après 24 heures.\n` +
                        'Utilisez `/panel` pour le relancer.'
                    ).catch(() => {});
                } catch (_) {}
            }, BOT_LIFETIME_MS);

            activeBots.set(token, { client: childClient, timer: shutdownTimer, scriptName, tag, expiresAt });

            console.log(`[BOT] Démarré: ${tag} | script: ${scriptName} | expire: ${expiresAt.toISOString()}`);
            resolve({ success: true, tag, expiresAt });
        });

        childClient.on('error', (err) => {
            console.error(`[BOT ERROR][${scriptName}]`, err.message);
        });

        childClient.login(token).catch((err) => {
            clearTimeout(loginTimeout);
            childClient.destroy();
            resolve({ success: false, error: `Impossible de se connecter: ${err.message}` });
        });
    });
}

async function stopBot(token) {
    const entry = activeBots.get(token);
    if (!entry) return;

    clearTimeout(entry.timer);
    try { entry.client.destroy(); } catch (_) {}
    activeBots.delete(token);

    console.log(`[BOT] Arrêté: ${entry.tag}`);
}

function getActiveBots() {
    return [...activeBots.values()].map(b => ({
        scriptName: b.scriptName,
        tag: b.tag,
        expiresAt: b.expiresAt,
    }));
}

module.exports = { startBot, stopBot, getActiveBots };

