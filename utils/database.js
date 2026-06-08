const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(filename) {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return {};
    }
}

function writeJSON(filename, data) {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
    // Scripts
    getScripts() {
        return readJSON('scripts.json');
    },
    saveScript(name, code) {
        const scripts = readJSON('scripts.json');
        scripts[name.toLowerCase()] = { name, code, createdAt: Date.now() };
        writeJSON('scripts.json', scripts);
    },
    getScript(name) {
        const scripts = readJSON('scripts.json');
        return scripts[name.toLowerCase()] || null;
    },
    deleteScript(name) {
        const scripts = readJSON('scripts.json');
        delete scripts[name.toLowerCase()];
        writeJSON('scripts.json', scripts);
    },
    listScripts() {
        const scripts = readJSON('scripts.json');
        return Object.keys(scripts);
    },

    // Log channels
    getLogChannels() {
        return readJSON('logchannels.json');
    },
    setLogChannel(guildId, channelId) {
        const channels = readJSON('logchannels.json');
        channels[guildId] = channelId;
        writeJSON('logchannels.json', channels);
    },
    getLogChannel(guildId) {
        const channels = readJSON('logchannels.json');
        return channels[guildId] || null;
    },

    // Ghostping
    setGhostpingChannel(guildId, channelId) {
        const ghostpings = readJSON('ghostpings.json');
        ghostpings[guildId] = channelId;
        writeJSON('ghostpings.json', ghostpings);
    },
    getGhostpingChannel(guildId) {
        const ghostpings = readJSON('ghostpings.json');
        return ghostpings[guildId] || null;
    },

    // Mutes
    getMutes() {
        return readJSON('mutes.json');
    },
    saveMute(guildId, userId, data) {
        const mutes = readJSON('mutes.json');
        if (!mutes[guildId]) mutes[guildId] = {};
        mutes[guildId][userId] = data;
        writeJSON('mutes.json', mutes);
    },
    removeMute(guildId, userId) {
        const mutes = readJSON('mutes.json');
        if (mutes[guildId]) {
            delete mutes[guildId][userId];
            writeJSON('mutes.json', mutes);
        }
    },

    // Rules
    getRules(guildId) {
        const rules = readJSON('rules.json');
        return rules[guildId] || null;
    },
    setRules(guildId, text) {
        const rules = readJSON('rules.json');
        rules[guildId] = text;
        writeJSON('rules.json', rules);
    }
};

