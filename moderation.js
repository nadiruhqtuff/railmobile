const { EmbedBuilder } = require('discord.js');

const PREFIX = '?';

function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d|D)$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return value * multipliers[unit];
}

function handleMessage(message) {
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ban') {
        if (!message.member?.permissions.has('BanMembers')) {
            return message.reply('❌ Permission refusée. (BanMembers requis)');
        }
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Mentionne un utilisateur.');
        const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
        message.guild.members.ban(target, { reason }).then(() => {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🔨 Utilisateur Banni')
                .addFields(
                    { name: 'Utilisateur', value: `${target.tag}`, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: message.author.tag, inline: true }
                )
                .setTimestamp();
            message.channel.send({ embeds: [embed] });
        }).catch(() => message.reply('❌ Impossible de bannir cet utilisateur.'));
    }

    if (command === 'kick') {
        if (!message.member?.permissions.has('KickMembers')) {
            return message.reply('❌ Permission refusée. (KickMembers requis)');
        }
        const target = message.mentions.members?.first();
        if (!target) return message.reply('❌ Mentionne un membre.');
        const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
        target.kick(reason).then(() => {
            message.channel.send(`✅ **${target.user.tag}** a été expulsé. Raison : ${reason}`);
        }).catch(() => message.reply('❌ Impossible d\'expulser ce membre.'));
    }

    if (command === 'mute') {
        if (!message.member?.permissions.has('ModerateMembers')) {
            return message.reply('❌ Permission refusée. (ModerateMembers requis)');
        }
        const target = message.mentions.members?.first();
        if (!target) return message.reply('❌ Mentionne un membre.');

        const timeArg = args[1];
        const durationMs = timeArg ? parseDuration(timeArg) : null;
        if (!durationMs) return message.reply('❌ Précise une durée valide (ex: 1d, 2h, 30m).');

        const reason = args.slice(2).join(' ') || 'Aucune raison fournie';
        target.timeout(durationMs, reason).then(() => {
            const embed = new EmbedBuilder()
                .setColor(0xff8844)
                .setTitle('🔇 Membre Mis en Sourdine')
                .addFields(
                    { name: 'Membre', value: target.user.tag, inline: true },
                    { name: 'Durée', value: timeArg, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: message.author.tag, inline: true }
                )
                .setTimestamp();
            message.channel.send({ embeds: [embed] });
        }).catch(() => message.reply('❌ Impossible de mettre ce membre en sourdine.'));
    }

    if (command === 'unmute') {
        if (!message.member?.permissions.has('ModerateMembers')) {
            return message.reply('❌ Permission refusée.');
        }
        const target = message.mentions.members?.first();
        if (!target) return message.reply('❌ Mentionne un membre.');
        target.timeout(null).then(() => {
            message.channel.send(`✅ **${target.user.tag}** n'est plus en sourdine.`);
        }).catch(() => message.reply('❌ Impossible de remettre ce membre.'));
    }

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('📖 Commandes - Script Modération')
            .addFields(
                { name: '?ban @user raison', value: 'Bannit un utilisateur', inline: false },
                { name: '?kick @user raison', value: 'Expulse un membre', inline: false },
                { name: '?mute @user 1d raison', value: 'Met en sourdine (1s/m/h/d)', inline: false },
                { name: '?unmute @user', value: 'Retire la sourdine', inline: false }
            )
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
}

module.exports = { handleMessage };
