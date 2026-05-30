const { EmbedBuilder } = require('discord.js');

const PREFIX = '?';

function handleMessage(message) {
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        message.reply('🏓 Pong ! Le bot est en ligne.');
    }

    if (command === 'info') {
        const embed = new EmbedBuilder()
            .setColor(0x7289da)
            .setTitle('ℹ️ Informations du serveur')
            .addFields(
                { name: 'Nom', value: message.guild?.name || 'DM', inline: true },
                { name: 'Membres', value: `${message.guild?.memberCount || '?'}`, inline: true }
            )
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'say') {
        if (!message.member?.permissions.has('ManageMessages')) return message.reply('❌ Permission refusée.');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Précise un message !');
        message.channel.send(text);
        message.delete().catch(() => {});
    }

    if (command === 'embed') {
        if (!message.member?.permissions.has('ManageMessages')) return message.reply('❌ Permission refusée.');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Précise un message !');
        const embed = new EmbedBuilder().setColor(0x7289da).setDescription(text).setTimestamp();
        message.channel.send({ embeds: [embed] });
        message.delete().catch(() => {});
    }

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x00b0f4)
            .setTitle('📖 Commandes - Script Communauté')
            .addFields(
                { name: '?ping', value: 'Vérifie si le bot répond', inline: true },
                { name: '?info', value: 'Infos sur le serveur', inline: true },
                { name: '?say [message]', value: 'Faire parler le bot', inline: true },
                { name: '?embed [message]', value: 'Envoyer un embed', inline: true }
            )
            .setTimestamp();
        message.channel.send({ embeds: [embed] });
    }
}

module.exports = { handleMessage };
