import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../types";

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Shows the bot's ping"),
  execute: async (interaction) => {
    interaction.reply("Pong");
  },
  cooldown: 10,
};

export default command;
