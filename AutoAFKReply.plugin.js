/**
 * @name AutoAFKReply
 * @description Manually toggle AFK mode on or off from the plugin settings, or activate AFK mode automatically after 5 minutes of inactivity. Automatically replies to DMs when AFK is activated.
 * @version 2.0.0
 * @author Wick
 * @github https://github.com/wickstudio/AutoAFKReply
 * @discord https://discord.gg/wicks
 * @website https://wickdev.me
 * @updateUrl https://raw.githubusercontent.com/wickstudio/AutoAFKReply/main/AutoAFKReply.plugin.js
 * @sourceUrl https://github.com/wickstudio/AutoAFKReply
 */



module.exports = (() => {
    const config = {
        info: {
            name: "AutoAFKReply",
            authors: [
                {
                    name: "Wick",
                    discord_id: "204221589883977728",
                    github_username: "wickstudio",
                }
            ],
            version: "2.0.0",
            description: "Manually toggle AFK mode on or off, or automatically activate it after 5 minutes of inactivity. Auto-replies to DMs when AFK is activated.",
            github: "https://github.com/wickstudio",
            discord: "https://discord.gg/wicks",
            website: "https://wickdev.me",
            copyright: "Wick Studio"
        },
        defaultConfig: [
            {
                type: "textbox",
                id: "afkMessage",
                name: "AFK Message",
                note: "This is the message that will be sent when you're AFK.",
                value: "I'm currently AFK. I'll get back to you soon."
            },
            {
                type: "switch",
                id: "autoAFK",
                name: "Enable Automatic AFK after 5 Minutes",
                note: "Automatically activate AFK mode after 5 minutes of inactivity.",
                value: false
            }
        ]
    };

    return !global.ZeresPluginLibrary ? class {
        load() {
            BdApi.showConfirmationModal("Library Plugin Missing",
                `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`,
                {
                    confirmText: "Download Now",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        require("request").get("https://betterdiscord.app/Download?id=9", async (err, res, body) => {
                            if (err) return BdApi.showToast("Download Failed", { type: "error" });
                            await require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "ZeresPluginLibrary.plugin.js"), body, (err) => {
                                if (err) return BdApi.showToast("Download Failed", { type: "error" });
                                BdApi.showToast("Successfully Downloaded ZeresPluginLibrary", { type: "success" });
                            });
                        });
                    }
                }
            );
        }
        start() { }
        stop() { }
    } : (([Plugin, Library]) => {
        const { Patcher, WebpackModules, DiscordModules } = Library;

        return class AutoAFKReply extends Plugin {
            constructor() {
                super();
                this.afk = false;
                this.afkMessage = BdApi.loadData(config.info.name, "afkMessage") || "I'm currently AFK. I'll get back to you soon.";
                this.autoAFK = BdApi.loadData(config.info.name, "autoAFK") || false;
                this.inactivityTimeout = null;
                this.lastMessageTimestamp = null;
            }

            onStart() {
                this.patchMessages();
                this.setupAutoAFK();
                BdApi.showToast("Auto AFK Reply Plugin started. Toggle AFK mode from the plugin settings or activate it after 5 minutes of inactivity.", { type: "info" });
            }

            setupAutoAFK() {
                if (this.autoAFK) {
                    this.resetInactivityTimer();
                    document.addEventListener("mousemove", this.resetInactivityTimer.bind(this));
                    document.addEventListener("keydown", this.resetInactivityTimer.bind(this));
                }
            }

            resetInactivityTimer() {
                if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);

                this.inactivityTimeout = setTimeout(() => {
                    this.afk = true;
                    this.lastMessageTimestamp = new Date().getTime(); // Record when AFK was activated
                    BdApi.showToast("AFK mode automatically activated after 5 minutes of inactivity.", { type: "info" });
                }, 300000);
            }

            patchMessages() {
                try {
                    const Dispatcher = WebpackModules.getByProps("dispatch", "subscribe");
                    const MessageHandler = WebpackModules.getByProps("sendMessage");

                    Dispatcher.subscribe("MESSAGE_CREATE", (event) => {
                        const message = event.message;
                        const currentUser = DiscordModules.UserStore.getCurrentUser();
                        const channel = DiscordModules.ChannelStore.getChannel(message.channel_id);

                        if (channel && channel.isDM() && this.afk && message.author.id !== currentUser.id) {
                            const messageTime = new Date(message.timestamp).getTime();
                            if (!this.lastMessageTimestamp || messageTime > this.lastMessageTimestamp) {
                                MessageHandler.sendMessage(message.channel_id, { content: this.afkMessage });
                            }
                        }
                    });
                } catch (error) {
                    BdApi.showToast(`Error patching messages: ${error.message}`, { type: "error" });
                    console.error('AutoAFKReply Patch Message Error:', error);
                }
            }

            onStop() {
                try {
                    Patcher.unpatchAll();
                    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
                    document.removeEventListener("mousemove", this.resetInactivityTimer.bind(this));
                    document.removeEventListener("keydown", this.resetInactivityTimer.bind(this));
                    BdApi.showToast("Auto AFK Reply Plugin stopped. AFK mode deactivated.", { type: "info" });
                } catch (error) {
                    BdApi.showToast(`Error stopping plugin: ${error.message}`, { type: "error" });
                    console.error('AutoAFKReply Stop Error:', error);
                }
            }

            getSettingsPanel() {
                const panel = document.createElement("div");
                panel.innerHTML = `
                    <label>AFK Message:</label><br/>
                    <input type="text" id="afkMessageInput" value="${this.afkMessage}" style="width: 100%; padding: 5px; margin-top: 10px;" /><br/><br/>
                    <button id="toggleAFKButton" style="padding: 10px; background: ${this.afk ? '#f04747' : '#7289da'}; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        ${this.afk ? "Deactivate AFK" : "Activate AFK"}
                    </button><br/><br/>
                    <label>
                        <input type="checkbox" id="autoAFKToggle" ${this.autoAFK ? "checked" : ""} />
                        Enable Automatic AFK after 5 Minutes
                    </label>
                `;

                const messageInput = panel.querySelector("#afkMessageInput");
                messageInput.addEventListener("input", (e) => {
                    this.afkMessage = e.target.value || "I'm currently AFK. I'll get back to you soon.";
                    BdApi.saveData(config.info.name, "afkMessage", this.afkMessage);
                });

                const toggleAFKButton = panel.querySelector("#toggleAFKButton");
                toggleAFKButton.addEventListener("click", () => {
                    this.afk = !this.afk;
                    this.lastMessageTimestamp = this.afk ? new Date().getTime() : null;
                    toggleAFKButton.innerText = this.afk ? "Deactivate AFK" : "Activate AFK";
                    toggleAFKButton.style.background = this.afk ? "#f04747" : "#7289da";
                    const status = this.afk ? "AFK mode activated." : "AFK mode deactivated.";
                    BdApi.showToast(status, { type: this.afk ? "info" : "success" });
                });

                const autoAFKToggle = panel.querySelector("#autoAFKToggle");
                autoAFKToggle.addEventListener("change", (e) => {
                    this.autoAFK = e.target.checked;
                    BdApi.saveData(config.info.name, "autoAFK", this.autoAFK);
                    if (this.autoAFK) {
                        this.setupAutoAFK();
                        BdApi.showToast("Automatic AFK mode will activate after 5 minutes of inactivity.", { type: "info" });
                    } else {
                        if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
                        document.removeEventListener("mousemove", this.resetInactivityTimer.bind(this));
                        document.removeEventListener("keydown", this.resetInactivityTimer.bind(this));
                        BdApi.showToast("Automatic AFK mode disabled.", { type: "info" });
                    }
                });

                return panel;
            }
        };
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();