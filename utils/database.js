/**
 * database.js — Simple in-memory + JSON-backed store for scripts and bot sessions.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.json');

// Load persisted data or start fresh
function loadData() {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (err) {
        console.error('[DB] Failed to load data.json:', err.message);
    }
    return { scripts: {}, logChannels: {}, activeBots: {} };
}

function saveData(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('[DB] Failed to save data.json:', err.message);
    }
}

let data = loadData();

// ─── Scripts ────────────────────────────────────────────────────────────────

/**
 * Save a script by name.
 * @param {string} name   - Script identifier (lowercase)
 * @param {string} code   - Script source code
 * @param {string} lang   - Language hint: 'js', 'python', 'java', etc.
 */
function setScript(name, code, lang = 'js') {
    data.scripts[name.toLowerCase()] = { code, lang, createdAt: Date.now() };
    saveData(data);
}

/**
 * Retrieve a script by name.
 * @param {string} name
 * @returns {{ code: string, lang: string, createdAt: number } | null}
 */
function getScript(name) {
    return data.scripts[name.toLowerCase()] || null;
}

/**
 * Delete a script by name.
 * @param {string} name
 * @returns {boolean} true if it existed and was deleted
 */
function deleteScript(name) {
    const key = name.toLowerCase();
    if (!data.scripts[key]) return false;
    delete data.scripts[key];
    saveData(data);
    return true;
}

/**
 * List all script names.
 * @returns {string[]}
 */
function listScripts() {
    return Object.keys(data.scripts);
}

// ─── Log Channels ────────────────────────────────────────────────────────────

function setLogChannel(guildId, channelId) {
    if (!data.logChannels) data.logChannels = {};
    data.logChannels[guildId] = channelId;
    saveData(data);
}

function getLogChannel(guildId) {
    return (data.logChannels || {})[guildId] || null;
}

// ─── Active Bots ─────────────────────────────────────────────────────────────

function setActiveBot(token, info) {
    if (!data.activeBots) data.activeBots = {};
    data.activeBots[token] = info;
    saveData(data);
}

function getActiveBot(token) {
    return (data.activeBots || {})[token] || null;
}

function removeActiveBot(token) {
    if (data.activeBots && data.activeBots[token]) {
        delete data.activeBots[token];
        saveData(data);
    }
}

function listActiveBots() {
    return Object.entries(data.activeBots || {}).map(([token, info]) => ({ token, ...info }));
}

module.exports = {
    // Scripts
    setScript,
    getScript,
    deleteScript,
    listScripts,
    // Log channels
    setLogChannel,
    getLogChannel,
    // Active bots
    setActiveBot,
    getActiveBot,
    removeActiveBot,
    listActiveBots,
};
