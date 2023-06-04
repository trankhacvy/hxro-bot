import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import * as sdk from "@hxronetwork/parimutuelsdk";
import { SlashCommand } from "../types";
import { USDC, connection } from "../services/hxro";
import { Supabase } from "../services/supabase";
import { PublicKey } from "@solana/web3.js";
import { formatNumber } from "../utils/formatNumber";

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Show your balances"),
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
      
      const ata = await sdk.findAssociatedTokenAccountPubkey(
        new PublicKey(user.sol_wallet),
        new PublicKey(USDC)
      );

      const balance = await connection.getTokenAccountBalance(ata);

      const embed = new EmbedBuilder()
        .setTitle("Hxro wallet")
        .addFields(
          {
            name: "USDC",
            value: String(
              balance.value.uiAmount
                ? formatNumber(balance.value.uiAmount)
                : "-"
            ),
          },
          {
            name: "BTC",
            value: "0",
          },
          {
            name: "ETH",
            value: "0",
          }
        )
        .setTimestamp()
        .setFooter({
          text: "Type /feedback to report • Hxro bot•",
          iconURL: interaction.client.user?.avatarURL() || undefined,
        });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: "Something went wrong..." });
    }
  },
};

export default command;
