const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./database');

const activeBots = new Map();
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

async function startBot({ token, scriptName, requestedBy, guildId, mainClient }) {
    if (activeBots.has(token)) {
        return { success: false, message: 'Ce bot est déjà en ligne.' };
    }

    const script = db.getScript(scriptName);
    if (!script && !['commu', 'ticket', 'moderation'].includes(scriptName.toLowerCase())) {
        return { success: false, message: `Script "${scriptName}" introuvable. Utilisez /addscript pour l'ajouter.` };
    }

    const childClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildModeration,
        ],
        partials: [Partials.Message, Partials.Channel]
    });

    try {
        await childClient.login(token);
    } catch {
        return { success: false, message: 'Token invalide ou bot inaccessible.' };
    }

    const scriptNameLower = scriptName.toLowerCase();
    let commandHandler = null;
    if (scriptNameLower === 'commu') commandHandler = require('../scripts/commu');
    else if (scriptNameLower === 'ticket') commandHandler = require('../scripts/ticket');
    else if (scriptNameLower === 'moderation') commandHandler = require('../scripts/moderation');
    else if (script) {
        try {
            commandHandler = { handleMessage: new Function('message', script.code) };
        } catch (e) {
            await childClient.destroy();
            return { success: false, message: `Erreur dans le script : ${e.message}` };
        }
    }

    if (commandHandler?.setup) commandHandler.setup(childClient);
    if (commandHandler?.handleMessage) {
        childClient.on('messageCreate', (msg) => {
            if (msg.author.bot) return;
            try { commandHandler.handleMessage(msg); } catch {}
        });
    }

    const botId = childClient.user.id;
    const botTag = childClient.user.tag;

    const shutdownTimer = setTimeout(async () => {
        await stopBot(token);
        try {
            const user = await mainClient.users.fetch(requestedBy);
            await user.send(`⚠️ Votre bot **${botTag}** (script: \`${scriptName}\`) a été mis **hors ligne** après 24h.\nRefaites \`/addscriptbot\` pour le remettre en ligne !`);
        } catch {}
    }, TWENTY_FOUR_HOURS);

    activeBots.set(token, { client: childClient, botId, botTag, scriptName, requestedBy, guildId, shutdownTimer });

    try {
        const user = await mainClient.users.fetch(requestedBy);
        await user.send(`✅ Votre bot **${botTag}** est en ligne avec le script \`${scriptName}\` !\n⏰ Il sera hors ligne dans **24 heures**.`);
    } catch {}

    return { success: true, botId, botTag };
}

async function stopBot(token) {
    const entry = activeBots.get(token);
    if (!entry) return false;
    clearTimeout(entry.shutdownTimer);
    try { await entry.client.destroy(); } catch {}
    activeBots.delete(token);
    return true;
}

function getActiveBots() {
    return [...activeBots.values()].map(b => ({
        botId: b.botId, botTag: b.botTag, scriptName: b.scriptName,
        requestedBy: b.requestedBy, guildId: b.guildId
    }));
}

module.exports = { startBot, stopBot, getActiveBots };
