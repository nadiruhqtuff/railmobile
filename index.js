require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

// Extraction des ZIP au démarrage
async function extractZips() {
    const zips = ['commands.zip', 'scripts.zip', 'utils.zip'];
    for (const zip of zips) {
        const zipPath = path.join(__dirname, zip);
        if (fs.existsSync(zipPath)) {
            try {
                await new Promise((resolve, reject) => {
                    fs.createReadStream(zipPath)
                        .pipe(unzipper.Extract({ path: __dirname }))
                        .on('close', resolve)
                        .on('error', reject);
                });
                console.log(`[ZIP] ${zip} extrait avec succès`);
            } catch (err) {
                console.error(`[ZIP ERROR] Erreur lors de l'extraction de ${zip}:`, err.message);
            }
        }
    }
}

// Appelle l'extraction avant de démarrer le bot
(async () => {
    await extractZips();

    // Patch botManager.js to pass Discord.js context (client + Discord module) to
    // custom scripts, so they can use EmbedBuilder and other Discord.js APIs.
    const botManagerPath = path.join(__dirname, 'utils', 'botManager.js');
    if (fs.existsSync(botManagerPath)) {
        let bmCode = fs.readFileSync(botManagerPath, 'utf8');
        // Fix 1: extend new Function signature to include 'client' and 'Discord' params
        bmCode = bmCode.replace(
            /new Function\(\s*['"]message['"]\s*,\s*(\w+\.code|\w+)\s*\)/g,
            "new Function('message', 'client', 'Discord', $1)"
        );
        // Fix 2: pass childClient and Discord when invoking handleMessage
        bmCode = bmCode.replace(
            /commandHandler\.handleMessage\(\s*(\w+)\s*\)/g,
            'commandHandler.handleMessage($1, childClient, require(\'discord.js\'))'
        );
        fs.writeFileSync(botManagerPath, bmCode, 'utf8');
        console.log('[PATCH] utils/botManager.js patched: Discord context injected into script functions');
    }

    const db = require('./utils/database');
    const { logMessageDelete, logMemberJoin, logMemberLeave, logBan } = require('./utils/logger');

    const PREFIX = '?';
    const TOKEN = process.env.DISCORD_TOKEN;

    if (!TOKEN) {
        console.error('[ERREUR] La variable DISCORD_TOKEN est manquante !');
        process.exit(1);
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
    });

    client.commands = new Collection();
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if (command.data) client.commands.set(command.data.name, command);
    }

    async function registerCommands(clientId) {
        const commands = [...client.commands.values()].map(c => c.data.toJSON());
        const rest = new REST().setToken(TOKEN);
        try {
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log(`[SLASH] ${commands.length} commande(s) enregistrée(s)`);
        } catch (err) {
            console.error('[SLASH ERROR]', err.message);
        }
    }

    client.once('ready', async () => {
        console.log(`[ON] Connecté : ${client.user.tag}`);
        await registerCommands(client.user.id);
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('accept_rules:')) {
                const roleIds = interaction.customId.slice('accept_rules:'.length).split(',').filter(Boolean);
                const member = interaction.member;
                const failed = [];

                for (const roleId of roleIds) {
                    try {
                        await member.roles.add(roleId);
                    } catch {
                        failed.push(roleId);
                    }
                }

                if (failed.length > 0) {
                    await interaction.reply({
                        content: `⚠️ Règlement accepté, mais certains rôles n'ont pas pu être attribués (${failed.length} erreur(s)).`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '✅ Règlement accepté ! Les rôles vous ont été attribués.',
                        ephemeral: true
                    });
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, client);
        } catch (err) {
            console.error(`[CMD ERROR][${interaction.commandName}]`, err.message);
            const msg = { content: `❌ Erreur : ${err.message}`, ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
            else await interaction.reply(msg).catch(() => {});
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content.startsWith(PREFIX)) return;
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'ban') {
            if (!message.member?.permissions.has('BanMembers'))
                return message.reply('❌ Permission refusée. (BanMembers requis)');
            const target = message.mentions.users.first();
            if (!target) return message.reply('❌ Mentionne un utilisateur. Ex: `?ban @user raison`');
            const raison = args.slice(1).join(' ') || 'Aucune raison fournie';
            try {
                await message.guild.members.ban(target, { reason: raison });
                const embed = new EmbedBuilder()
                    .setColor(0xff0000).setTitle('🔨 Membre Banni')
                    .addFields(
                        { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: true },
                        { name: 'Raison', value: raison, inline: true },
                        { name: 'Modérateur', value: message.author.tag, inline: true }
                    ).setTimestamp();
                message.channel.send({ embeds: [embed] });
            } catch (err) { message.reply(`❌ Impossible de bannir : ${err.message}`); }
            return;
        }

        if (command === 'kick') {
            if (!message.member?.permissions.has('KickMembers'))
                return message.reply('❌ Permission refusée. (KickMembers requis)');
            const target = message.mentions.members?.first();
            if (!target) return message.reply('❌ Mentionne un membre. Ex: `?kick @user raison`');
            const raison = args.slice(1).join(' ') || 'Aucune raison fournie';
            try {
                await target.kick(raison);
                message.channel.send(`✅ **${target.user.tag}** a été expulsé. Raison : ${raison}`);
            } catch (err) { message.reply(`❌ Impossible d'expulser : ${err.message}`); }
            return;
        }

        if (command === 'mute') {
            if (!message.member?.permissions.has('ModerateMembers'))
                return message.reply('❌ Permission refusée. (ModerateMembers requis)');
            const target = message.mentions.members?.first();
            if (!target) return message.reply('❌ Mentionne un membre. Ex: `?mute @user 1d raison`');
            const timeArg = args[1];
            if (!timeArg) return message.reply('❌ Précise une durée. Ex: `?mute @user 1d raison`');
            const match = timeArg.match(/^(\d+)(s|m|h|d)$/i);
            if (!match) return message.reply('❌ Durée invalide. Exemples : `1d`, `2h`, `30m`, `10s`');
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            const durationMs = parseInt(match[1]) * multipliers[match[2].toLowerCase()];
            const raison = args.slice(2).join(' ') || 'Aucune raison fournie';
            try {
                await target.timeout(durationMs, raison);
                const embed = new EmbedBuilder()
                    .setColor(0xff8844).setTitle('🔇 Membre Mis en Sourdine')
                    .addFields(
                        { name: 'Membre', value: `${target.user.tag} (${target.user.id})`, inline: true },
                        { name: 'Durée', value: timeArg, inline: true },
                        { name: 'Raison', value: raison, inline: true },
                        { name: 'Modérateur', value: message.author.tag, inline: true }
                    ).setTimestamp();
                message.channel.send({ embeds: [embed] });
            } catch (err) { message.reply(`❌ Impossible de muter : ${err.message}`); }
            return;
        }

        if (command === 'unmute') {
            if (!message.member?.permissions.has('ModerateMembers'))
                return message.reply('❌ Permission refusée.');
            const target = message.mentions.members?.first();
            if (!target) return message.reply('❌ Mentionne un membre.');
            try {
                await target.timeout(null);
                message.channel.send(`✅ **${target.user.tag}** n'est plus en sourdine.`);
            } catch (err) { message.reply(`❌ Erreur : ${err.message}`); }
            return;
        }

        if (command === 'addlogs') {
            if (!message.member?.permissions.has('ManageGuild'))
                return message.reply('❌ Permission refusée. (ManageGuild requis)');
            const channel = message.mentions.channels.first();
            if (!channel) return message.reply('❌ Mentionne un salon. Ex: `?addlogs #logs`');
            if (!channel.isTextBased()) return message.reply('❌ Ce salon n\'est pas un salon textuel.');
            db.setLogChannel(message.guildId, channel.id);
            const embed = new EmbedBuilder()
                .setColor(0x00ff88).setTitle('✅ Logs Configurés')
                .setDescription(`Les logs seront envoyés dans ${channel}`)
                .addFields({ name: 'Logs activés', value:
                    '• 🗑️ Messages supprimés\\n• 📥 Membres rejoints\\n• 📤 Membres partis\\n• 🔨 Bans\\n• 🤖 /addscriptbot\\n• 📜 /addscript'
                }).setTimestamp();
            message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'help') {
            const embed = new EmbedBuilder()
                .setColor(0x7289da).setTitle('📖 Aide — Commandes disponibles')
                .addFields(
                    { name: '⚙️ Slash Commands', value:
                        '`/addscriptbot script:nom token:xxx` — Met un bot en ligne 24h\\n' +
                        '`/addscript name:nom script:code` — Ajoute un script (Admin)\\n' +
                        '`/listscripts` — Scripts dispo + bots actifs\\n' +
                        '`/removescript name:nom` — Supprime un script (Admin)'
                    },
                    { name: '🔨 Modération (?)', value:
                        '`?ban @user raison`\\n`?kick @user raison`\\n`?mute @user 1d raison`\\n`?unmute @user`\\n`?addlogs #salon`'
                    }
                ).setFooter({ text: 'Préfixe: ?' }).setTimestamp();
            message.channel.send({ embeds: [embed] });
            return;
        }
    });

    client.on('messageDelete', (message) => {
        if (message.partial || !message.guild) return;
        logMessageDelete(client, message);
    });
    client.on('guildMemberAdd', (member) => logMemberJoin(client, member));
    client.on('guildMemberRemove', (member) => logMemberLeave(client, member));
    client.on('guildBanAdd', (ban) => logBan(client, ban));

    client.login(TOKEN).catch(err => {
        console.error('[LOGIN ERROR]', err.message);
        process.exit(1);
    });
})();

