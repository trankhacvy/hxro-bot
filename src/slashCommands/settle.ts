import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import * as bs58 from "bs58";
import { SlashCommand } from "../types";
import { Supabase } from "../services/supabase";
import { Keypair } from "@solana/web3.js";

const command: SlashCommand = {
  command: new SlashCommandBuilder().setName("settle").setDescription("settle"),

  execute: async (interaction) => {
    try {
      await interaction.deferReply();

      let { data: user, error } = await Supabase.from("hxro_users")
        .select("*")
        .eq("discord_id", interaction.user.id)
        .maybeSingle();

      if (!user || error) {
        return await interaction.editReply({
          content: "Something went wrong...",
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Deposit tokens")
        .setDescription(
          "Below is the deposit address linked to your Discord account. Please copy your deposit address and paste it into your third-party wallet or exchange."
        )
        .addFields({ name: "Address", value: user.sol_wallet })
        .setTimestamp()
        .setFooter({
          text: "Type /feedback to report • Hxro bot•",
          iconURL: interaction.client.user?.avatarURL() || undefined,
        });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      interaction.editReply({ content: "Something went wrong..." });
    }
  },
};

export default command;
