const config = require("../config");

const Discord = require("discord.js");
const axios = require("axios").default;
const gamedig = require("gamedig");

const client = new Discord.Client({ intents: 32767 });

let rust_servers = config.rust_servers;

let total_players = 0;
let total_max_players = 0;
let total_queued_players = 0;

client.login(config.discord.token);

client.once("ready", async () =>
{
    console.log(`[Discord] Logged in as ${client.user.tag}`);

    await fetch_server_details();

    await fetch_all_servers_population();

    setInterval(async () => {
        await fetch_all_servers_population()

        total_players = rust_servers.map(x => x.currentPlayers).reduce((a, b) => a + b);
        total_max_players = rust_servers.map(x => x.maxPlayers).reduce((a, b) => a + b);
        total_queued_players = rust_servers.map(x => x.queuedPlayers).reduce((a, b) => a + b);

        await client.user.setActivity(`${total_players}/${total_max_players} ${total_queued_players > 0 && `(${total_queued_players})`}`);
    }, 30 * 1000);
});

client.on("messageCreate", async (message) =>
{
    if (message.author.bot) return;

    if (message.content === "!online" || message.content === "!players")
    {
        return message.reply(`THERE ARE CURRENTLY **${total_players}** PLAYERS ONLINE WITH **${total_queued_players}** PLAYERS QUEUED!`);
    }
});

const fetch_server_details = async () =>
{
    for (let i = 0; i < rust_servers.length; i++) {
        const rust_server = rust_servers[i];

        if (rust_server.ipAddress !== "" && rust_server.port !== 0) return;
        
        const { data: { data } } = await axios.get(`https://api.battlemetrics.com/servers/${rust_server.bmId}`);

        if (data === null) return;

        rust_server.status      = data.attributes.status;
        rust_server.ipAddress   = data.attributes.ip;
        rust_server.port        = data.attributes.port;

        rust_server.maxPlayers      = 0;
        rust_server.currentPlayers  = 0;
        rust_server.queuedPlayers   = 0;
    }    
};

const fetch_server_population = async (rust_server) =>
{
    if (rust_server.status !== "online") return;

    const data = await gamedig.query({
        type: "rust",
        host: rust_server.ipAddress,
        port: rust_server.port,
        maxAttempts: 4,
        attemptTimeout: 15000
    });

    if (data === null) return;

    let rules = data.raw.tags.toString();

    rust_server.maxPlayers = Number(rules.match(/mp(\d{1,3})/)[1]);
    rust_server.currentPlayers = Number(rules.match(/cp(\d{1,3})/)[1]);
    rust_server.queuedPlayers = Number(rules.match(/qp(\d{1,3})/)[1]);
};

const fetch_all_servers_population = async () =>
{
    for (let index = 0; index < rust_servers.length; index++) {
        const rust_server = rust_servers[index];
        
        await fetch_server_population(rust_server);
    }
};