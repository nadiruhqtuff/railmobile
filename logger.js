const { EmbedBuilder } = require('discord.js');
const db = require('./database');

async function sendLog(client, guildId, embed) {
    const channelId = db.getLogChannel(guildId);
    if (!channelId) return;
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error(`[LOG ERROR] Guild ${guildId}: ${err.message}`);
    }
}

function logMessageDelete(client, message) {
    if (!message.guild || message.author?.bot) return;
    const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🗑️ Message Supprimé')
        .addFields(
            { name: 'Auteur', value: `${message.author?.tag || 'Inconnu'} (${message.author?.id || '?'})`, inline: true },
            { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Contenu', value: message.content || '*[Aucun texte]*' }
        )
        .setTimestamp();
    sendLog(client, message.guild.id, embed);
}

function logMemberJoin(client, member) {
    const embed = new EmbedBuilder()
        .setColor(0x44ff88)
        .setTitle('📥 Membre Rejoint')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'Utilisateur', value: `${member.user.tag} (${member.user.id})`, inline: true },
            { name: 'Compte créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true }
        )
        .setTimestamp();
    sendLog(client, member.guild.id, embed);
}

function logMemberLeave(client, member) {
    const embed = new EmbedBuilder()
        .setColor(0xff8844)
        .setTitle('📤 Membre Parti')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'Utilisateur', value: `${member.user.tag} (${member.user.id})`, inline: true },
            { name: 'A rejoint le', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Inconnu', inline: true }
        )
        .setTimestamp();
    sendLog(client, member.guild.id, embed);
}

function logBan(client, ban) {
    const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🔨 Membre Banni')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
            { name: 'Utilisateur', value: `${ban.user.tag} (${ban.user.id})`, inline: true },
            { name: 'Raison', value: ban.reason || 'Aucune raison fournie', inline: true }
        )
        .setTimestamp();
    sendLog(client, ban.guild.id, embed);
}

function logAddScriptBot(client, guildId, { scriptName, botId, executedBy }) {
    const embed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle('🤖 Bot Mis en Ligne via /addscriptbot')
        .addFields(
            { name: 'Script utilisé', value: scriptName, inline: true },
            { name: 'Bot ID', value: botId, inline: true },
            { name: 'Commandé par', value: executedBy, inline: true },
            { name: 'Expire dans', value: '24 heures', inline: true }
        )
        .setTimestamp();
    sendLog(client, guildId, embed);
}

function logAddScript(client, guildId, { scriptName, executedBy }) {
    const embed = new EmbedBuilder()
        .setColor(0x00b0f4)
        .setTitle('📜 Nouveau Script Ajouté via /addscript')
        .addFields(
            { name: 'Nom du script', value: scriptName, inline: true },
            { name: 'Ajouté par', value: executedBy, inline: true }
        )
        .setTimestamp();
    sendLog(client, guildId, embed);
}

module.exports = {
    logMessageDelete,
    logMemberJoin,
    logMemberLeave,
    logBan,
    logAddScriptBot,
    logAddScript
};
