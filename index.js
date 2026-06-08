require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');
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

    const db = require('./utils/database');
    const { startBot } = require('./utils/botManager');
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
        // ── Button interactions ──────────────────────────────────────────────
        if (interaction.isButton()) {
            // Rules acceptance button
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
                return;
            }

            // Panel "Add your bot" button → open modal
            if (interaction.customId === 'panel:add_bot') {
                const modal = new ModalBuilder()
                    .setCustomId('panel:add_bot_modal')
                    .setTitle('🚀 Ajouter votre bot');

                const scriptInput = new TextInputBuilder()
                    .setCustomId('panel_script_name')
                    .setLabel('Nom du script')
                    .setPlaceholder('Ex: ticket, moderation, commu …')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(64);

                const tokenInput = new TextInputBuilder()
                    .setCustomId('panel_bot_token')
                    .setLabel('Token de votre bot Discord')
                    .setPlaceholder('Collez ici le token de votre bot')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(scriptInput),
                    new ActionRowBuilder().addComponents(tokenInput)
                );

                await interaction.showModal(modal);
                return;
            }

            return;
        }

        // ── Modal submissions ────────────────────────────────────────────────
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'panel:add_bot_modal') {
                await interaction.deferReply({ ephemeral: true });

                const scriptName = interaction.fields.getTextInputValue('panel_script_name').trim().toLowerCase();
                const token = interaction.fields.getTextInputValue('panel_bot_token').trim();

                // Validate script exists
                const scriptObj = db.getScript(scriptName);
                if (!scriptObj) {
                    const available = db.listScripts();
                    const hint = available.length > 0
                        ? `\n\n📜 Scripts disponibles : ${available.map(s => `\`${s}\``).join(', ')}`
                        : '\n\n❌ Aucun script disponible. Demandez à un admin d\'en ajouter avec `/addscript`.';
                    return interaction.editReply({
                        content: `❌ Le script \`${scriptName}\` n'existe pas.${hint}`
                    });
                }

                // Start the bot
                const result = await startBot(token, scriptName, interaction.user);

                if (!result.success) {
                    return interaction.editReply({ content: `❌ ${result.error}` });
                }

                const expiresTs = Math.floor(result.expiresAt.getTime() / 1000);
                await interaction.editReply({
                    content:
                        `✅ **${result.tag}** est maintenant en ligne avec le script \`${scriptName}\` !\n` +
                        `⏰ Expiration automatique : <t:${expiresTs}:R> (<t:${expiresTs}:f>)`
                });

                // DM the user
                interaction.user.send(
                    `🤖 Votre bot **${result.tag}** a été mis en ligne avec le script \`${scriptName}\`.\n` +
                    `⏰ Il sera automatiquement arrêté <t:${expiresTs}:R>.`
                ).catch(() => {});

                return;
            }
            return;
        }

        // ── Slash commands ───────────────────────────────────────────────────
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
                    '• 🗑️ Messages supprimés\n• 📥 Membres rejoints\n• 📤 Membres partis\n• 🔨 Bans\n• 🤖 /panel (bot démarré)\n• 📜 /addscript'
                }).setTimestamp();
            message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'help') {
            const embed = new EmbedBuilder()
                .setColor(0x7289da).setTitle('📖 Aide — Commandes disponibles')
                .addFields(
                    { name: '⚙️ Slash Commands', value:
                        '`/panel` — Panneau pour mettre un bot en ligne (Admin)\n' +
                        '`/listpublic` — Voir les scripts disponibles\n' +
                        '`/ghostping #salon` — Configure le ghostping (Admin)\n' +
                        '`/addscript name:nom script:code` — Ajoute un script (Admin)\n' +
                        '`/removescript name:nom` — Supprime un script (Admin)'
                    },
                    { name: '🔨 Modération (?)', value:
                        '`?ban @user raison`\n`?kick @user raison`\n`?mute @user 1d raison`\n`?unmute @user`\n`?addlogs #salon`'
                    }
                ).setFooter({ text: 'Préfixe: ?' }).setTimestamp();
            message.channel.send({ embeds: [embed] });
            return;
        }
    });

    // Ghostping handler
    client.on('guildMemberAdd', async (member) => {
        logMemberJoin(client, member);

        const ghostpingChannelId = db.getGhostpingChannel(member.guild.id);
        if (!ghostpingChannelId) return;

        try {
            const channel = await member.guild.channels.fetch(ghostpingChannelId);
            if (!channel || !channel.isTextBased()) return;

            const msg = await channel.send(`${member}`);
            setTimeout(() => msg.delete().catch(() => {}), 100);
        } catch (err) {
            console.error('[GHOSTPING ERROR]', err.message);
        }
    });

    client.on('messageDelete', (message) => {
        if (message.partial || !message.guild) return;
        logMessageDelete(client, message);
    });
    client.on('guildMemberRemove', (member) => logMemberLeave(client, member));
    client.on('guildBanAdd', (ban) => logBan(client, ban));

    client.login(TOKEN).catch(err => {
        console.error('[LOGIN ERROR]', err.message);
        process.exit(1);
    });
})();

