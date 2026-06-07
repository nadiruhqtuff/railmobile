/**
 * botManager.js — Starts a secondary Discord bot using a stored script.
 *
 * Supports:
 *   - JavaScript (.js)  → executed in-process via new Function / vm
 *   - Python (.py)      → saved to temp file, executed with `python3`
 *   - Java (.java)      → saved to temp file, compiled + executed with `javac`/`java`
 *   - Any other lang    → saved to temp file, executed with the detected runtime
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('./database');

// Map of token → { client, timeout, scriptName }
const activeBots = new Map();

// ─── Language detection ───────────────────────────────────────────────────────

/**
 * Detect the language of a script from its stored lang hint or by inspecting code.
 * @param {{ code: string, lang: string }} scriptObj
 * @returns {'js'|'python'|'java'|string}
 */
function detectLanguage(scriptObj) {
    if (scriptObj.lang && scriptObj.lang !== 'js') return scriptObj.lang;

    const code = scriptObj.code || '';

    // Heuristics
    if (/^\s*(import\s+\w|from\s+\w+\s+import|def\s+\w+\s*\(|print\s*\()/m.test(code)) return 'python';
    if (/^\s*(public\s+class|import\s+java\.|System\.out\.print)/m.test(code)) return 'java';

    return 'js';
}

// ─── JavaScript execution ─────────────────────────────────────────────────────

/**
 * Build a message handler function from raw JS code.
 * The code receives: message, client, Discord
 */
function buildJsHandler(code) {
    // Wrap in async IIFE so the script can use await
    const wrapped = `(async () => { ${code} })()`;
    // eslint-disable-next-line no-new-func
    return new Function('message', 'client', 'Discord', `return ${wrapped}`);
}

// ─── External process execution ───────────────────────────────────────────────

const RUNTIME_MAP = {
    python: ['python3', '.py'],
    python3: ['python3', '.py'],
    java: ['java', '.java'],   // handled specially (compile first)
    ruby: ['ruby', '.rb'],
    node: ['node', '.js'],
    javascript: ['node', '.js'],
    bash: ['bash', '.sh'],
    sh: ['sh', '.sh'],
};

/**
 * Execute a non-JS script in a child process, passing message data as JSON via stdin.
 * @param {string} lang
 * @param {string} code
 * @param {import('discord.js').Message} message
 */
async function runExternalScript(lang, code, message) {
    const [runtime, ext] = RUNTIME_MAP[lang] || ['node', '.js'];

    // Write code to a temp file
    const tmpFile = path.join(os.tmpdir(), `bot_script_${Date.now()}${ext}`);
    fs.writeFileSync(tmpFile, code, 'utf8');

    // Serialise message context to pass to the script
    const ctx = JSON.stringify({
        content: message.content,
        authorId: message.author?.id,
        authorTag: message.author?.tag,
        channelId: message.channel?.id,
        guildId: message.guild?.id,
    });

    return new Promise((resolve) => {
        let proc;

        if (lang === 'java') {
            // Java: compile first, then run
            execFile('javac', [tmpFile], (compileErr) => {
                if (compileErr) {
                    console.error('[botManager][java] Compile error:', compileErr.message);
                    message.channel?.send(`❌ Java compile error:\n\`\`\`\n${compileErr.message.slice(0, 1800)}\n\`\`\``).catch(() => {});
                    fs.unlink(tmpFile, () => {});
                    return resolve();
                }
                const className = path.basename(tmpFile, '.java');
                proc = spawn('java', ['-cp', os.tmpdir(), className]);
                handleProc(proc, message, tmpFile, resolve);
            });
        } else {
            proc = spawn(runtime, [tmpFile]);
            proc.stdin.write(ctx);
            proc.stdin.end();
            handleProc(proc, message, tmpFile, resolve);
        }
    });
}

function handleProc(proc, message, tmpFile, resolve) {
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
        fs.unlink(tmpFile, () => {});
        if (stdout.trim()) {
            message.channel?.send(`📤 Output:\n\`\`\`\n${stdout.slice(0, 1800)}\n\`\`\``).catch(() => {});
        }
        if (stderr.trim()) {
            message.channel?.send(`⚠️ Stderr:\n\`\`\`\n${stderr.slice(0, 1800)}\n\`\`\``).catch(() => {});
        }
        resolve();
    });

    proc.on('error', (err) => {
        fs.unlink(tmpFile, () => {});
        console.error('[botManager] Process error:', err.message);
        message.channel?.send(`❌ Runtime error: ${err.message}`).catch(() => {});
        resolve();
    });
}

// ─── Bot lifecycle ────────────────────────────────────────────────────────────

const BOT_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Start a secondary bot with the given token and script.
 *
 * @param {string} token        - Discord bot token
 * @param {string} scriptName   - Name of the script stored in the database
 * @param {import('discord.js').User} requestingUser - User who triggered the command
 * @returns {Promise<{ success: boolean, error?: string, tag?: string, expiresAt?: Date }>}
 */
async function startBot(token, scriptName, requestingUser) {
    // Prevent duplicate bots
    if (activeBots.has(token)) {
        return { success: false, error: 'Un bot avec ce token est déjà en ligne.' };
    }

    // Fetch script
    const scriptObj = db.getScript(scriptName);
    if (!scriptObj) {
        return { success: false, error: `Script \`${scriptName}\` introuvable. Utilisez \`/listpublic\` pour voir les scripts disponibles.` };
    }

    const lang = detectLanguage(scriptObj);
    const Discord = require('discord.js');

    // Build JS handler (only used for JS scripts)
    let jsHandler = null;
    if (lang === 'js') {
        try {
            jsHandler = buildJsHandler(scriptObj.code);
        } catch (err) {
            return { success: false, error: `Erreur de syntaxe dans le script JS : ${err.message}` };
        }
    }

    // Create child client
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

    // Message handler
    childClient.on('messageCreate', async (message) => {
        if (message.author?.bot) return;

        try {
            if (lang === 'js' && jsHandler) {
                await jsHandler(message, childClient, Discord);
            } else {
                await runExternalScript(lang, scriptObj.code, message);
            }
        } catch (err) {
            console.error(`[botManager][${scriptName}] Script error:`, err.message);
            message.channel?.send(`❌ Script error: ${err.message}`).catch(() => {});
        }
    });

    // Login
    return new Promise((resolve) => {
        const loginTimeout = setTimeout(() => {
            childClient.destroy();
            resolve({ success: false, error: 'Timeout lors de la connexion du bot (token invalide ?).' });
        }, 30_000);

        childClient.once('ready', () => {
            clearTimeout(loginTimeout);

            const expiresAt = new Date(Date.now() + BOT_LIFETIME_MS);
            const tag = childClient.user.tag;

            // Schedule auto-shutdown after 24 h
            const shutdownTimer = setTimeout(async () => {
                await stopBot(token);
                // DM the requesting user
                try {
                    const user = await childClient.users.fetch(requestingUser.id).catch(() => null)
                        || requestingUser;
                    await user.send(
                        `⏰ Votre bot **${tag}** (script: \`${scriptName}\`) a été mis hors ligne après 24 heures.\n` +
                        'Utilisez `/panel` pour le relancer.'
                    ).catch(() => {});
                } catch (_) {}
            }, BOT_LIFETIME_MS);

            activeBots.set(token, { client: childClient, timer: shutdownTimer, scriptName, tag, expiresAt });

            // Persist to DB
            db.setActiveBot(token, { scriptName, tag, expiresAt: expiresAt.toISOString(), userId: requestingUser.id });

            console.log(`[botManager] Bot started: ${tag} | script: ${scriptName} | expires: ${expiresAt.toISOString()}`);
            resolve({ success: true, tag, expiresAt });
        });

        childClient.on('error', (err) => {
            console.error(`[botManager] Client error (${scriptName}):`, err.message);
        });

        childClient.login(token).catch((err) => {
            clearTimeout(loginTimeout);
            childClient.destroy();
            resolve({ success: false, error: `Impossible de se connecter : ${err.message}` });
        });
    });
}

/**
 * Stop and destroy a running bot by token.
 * @param {string} token
 */
async function stopBot(token) {
    const entry = activeBots.get(token);
    if (!entry) return;

    clearTimeout(entry.timer);
    try { entry.client.destroy(); } catch (_) {}
    activeBots.delete(token);
    db.removeActiveBot(token);

    console.log(`[botManager] Bot stopped: ${entry.tag}`);
}

/**
 * Get info about a running bot.
 * @param {string} token
 */
function getBotInfo(token) {
    return activeBots.get(token) || null;
}

/**
 * List all currently active bots.
 * @returns {Array<{ token: string, scriptName: string, tag: string, expiresAt: Date }>}
 */
function listActiveBots() {
    return [...activeBots.entries()].map(([token, info]) => ({
        token,
        scriptName: info.scriptName,
        tag: info.tag,
        expiresAt: info.expiresAt,
    }));
}

module.exports = { startBot, stopBot, getBotInfo, listActiveBots };
