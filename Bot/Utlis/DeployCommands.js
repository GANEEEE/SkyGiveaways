const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const CACHE_FILE = path.join(__dirname, '..', 'commands_hash.json');

function getCommandsHash(commands) {
    return crypto.createHash('md5')
        .update(JSON.stringify(commands))
        .digest('hex');
}

async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'Commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        }
    }

    const currentHash = getCommandsHash(commands);

    // لو الـ commands ملهاش تغيير، متعملش deploy
    try {
        const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (cache.hash === currentHash) {
            console.log('✅ Commands unchanged — skipping deploy');
            return;
        }
    } catch {
        // لو مفيش cache file، هنعمل deploy عادي
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('🚀 Commands changed — deploying...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        // احفظ الـ hash الجديد
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ hash: currentHash }));
        console.log('✅ Commands deployed and hash saved.');
    } catch (error) {
        console.error('❌ Deploy error:', error);
    }
}

module.exports = deployCommands;